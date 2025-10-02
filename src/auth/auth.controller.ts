import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, AuthToken } from "./dto";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Registro de usuario" })
  @ApiResponse({ status: 201, type: AuthToken })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login" })
  @ApiResponse({ status: 200, type: AuthToken })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
