import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationHooks } from "../notifications/hooks";

function daysBetween(target: Date, from: Date) {
  const A = new Date(target).setHours(0,0,0,0);
  const B = new Date(from).setHours(0,0,0,0);
  return Math.ceil((A - B) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class AlertsService {
  private logger = new Logger(AlertsService.name);
  constructor(
    private prisma: PrismaService,
    private sms: NotificationsService,
    private hooks: NotificationHooks,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async coisExpiring() {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const cois = await this.prisma.cOI.findMany({
      where: {
        expirationDate: { gte: now, lte: in30 },
        status: { in: ["PENDING", "APPROVED"] as any },
      },
      include: { vendor: true, building: true },
    });

    for (const c of cois) {
      if (!c.expirationDate) continue;
      const d = daysBetween(c.expirationDate, now);
      if (![30, 15, 7].includes(d)) continue;
      const tag = `D${d}`;
      const phone = c.vendor?.contactPhone;
      if (!phone) continue;

      const existingSms = await this.prisma.notificationLog
        .findUnique({
          where: { coiId_kind_tag: { coiId: c.id, kind: "SMS_EXPIRY", tag } },
        })
        .catch(() => null);
      if (existingSms) {
        this.logger.debug(`Skip duplicate SMS for COI ${c.id} [${tag}]`);
        continue;
      }

      const msg = `Aviso: el COI de ${c.vendor.legalName} para ${
        c.building.name
      } vence en ${d} días (el ${new Date(
        c.expirationDate
      ).toLocaleDateString()}). Por favor sube la renovación.`;
      try {
        await this.sms.sendSms(phone, msg);
        await this.prisma.notificationLog.create({
          data: { coiId: c.id, kind: "SMS_EXPIRY", tag },
        });
        this.logger.log(`SMS sent to ${phone} for COI ${c.id} [${tag}]`);

        const existingEmail = await this.prisma.notificationLog.findUnique({
          where: { coiId_kind_tag: { coiId: c.id, kind: 'EMAIL_EXPIRY', tag } },
        }).catch(() => null);
        if (!existingEmail) {
          const vendorEmail = c.vendor.contactEmail || (c.vendor as any).email;
          const vendorName = c.vendor.legalName;
          const buildingName = c.building.name;

          if (!c.expirationDate) continue;
          const iso = c.expirationDate.toISOString().slice(0, 10);
          try {
            await this.hooks.onCoiExpiry(vendorEmail, vendorName, buildingName, d, iso);
            await this.prisma.notificationLog.create({
              data: { coiId: c.id, kind: 'EMAIL_EXPIRY', tag },
            });
          } catch (e) {
            this.logger.error(`Email expiry failed for COI ${c.id}: ${e}`);
          }
        }        
      } catch (e) {
        this.logger.error(`SMS failed to ${phone} for COI ${c.id}: ${e}`);
      }
    }
  }
}
