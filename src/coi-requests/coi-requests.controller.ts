import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { FilesService } from "../files/files.service";
import { PrismaService } from "../prisma/prisma.service";
import { CoiRequestsService } from "./coi-requests.service";
import { PublicSubmitCoiDto } from "./dto";
import { AntivirusService } from "../security/antivirus.service";

class CoiRequestMeta {
  vendor: { id: string; legalName: string };
  building: { id: string; name: string; address: string };
  requirements?: any;
  expiresAt: Date;
}
@ApiTags("CoiRequests (Public)")
@Controller("coi/requests")
export class CoiRequestsController {
  constructor(
    private readonly svc: CoiRequestsService,
    private readonly files: FilesService,
    private readonly prisma: PrismaService,
    private readonly av: AntivirusService
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Crear solicitud (ADMIN)" })
  create(
    @Body() body: { buildingId: string; vendorId: string; ttlHours?: number }
  ) {
    return this.svc.create(
      body.buildingId,
      body.vendorId,
      body.ttlHours ?? 168
    );
  }
  @Get(":token")
  @ApiOperation({ summary: "Meta pública por token" })
  @ApiParam({ name: "token", required: true })
  @ApiResponse({ status: 200, type: CoiRequestMeta })
  async getMeta(@Param("token") token: string) {
    const req = await this.svc.getByToken(token);
    const reqs = await this.prisma.requirementTemplate.findFirst({
      where: { buildingId: req.buildingId, active: true },
    });
    return {
      vendor: { id: req.vendor.id, legalName: req.vendor.legalName },
      building: {
        id: req.building.id,
        name: req.building.name,
        address: req.building.address,
      },
      requirements: reqs,
      expiresAt: req.expiresAt,
    };
  }
  @Get(":token/presign")
  @ApiOperation({ summary: "Presign para subida (público por token)" })
  @ApiParam({ name: "token", required: true })
  @ApiQuery({ name: "mime", required: false, example: "application/pdf" })
  async presign(
    @Param("token") token: string,
    @Query("mime") mime = "application/pdf"
  ) {
    await this.svc.getByToken(token);
    return this.files.presign(mime);
  }
  @Post(":token/submit")
  @ApiOperation({ summary: "Enviar COI (público por token)" })
  @ApiParam({ name: "token", required: true })
  submit(@Param("token") token: string, @Body() body: PublicSubmitCoiDto) {
    return (async () => {
      const req = await this.svc.getByToken(token);
      const bucket = process.env.S3_BUCKET as string;
      if (body.files?.length) {
        for (const f of body.files) {
          const keyFromBucket = (f.url as string).split(`${bucket}/`)[1];
          const keyFromAws = (f.url as string).split('amazonaws.com/')[1];
          const key = keyFromBucket || keyFromAws || f.url;
          const res = await this.av.scanS3Object(bucket, key);
          if (!res.clean) throw new Error('Archivo infectado o inválido');
        }
      }
      const prisma = this.prisma as any;
      const coi = await prisma.cOI.create({
        data: {
          vendorId: req.vendorId,
          buildingId: req.buildingId,
          insuredName: body.insuredName,
          producer: body.producer,
          generalLiabLimit: body.generalLiabLimit,
          autoLiabLimit: body.autoLiabLimit,
          umbrellaLimit: body.umbrellaLimit,
          workersComp: body.workersComp,
          additionalInsured: body.additionalInsured,
          waiverOfSubrogation: body.waiverOfSubrogation,
          certificateHolder: body.certificateHolder,
          effectiveDate: new Date(body.effectiveDate),
          expirationDate: new Date(body.expirationDate),
          files: body.files
            ? {
                create: body.files.map((f: any) => ({
                  url: f.url,
                  kind: f.kind as any,
                })),
              }
            : undefined,
        },
        include: { files: true },
      });
      await this.svc.markUsed(req.id);
      return { ok: true, coiId: coi.id };
    })();
  }
}
