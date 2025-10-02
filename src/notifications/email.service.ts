import { Injectable, Logger } from "@nestjs/common";
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private logger = new Logger(EmailService.name);
  private provider: 'sendgrid' | 'stub' = 'stub';

  constructor() {
    const key = process.env.SENDGRID_API_KEY;
    if (key && key.startsWith('SG.')) {
      this.provider = 'sendgrid';
      sgMail.setApiKey(key);
    } else {
      this.logger.warn('SENDGRID_API_KEY ausente o inválida; usando modo STUB (no se envían emails reales).');
      this.provider = 'stub';
    }
  }

  async send(to: string, subject: string, html: string) {
    if (this.provider === 'stub') {
      this.logger.log(`(stub) email → ${to} [${subject}]`);
      return { ok: true, skipped: true };
    }
    await sgMail.send({ to, from: process.env.SENDGRID_FROM!, subject, html });
    this.logger.log(`Email sent to ${to}: ${subject}`);
    return { ok: true };
  }
}
