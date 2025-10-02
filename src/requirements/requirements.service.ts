import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RequirementsService {
  constructor(private prisma: PrismaService) {}
  list(buildingId: string) {
    return this.prisma.requirementTemplate.findMany({ where: { buildingId } });
  }
  create(buildingId: string, data: any) {
    return this.prisma.requirementTemplate.create({
      data: { ...data, buildingId },
    });
  }
}
