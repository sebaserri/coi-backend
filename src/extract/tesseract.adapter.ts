import { OcrAdapter, OcrResult } from "./ocr.adapter";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { createWorker } from "tesseract.js";
import { parseAcord25BySections } from "./acord25.sections";

const pdfPoppler = require("pdf-poppler");

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (d: Buffer) => chunks.push(d));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
function normalize(s?: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function idxWindow(lines: string[], center: number, radius = 4) {
  const start = Math.max(0, center - radius);
  const end = Math.min(lines.length, center + radius + 1);
  return lines.slice(start, end);
}
const DATE_RE = /(0[1-9]|1[0-2])[\/\-](0[1-9]|[12][0-9]|3[01])[\/\-](20\d{2})/g;
const LABELS = {
  producer: [/^producer\b/i],
  insured: [/^insured\b/i, /insured\s+name/i],
  certificateHolder: [/certificate\s+holder/i],
  policyEffective: [/policy\s+effective/i, /effective\s+date/i],
  policyExpiration: [/policy\s+expiration/i, /expiration\s+date/i],
};
function findLineIndex(lines: string[], patterns: RegExp[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (patterns.some((p) => p.test(l))) return i;
  }
  return undefined;
}
function collectHolderBlock(lines: string[], holderIdx: number): string {
  const block = [lines[holderIdx]];
  for (let i = 1; i <= 3; i++) {
    const l = lines[holderIdx + i];
    if (!l) break;
    if (!l.trim()) break;
    if (/^\s*(producer|insured|coverage|policy)\b/i.test(l)) break;
    block.push(l);
  }
  return normalize(block.join(" "));
}
function extractDatesAround(lines: string[], idx: number, radius = 3) {
  const win = idxWindow(lines, idx, radius);
  const dates = [...win.join("\n").matchAll(DATE_RE)].map((m) => m[0]);
  return { first: dates[0], second: dates[1] };
}
function pickDatesGlobal(fullText: string) {
  const dates = [...fullText.matchAll(DATE_RE)].map((m) => m[0]);
  return { first: dates[0], second: dates[1] };
}

export class TesseractAdapter implements OcrAdapter {
  private s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

  async extractFromS3(bucket: string, key: string): Promise<OcrResult> {
    const get = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await streamToBuffer((get as any).Body);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "coi-ocr-"));
    const ext = (path.extname(key) || "").toLowerCase();
    const inputPath = path.join(tmpDir, `input${ext || ".bin"}`);
    await fs.writeFile(inputPath, buf);
    let imagePaths: string[] = [inputPath];

    try {
      if (ext === ".pdf") {
        const outPrefix = "page";
        await pdfPoppler.convert(inputPath, {
          format: "png",
          out_dir: tmpDir,
          out_prefix: outPrefix,
          scale: 2.0,
        });
        const files = await fs.readdir(tmpDir);
        imagePaths = files
          .filter((f: string) => f.startsWith(`${outPrefix}-`) && f.endsWith(".png"))
          .map((f: string) => path.join(tmpDir, f))
          .sort((a: string, b: string) => {
            const ai = Number(a.match(/-(\d+)\.png$/)?.[1] ?? 0);
            const bi = Number(b.match(/-(\d+)\.png$/)?.[1] ?? 0);
            return ai - bi;
          });
        if (imagePaths.length === 0) throw new Error("No se generaron páginas PNG desde el PDF.");
      }

      const MAX_PAGES = Math.max(1, Number(process.env.OCR_MAX_PAGES || 3));
      imagePaths = imagePaths.slice(0, MAX_PAGES);

      const LANG = process.env.OCR_LANG || "eng";
      const worker = await createWorker(LANG, 1);
      let fullText = "";
      try {
        for (const img of imagePaths) {
          const { data } = await worker.recognize(img);
          fullText += (data?.text || "") + "\n";
        }
      } finally {
        await worker.terminate().catch(() => {});
      }

      const TABLE_HEADER_SIM = Number(process.env.ACORD_TABLE_HEADER_SIM || 0.55);
      const TABLE_MIN_AMOUNT = Number(process.env.ACORD_TABLE_MIN_AMOUNT || 100000);
      const sections = parseAcord25BySections(fullText, {
        headerSimilarityMin: TABLE_HEADER_SIM,
        minPlausibleAmount: TABLE_MIN_AMOUNT,
      });

      const rawLines = fullText
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const linesLower = rawLines.map((l) => l.toLowerCase());

      const producerIdx = findLineIndex(linesLower, LABELS.producer);
      const insuredIdx = findLineIndex(linesLower, LABELS.insured);
      const holderIdx = findLineIndex(linesLower, LABELS.certificateHolder);

      const producer =
        producerIdx !== undefined ? normalize(rawLines[producerIdx + 1] || rawLines[producerIdx]) : undefined;
      const insuredName =
        insuredIdx !== undefined ? normalize(rawLines[insuredIdx + 1] || rawLines[insuredIdx]) : undefined;
      const certificateHolder = holderIdx !== undefined ? collectHolderBlock(rawLines, holderIdx) : undefined;

      let effectiveDate: string | undefined;
      let expirationDate: string | undefined;
      const effIdx = findLineIndex(linesLower, LABELS.policyEffective);
      const expIdx = findLineIndex(linesLower, LABELS.policyExpiration);
      if (effIdx !== undefined) {
        const { first } = extractDatesAround(rawLines, effIdx, 3);
        if (first) effectiveDate = first;
      }
      if (expIdx !== undefined) {
        const { first } = extractDatesAround(rawLines, expIdx, 3);
        if (first) expirationDate = first;
      }
      if (!effectiveDate || !expirationDate) {
        const g = pickDatesGlobal(fullText);
        effectiveDate ||= g.first;
        expirationDate ||= g.second;
      }

      const generalLiabLimit =
        (sections.general as any).eachOccurrence ??
        (sections.general as any).generalAggregate ??
        (sections.general as any).productsCompOpAgg;
      const autoLiabLimit =
        (sections.auto as any).autoCombinedSingleLimit ??
        (sections.auto as any).eachAccident;
      const umbrellaLimit =
        (sections.umbrella as any).umbrellaEachOccurrence ??
        (sections.umbrella as any).umbrellaAggregate;

      const fields: Record<string, any> = {
        insuredName,
        producer,
        effectiveDate,
        expirationDate,
        generalLiabLimit,
        autoLiabLimit,
        umbrellaLimit,
        certificateHolder,
      };

      const baseKeys = ["insuredName","producer","effectiveDate","expirationDate","certificateHolder"];
      let score = baseKeys.filter((k) => fields[k]).length;
      if (fields.generalLiabLimit) score += 1;
      if (fields.autoLiabLimit) score += 1;
      if (fields.umbrellaLimit) score += 1;
      const confidence = Math.min(1, score / (baseKeys.length + 3));

      return { fields, confidence, raw: { engine: "tesseract", bucket, key, pages: imagePaths.length, fullText } };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
