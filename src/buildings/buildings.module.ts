import { Module } from "@nestjs/common";
import { BuildingsService } from "./buildings.service";
import { BuildingsController } from "./buildings.controller";

@Module({ providers: [BuildingsService], controllers: [BuildingsController] })
export class BuildingsModule {}
