import { IsEmail, MinLength, IsOptional, IsString, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @MinLength(6) password: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) role: Role;
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vendorId?: string;
}
export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @MinLength(6) password: string;
}
export class AuthToken { @ApiProperty() access_token: string; }
