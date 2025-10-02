import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { HealthService } from "./health.service";

class HealthDb {
  ok: boolean;
  latencyMs?: number;
}

class HealthCheckResponse {
  ok: boolean;
  uptimeSec: number;
  version?: string;
  now?: string;
  db?: HealthDb;
}

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly svc: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Healthcheck de la API y dependencias" })
  @ApiResponse({ status: 200, type: HealthCheckResponse })
  @ApiServiceUnavailableResponse({
    description: "Service Unavailable (alguna dependencia caída)",
    type: HealthCheckResponse,
  })
  async get() {
    const res = await this.svc.check();
    if (!res.ok) throw new ServiceUnavailableException(res);
    return res;
  }
}
