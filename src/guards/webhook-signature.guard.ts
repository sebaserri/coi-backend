import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req: any = context.switchToHttp().getRequest();
    const headers = req.headers || {};
    const rawBody: Buffer = req.rawBody || Buffer.from("", "utf8");

    const sendgridSig = headers["x-twilio-email-event-webhook-signature"];
    const sendgridTs = headers["x-twilio-email-event-webhook-timestamp"];
    const postmarkSig = headers["x-postmark-signature"];

    if (sendgridSig && sendgridTs) {
      const secret = process.env.SENDGRID_INBOUND_SIGNING_SECRET;
      if (!secret) {
        this.logger.warn(
          "SENDGRID_INBOUND_SIGNING_SECRET no configurado; permito paso."
        );
        return true;
      }
      const payload = `${sendgridTs}${rawBody.toString("utf8")}`;
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64");
      const ok = safeEqual(hmac, sendgridSig as string);
      if (!ok) this.logger.warn("Firma SendGrid inválida");
      return ok;
    }

    if (postmarkSig) {
      const token = process.env.POSTMARK_WEBHOOK_TOKEN;
      if (!token) {
        this.logger.warn(
          "POSTMARK_WEBHOOK_TOKEN no configurado; permito paso."
        );
        return true;
      }
      const hmac = crypto
        .createHmac("sha256", token)
        .update(rawBody)
        .digest("base64");
      const ok = safeEqual(hmac, postmarkSig as string);
      if (!ok) this.logger.warn("Firma Postmark inválida");
      return ok;
    }

    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
