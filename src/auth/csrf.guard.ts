import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { CSRF_COOKIE, CSRF_HEADER } from "./auth.constants";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    // Solo en mutaciones (POST/PATCH/PUT/DELETE). GET no requiere CSRF.
    if (
      !["POST", "PATCH", "PUT", "DELETE"].includes(
        (req.method || "").toUpperCase()
      )
    )
      return true;

    const header = (req.headers[CSRF_HEADER] as string) || "";
    const cookie = req.cookies?.[CSRF_COOKIE] || "";
    if (!header || !cookie || header !== cookie) {
      throw new ForbiddenException("CSRF token mismatch");
    }
    return true;
  }
}
