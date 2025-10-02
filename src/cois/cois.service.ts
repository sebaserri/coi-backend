import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCoiDto } from "./dto";
import { NotificationHooks } from "../notifications/hooks";

type ReviewPayload = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes?: string;
  flags?: { additionalInsured?: boolean; waiverOfSubrogation?: boolean };
};

@Injectable()
export class CoisService {
  constructor(private prisma: PrismaService, private hooks: NotificationHooks) {}

  list(filter: any) {
    return this.prisma.cOI.findMany({
      where: {
        buildingId: filter.buildingId || undefined,
        status: filter.status || undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { files: true, vendor: true, building: true },
    });
  }

  async create(dto: CreateCoiDto) {
    return this.prisma.cOI.create({
      data: {
        vendorId: dto.vendorId,
        buildingId: dto.buildingId,
        insuredName: dto.insuredName,
        producer: dto.producer,
        generalLiabLimit: dto.generalLiabLimit,
        autoLiabLimit: dto.autoLiabLimit,
        umbrellaLimit: dto.umbrellaLimit,
        workersComp: dto.workersComp,
        additionalInsured: dto.additionalInsured,
        waiverOfSubrogation: dto.waiverOfSubrogation,
        certificateHolder: dto.certificateHolder,
        effectiveDate: new Date(dto.effectiveDate),
        expirationDate: new Date(dto.expirationDate),
        files: dto.files
          ? {
              create: dto.files.map((f) => ({
                url: f.url,
                kind: f.kind as any,
              })),
            }
          : undefined,
      },
      include: { files: true },
    });
  }

  get(id: string) {
    return this.prisma.cOI.findUnique({
      where: { id },
      include: { files: true, vendor: true, building: true },
    });
  }

  async review(id: string, body: ReviewPayload, actorId?: string) {
    const data: any = {
      status: body.status as any,
      notes: body.notes,
    };
    if (body.flags?.additionalInsured !== undefined) {
      data.additionalInsured = body.flags.additionalInsured;
    }
    if (body.flags?.waiverOfSubrogation !== undefined) {
      data.waiverOfSubrogation = body.flags.waiverOfSubrogation;
    }

    const coi = await this.prisma.cOI.update({
      where: { id },
      data,
      include: { files: true, vendor: true, building: true },
    });

    if (body.status === 'REJECTED') {
      try {
        const email = coi.vendor?.contactEmail || (coi.vendor as any)?.email;
        const name = coi.vendor?.legalName || 'Proveedor';
        await this.hooks.onCoiRejected(email, name, coi.id, body.notes || '');
      } catch {}
    }
    await this.prisma.auditLog
      .create({
        data: {
          entity: "COI",
          entityId: id,
          action:
            body.status === "APPROVED"
              ? "REVIEW.APPROVED"
              : body.status === "REJECTED"
              ? "REVIEW.REJECTED"
              : "REVIEW.UPDATE",
          actorId: actorId || "system",
          details: body.notes || null,
        },
      })
      .catch(() => {});

    return coi;
  }
}
