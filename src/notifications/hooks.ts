import { Injectable } from '@nestjs/common';
import { EmailService } from './email.service';
import { tplCoiRequestLink, tplCoiRejected, tplCoiExpiry } from './templates';

@Injectable()
export class NotificationHooks {
  constructor(private email: EmailService) {}

  async onCoiRequestCreated(vendorEmail: string, vendorName: string, token: string) {
    await this.email.send(vendorEmail, 'Solicitud de COI', tplCoiRequestLink(vendorName, token));
  }

  async onCoiRejected(vendorEmail: string, vendorName: string, coiId: string, reason: string) {
    await this.email.send(vendorEmail, 'COI Rechazado', tplCoiRejected(vendorName, coiId, reason));
  }

  async onCoiExpiry(vendorEmail: string, vendorName: string, buildingName: string, days: number, iso: string) {
    await this.email.send(vendorEmail, 'Aviso de vencimiento de COI', tplCoiExpiry(vendorName, buildingName, days, iso));
  }
}
