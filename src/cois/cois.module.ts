import { Module } from "@nestjs/common";
import { CoisController } from "./cois.controller";
import { CoisService } from "./cois.service";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SecurityModule } from "../security/security.module";

@Module({
  imports: [PrismaModule, NotificationsModule, SecurityModule],
  controllers: [CoisController],
  providers: [CoisService],
})
export class CoisModule {}
