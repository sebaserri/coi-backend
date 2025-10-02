import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BrokerApiUploadFileDto {
  @ApiPropertyOptional({
    example: "https://s3.amazonaws.com/bucket/uploads/abc.pdf",
  })
  url?: string;

  @ApiPropertyOptional({ description: "Binario base64 si no hay URL" })
  base64?: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  contentType?: string;

  @ApiPropertyOptional({ example: "abc.pdf" })
  filename?: string;

  @ApiProperty({ example: "CERTIFICATE", enum: ["CERTIFICATE", "ENDORSEMENT"] })
  kind: "CERTIFICATE" | "ENDORSEMENT";
}

export class BrokerApiUploadDto {
  @ApiProperty({ example: "v_123" })
  vendorId: string;

  @ApiProperty({ example: "b_123" })
  buildingId: string;

  @ApiProperty({ type: [BrokerApiUploadFileDto] })
  files: BrokerApiUploadFileDto[];
}

export class BrokerOkResponse {
  @ApiProperty({ example: true }) ok: boolean;
  @ApiProperty({ required: false }) error?: string;
}
