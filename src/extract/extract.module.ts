import { Module } from "@nestjs/common";
import { ExtractService } from "./extract.service";
import { ExtractController } from "./extract.controller";

@Module({
  providers: [ExtractService],
  controllers: [ExtractController],
})
export class ExtractModule {}
