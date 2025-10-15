import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccessModule } from "./access/access.module";
import { AlertsModule } from "./alerts/alerts.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BuildingsModule } from "./buildings/buildings.module";
import { CoiRequestsModule } from "./coi-requests/coi-requests.module";
import { CoisModule } from "./cois/cois.module";
import { ExtractModule } from "./extract/extract.module";
import { FilesModule } from "./files/files.module";
import { HealthModule } from "./health/health.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RequirementsModule } from "./requirements/requirements.module";
import { SecurityModule } from "./security/security.module";
import { UsersModule } from "./users/users.module";
import { VendorsModule } from "./vendors/vendors.module";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 10, limit: 10 }]),
    HealthModule,
    PrismaModule,
    AuthModule,
    AuditModule,
    UsersModule,
    BuildingsModule,
    VendorsModule,
    RequirementsModule,
    CoisModule,
    FilesModule,
    NotificationsModule,
    AlertsModule,
    AccessModule,
    CoiRequestsModule,
    ExtractModule,
    SecurityModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
