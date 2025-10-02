import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import * as crypto from "crypto";

@Injectable()
export class FilesService {
  private s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
  });

  private bucket = process.env.S3_BUCKET || "";
  private publicPrefix = process.env.S3_PUBLIC_URL_PREFIX;

  async presign(mime = 'application/pdf') {
    const maxMb = Number(process.env.MAX_FILE_MB || 10);
    const maxBytes = maxMb * 1024 * 1024;
    const key = `uploads/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.pdf`;

    const bucket = process.env.S3_BUCKET as string;
    return createPresignedPost(this.s3, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 0, maxBytes],
        ["starts-with", "$Content-Type", "application/pdf"],
      ],
      Fields: {
        key,
        "Content-Type": mime || "application/pdf",
      },
      Expires: 3600,
    });
  }

    async uploadBuffer(buf: Buffer, contentType = "application/octet-stream", ext = ".bin") {
    if (!this.bucket) throw new Error("S3_BUCKET no configurado");
    const key = `uploads/${new Date().getFullYear()}/${this.rand()}${ext}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }));
    const url = this.publicPrefix
      ? `${this.publicPrefix.replace(/\/$/, "")}/${key}`
      : `s3://${this.bucket}/${key}`;
    return { bucket: this.bucket, key, url };
  }

  private rand(len = 16) {
    return crypto.randomBytes(len).toString("hex");
  }
}
