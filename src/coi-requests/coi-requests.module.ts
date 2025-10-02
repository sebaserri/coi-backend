import { Module } from "@nestjs/common";
import { FilesModule } from "src/files/files.module";
import { PrismaModule } from "src/prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CoiRequestsController } from "./coi-requests.controller";
import { CoiRequestsService } from "./coi-requests.service";
import { SecurityModule } from "src/security/security.module";

@Module({
  imports: [PrismaModule, NotificationsModule, FilesModule, SecurityModule],
  controllers: [CoiRequestsController],
  providers: [CoiRequestsService],
  exports: [CoiRequestsService],
})
export class CoiRequestsModule {}
