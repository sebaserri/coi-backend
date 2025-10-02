import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BuildingsService {
  constructor(private prisma: PrismaService) {}
  list() {
    return this.prisma.building.findMany();
  }
  create(data: { name: string; address: string }) {
    return this.prisma.building.create({ data });
  }
}
