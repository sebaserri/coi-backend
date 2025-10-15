import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto, LoginDto } from "./dto";
import { JwtService } from "@nestjs/jwt";
import { hashPassword, verifyPassword } from "./password.util";
import { EmailService } from "../notifications/email.service";

import { randomToken, hashToken, verifyTokenHash } from "./crypto.util";
import { ACCESS_TTL_MIN, REFRESH_TTL_DAYS } from "./auth.constants";
import { randomBytes } from "crypto";

type Role = "ADMIN" | "VENDOR" | "GUARD";

function makeToken(n = 32) {
  return randomBytes(n).toString("hex");
}
function addHours(h: number) {
  return new Date(Date.now() + h * 3600 * 1000);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService
  ) {}

  private signAccess(payload: {
    sub: string;
    email: string;
    role: Role | string;
    vendorId?: string;
    name?: string;
  }) {
    return this.jwt.signAsync(payload, {
      expiresIn: `${ACCESS_TTL_MIN}m`,
      secret: process.env.JWT_SECRET || "change-me",
    });
  }

  private async issueRefresh(userId: string, ua?: string, ip?: string) {
    const token = randomToken(64);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(
      Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        userAgent: ua?.slice(0, 255),
        ip: ip?.slice(0, 64),
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  private async rotateRefresh(
    oldToken: string,
    userId: string,
    ua?: string,
    ip?: string
  ) {
    // Busca el hash que matchee
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    let matched: (typeof tokens)[number] | null = null;
    for (const t of tokens) {
      const ok = await verifyTokenHash(t.tokenHash, oldToken);
      if (ok) {
        matched = t;
        break;
      }
    }
    if (!matched) throw new ForbiddenException("Invalid refresh");

    // Rotación: revoca el anterior y emite uno nuevo
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });
    return this.issueRefresh(userId, ua, ip);
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new BadRequestException("Email already registered");

    const hash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        role: dto.role,
        vendorId: dto.vendorId,
      },
    });

    await this.issueEmailVerification(
      user.id,
      user.email,
      user.name || undefined
    ).catch(() => {});

    const at = await this.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role as any,
      vendorId: user.vendorId ?? undefined,
      name: user.name ?? undefined,
    });
    const { token: rt } = await this.issueRefresh(user.id);

    return { at, rt, user };
  }

  async login(dto: LoginDto, ua?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new BadRequestException("Invalid credentials");
    const ok = await verifyPassword(user.password, dto.password);
    if (!ok) throw new BadRequestException("Invalid credentials");

    if (!user.emailVerifiedAt)
      throw new BadRequestException("Email not verified");

    const at = await this.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role as any,
      vendorId: user.vendorId ?? undefined,
      name: user.name ?? undefined,
    });

    const { token: rt } = await this.issueRefresh(user.id, ua, ip);
    return { at, rt, user };
  }

  async logout(userId: string, refreshToken: string) {
    // revoca el refresh actual
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    for (const t of tokens) {
      const ok = await verifyTokenHash(t.tokenHash, refreshToken);
      if (ok) {
        await this.prisma.refreshToken.update({
          where: { id: t.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
    return { ok: true };
  }

  async issueEmailVerification(userId: string, email: string, name?: string) {
    const t = await this.prisma.authToken.create({
      data: {
        userId,
        kind: "EMAIL_VERIFY",
        token: makeToken(),
        expiresAt: addHours(48),
      },
    });
    const base = process.env.PUBLIC_APP_URL || "http://localhost:4000";
    const link = `${base}/(auth)/verify-email?token=${t.token}`;
    await this.email.send(
      email,
      "Verifica tu email",
      `
      <p>Hola ${name ?? ""},</p>
      <p>Verificá tu email haciendo clic aquí:</p>
      <p><a href="${link}">${link}</a></p>
    `
    );
    return { ok: true };
  }

  async verifyEmail(tokenStr: string) {
    const t = await this.prisma.authToken.findUnique({
      where: { token: tokenStr },
    });
    if (
      !t ||
      t.kind !== "EMAIL_VERIFY" ||
      t.usedAt ||
      t.expiresAt < new Date()
    ) {
      throw new BadRequestException("Invalid token");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: t.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.authToken.update({
        where: { id: t.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user)
      await this.issueEmailVerification(
        user.id,
        user.email,
        user.name ?? undefined
      );
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // devolver ok siempre para no filtrar existencia
    if (user) {
      const t = await this.prisma.authToken.create({
        data: {
          userId: user.id,
          kind: "PWD_RESET",
          token: makeToken(),
          expiresAt: addHours(2),
        },
      });
      const base = process.env.PUBLIC_APP_URL || "http://localhost:4000";
      const link = `${base}/(auth)/reset-password?token=${t.token}`;
      await this.email.send(
        email,
        "Restablecer contraseña",
        `
        <p>Para restablecer tu contraseña, usa este enlace:</p>
        <p><a href="${link}">${link}</a> (válido por 2 horas)</p>
      `
      );
    }
    return { ok: true };
  }

  async resetPassword(tokenStr: string, password: string) {
    const t = await this.prisma.authToken.findUnique({
      where: { token: tokenStr },
    });
    if (!t || t.kind !== "PWD_RESET" || t.usedAt || t.expiresAt < new Date()) {
      throw new BadRequestException("Invalid token");
    }
    const hash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: t.userId },
        data: { password: hash },
      }),
      this.prisma.authToken.update({
        where: { id: t.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async refresh(
    userId: string,
    refreshToken: string,
    ua?: string,
    ip?: string
  ) {
    const { token: newRt } = await this.rotateRefresh(
      refreshToken,
      userId,
      ua,
      ip
    );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new ForbiddenException("User not found");

    const at = await this.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role as any,
      vendorId: user.vendorId ?? undefined,
      name: user.name ?? undefined,
    });
    return { at, rt: newRt, user };
  }
}
