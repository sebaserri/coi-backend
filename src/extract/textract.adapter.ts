import {
  TextractClient,
  AnalyzeDocumentCommand,
  Block,
} from "@aws-sdk/client-textract";
import { OcrAdapter, OcrResult } from "./ocr.adapter";

/** Helpers **/
function normalize(s?: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function parseMoney(raw?: string): number | undefined {
  if (!raw) return;
  const s = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!s) return;
  const n = Number(s);
  return isNaN(n) ? undefined : n;
}

export class TextractAdapter implements OcrAdapter {
  private client: TextractClient;

  constructor() {
    this.client = new TextractClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  async extractFromS3(bucket: string, key: string): Promise<OcrResult> {
    const command = new AnalyzeDocumentCommand({
      Document: { S3Object: { Bucket: bucket, Name: key } },
      FeatureTypes: ["FORMS"],
    });

    const res = await this.client.send(command);

    // Concatenamos todos los bloques de texto LINE
    const lines: string[] = [];
    if (res.Blocks) {
      for (const block of res.Blocks) {
        if (block.BlockType === "LINE" && block.Text) {
          lines.push(block.Text);
        }
      }
    }
    const fullText = lines.join("\n");

    // Regex simples para fechas y montos
    const dateRegex =
      /(0[1-9]|1[0-2])[\/\-](0[1-9]|[12][0-9]|3[01])[\/\-](20\d{2})/g;
    const moneyRegex =
      /\$?\s?([0-9]{1,3}(?:,[0-9]{3})*|\d+)(?:\.\d{2})?/g;

    const dates = [...fullText.matchAll(dateRegex)].map((m) => m[0]);
    const money = [...fullText.matchAll(moneyRegex)].map((m) => m[0]);

    const effectiveDate = dates[0];
    const expirationDate = dates[1];

    const generalLiabLimit = parseMoney(money[0]);
    const autoLiabLimit = parseMoney(money[1]);
    const umbrellaLimit = parseMoney(money[2]);

    const holderLine = lines.find((l) =>
      l.toLowerCase().includes("certificate holder")
    );

    // Extraer algunos key-value si están disponibles
    let producer: string | undefined;
    let insuredName: string | undefined;
    if (res.Blocks) {
      const keyBlocks = res.Blocks.filter(
        (b) => b.BlockType === "KEY_VALUE_SET" && b.EntityTypes?.includes("KEY")
      );
      for (const kb of keyBlocks) {
        const keyText = this.getText(kb, res.Blocks || []);
        const valBlockIds = kb.Relationships?.find(
          (r) => r.Type === "VALUE"
        )?.Ids;
        const valText = valBlockIds
          ?.map((id) =>
            this.getText(res.Blocks?.find((b) => b.Id === id), res.Blocks || [])
          )
          .join(" ");
        if (!keyText) continue;
        const k = keyText.toLowerCase();
        if (k.includes("producer")) producer = normalize(valText);
        if (k.includes("insured")) insuredName = normalize(valText);
      }
    }

    const fields: Record<string, any> = {
      insuredName,
      producer,
      effectiveDate,
      expirationDate,
      generalLiabLimit,
      autoLiabLimit,
      umbrellaLimit,
      certificateHolder: holderLine ? normalize(holderLine) : undefined,
    };

    const baseKeys = [
      "insuredName",
      "producer",
      "effectiveDate",
      "expirationDate",
      "certificateHolder",
    ];
    let score = baseKeys.filter((k) => fields[k]).length;
    if (fields.generalLiabLimit) score += 1;
    if (fields.autoLiabLimit) score += 1;
    if (fields.umbrellaLimit) score += 1;
    const confidence = Math.min(1, score / (baseKeys.length + 3));

    return {
      fields,
      confidence,
      raw: { engine: "textract", bucket, key, fullText },
    };
  }

  /** Helper para reconstruir texto de un Block (WORD / LINE) **/
  private getText(block?: Block, blocks: Block[] = []): string {
    if (!block) return "";
    if (block.Text) return block.Text;
    if (!block.Relationships) return "";
    let out = "";
    for (const rel of block.Relationships) {
      if (rel.Type === "CHILD") {
        for (const id of rel.Ids || []) {
          const child = blocks.find((b) => b.Id === id);
          if (child?.BlockType === "WORD" && child.Text) {
            out += child.Text + " ";
          }
        }
      }
    }
    return normalize(out);
  }
}
