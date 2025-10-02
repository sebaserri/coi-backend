import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, Logger } from "@nestjs/common";
import * as path from "path";

const NodeClam = require("clamscan");

function envBool(name: string, def = false) {
  const v = process.env[name];
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

@Injectable()
export class AntivirusService {
  private logger = new Logger(AntivirusService.name);
  private s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  private enabled = envBool("AV_ENABLED", false);
  private maxMb = Number(process.env.MAX_FILE_MB || 10);
  private clam: any | null = null;

  private async getClam() {
    if (!this.enabled) return null;
    if (this.clam) return this.clam;
    const clamscan = await new NodeClam().init({
      removeInfected: false,
      quarantineInfected: false,
      debugMode: false,
      scanLog: null,
      clamdscan: {
        socket: "/var/run/clamd.scan/clamd.sock",
        timeout: 120000,
        localFallback: true,
      },
    });
    this.clam = clamscan;
    return this.clam;
  }

  async assertPdfAndSize(bucket: string, key: string) {
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    const size = head.ContentLength || 0;
    const maxBytes = this.maxMb * 1024 * 1024;
    if (size > maxBytes)
      throw new Error(`File too large: ${size} > ${maxBytes}`);
    const ct = (head.ContentType || "").toLowerCase();
    const ext = path.extname(key).toLowerCase();
    const isPdf = ct.includes("application/pdf") || ext === ".pdf";
    if (!isPdf) throw new Error(`Invalid content-type/ext: ${ct} ${ext}`);
  }

  async scanS3Object(bucket: string, key: string) {
    if (!this.enabled) return { clean: true, engine: "disabled" };
    await this.assertPdfAndSize(bucket, key);
    const clam = await this.getClam();
    const obj = await this.s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const stream = obj.Body as any;
    const { isInfected, viruses } = await clam.scanStream(stream);
    if (isInfected) {
      this.logger.warn(
        `Infected file detected: s3://${bucket}/${key} -> ${viruses}`
      );
      return { clean: false, viruses };
    }
    return { clean: true, engine: "clamav" };
  }
}
