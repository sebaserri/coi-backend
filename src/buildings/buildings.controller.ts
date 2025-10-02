import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { BuildingsService } from "./buildings.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CreateBuildingDto, BuildingDto } from "./dto";
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags("Buildings")
@ApiBearerAuth()
@Controller("buildings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BuildingsController {
  constructor(private svc: BuildingsService) {}
  @Get()
  @ApiOperation({ summary: "Listar edificios" })
  @ApiResponse({ status: 200, type: [BuildingDto] })
  list() {
    return this.svc.list();
  }
  @Post()
  @ApiOperation({ summary: "Crear edificio" })
  @ApiResponse({ status: 201, type: BuildingDto })
  create(@Body() body: CreateBuildingDto) {
    return this.svc.create(body);
  }
}
