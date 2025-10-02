import { Injectable, Logger } from "@nestjs/common";
import * as twilio from "twilio"

@Injectable()
export class NotificationsService {
  private logger = new Logger(NotificationsService.name);
  private client: twilio.Twilio | null = null;
  private from = process.env.TWILIO_FROM_NUMBER || "";

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) this.client = twilio(sid, token);
    else this.logger.warn("Twilio not configured; SMS disabled");
  }

  normalizePhone(raw?: string | null) {
    if (!raw) return null;
    const trimmed = raw.replace(/\s+/g, "");
    if (trimmed.startsWith("+")) return trimmed;
    const cc = process.env.DEFAULT_SMS_COUNTRY_CODE || "+1";
    return cc + trimmed.replace(/[^0-9]/g, "");
  }

  async sendSms(to: string, message: string) {
    if (!this.client) {
      this.logger.warn("SMS skipped: Twilio client not configured");
      return { skipped: true };
    }
    const toNorm = this.normalizePhone(to);
    if (!toNorm) {
      this.logger.warn("SMS skipped: invalid phone");
      return { skipped: true };
    }
    const res = await this.client.messages.create({
      to: toNorm,
      from: this.from,
      body: message,
    });
    return { sid: res.sid, status: res.status };
  }
}
