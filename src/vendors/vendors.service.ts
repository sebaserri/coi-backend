import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}
  create(data: { legalName: string; contactEmail: string }) {
    return this.prisma.vendor.create({ data });
  }
  get(id: string) {
    return this.prisma.vendor.findUnique({ where: { id } });
  }
  setPhone(id: string, phone: string) {
    return this.prisma.vendor.update({
      where: { id },
      data: { contactPhone: phone },
    });
  }

  async search(q: string) {
    return this.prisma.vendor.findMany({
      where: { legalName: { contains: q, mode: "insensitive" } },
      select: { id: true, legalName: true, contactPhone: true },
      take: 10,
    });
  }
}
