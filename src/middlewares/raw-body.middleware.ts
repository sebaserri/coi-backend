import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request & { rawBody?: Buffer }, res: Response, next: () => void) {
    if (!req.rawBody && (req as any)._body && (req as any).body) {
      try {
        const str = JSON.stringify((req as any).body);
        req.rawBody = Buffer.from(str, "utf8");
      } catch {
        req.rawBody = Buffer.from("", "utf8");
      }
    }
    next();
  }
}
