import { Module } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  providers: [AlertsService],
})
export class AlertsModule {}
