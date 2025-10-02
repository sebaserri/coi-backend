import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BrokersService } from "./brokers.service";
import { BrokerApiUploadDto, BrokerOkResponse } from "./dto";
import { WebhookSignatureGuard } from "../guards/webhook-signature.guard";

@ApiTags("Brokers")
@Controller("brokers")
export class BrokersController {
  constructor(private readonly svc: BrokersService) {}

  @Post("email-in")
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  @ApiOperation({ summary: "Webhook de email entrante (SendGrid/Postmark)" })
  @ApiResponse({ status: 200, type: BrokerOkResponse })
  @ApiHeader({
    name: "X-Twilio-Email-Event-Webhook-Signature",
    required: false,
    description: "Firma SendGrid (si aplica)",
  })
  @ApiHeader({
    name: "X-Twilio-Email-Event-Webhook-Timestamp",
    required: false,
    description: "Timestamp SendGrid (si aplica)",
  })
  @ApiHeader({
    name: "X-Postmark-Signature",
    required: false,
    description: "Firma Postmark (si aplica)",
  })
  async emailIn(@Headers() headers: any, @Body() body: any) {
    await this.svc.handleEmailIn(body, headers);
    return { ok: true };
  }

  @Post("api/upload")
  @HttpCode(200)
  @ApiOperation({ summary: "Ingesta por API (brokers)" })
  @ApiHeader({ name: "X-API-Key", required: true })
  @ApiBody({ type: BrokerApiUploadDto })
  @ApiResponse({ status: 200, type: BrokerOkResponse })
  async apiUpload(
    @Headers("x-api-key") key: string,
    @Body() body: BrokerApiUploadDto
  ) {
    if (key !== process.env.BROKER_API_KEY)
      return { ok: false, error: "Unauthorized" };
    await this.svc.handleApiUpload(body);
    return { ok: true };
  }
}
