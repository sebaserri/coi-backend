import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({ providers: [AuditService], controllers: [AuditController] })
export class AuditModule {}
