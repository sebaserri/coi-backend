import { Module } from "@nestjs/common";
import { AccessService } from "./access.service";
import { AccessController } from "./access.controller";

@Module({
  providers: [AccessService],
  controllers: [AccessController],
})
export class AccessModule {}
