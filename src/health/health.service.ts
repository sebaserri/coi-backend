import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  private s3() {
    return new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    });
  }

  async check() {
    const checks: any = { db: 'unknown', s3: 'unknown', sms: 'unknown' };
    let ok = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'fail';
      ok = false;
    }

    try {
      const bucket = process.env.S3_BUCKET;
      if (bucket) {
        await this.s3().send(new HeadBucketCommand({ Bucket: bucket }));
        checks.s3 = 'ok';
      } else {
        checks.s3 = 'not_configured';
      }
    } catch {
      checks.s3 = 'fail';
      ok = false;
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    checks.sms = (sid && token && from) ? 'configured' : 'not_configured';

    return {
      ok,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
