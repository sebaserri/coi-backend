import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface JwtUser {
  id: string;
  role: "ADMIN" | "VENDOR" | "GUARD";
  vendorId?: string;
  email?: string;
  name?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
