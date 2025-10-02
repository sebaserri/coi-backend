import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto, LoginDto } from "./dto";
import { JwtService } from "@nestjs/jwt";
import * as argon from "argon2";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException("Email already registered");

    const hash = await argon.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        role: dto.role,
        vendorId: dto.vendorId,
      },
    });

    return this.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      vendorId: user.vendorId ?? undefined,
      name: user.name ?? undefined,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException("Invalid credentials");
    const ok = await argon.verify(user.password, dto.password);
    if (!ok) throw new BadRequestException("Invalid credentials");

    return this.sign({
      sub: user.id,
      email: user.email,
      role: user.role as any,
      vendorId: user.vendorId ?? undefined,
      name: user.name ?? undefined,
    });
  }

  private async sign(payload: {
    sub: string;
    email: string;
    role: "ADMIN" | "VENDOR" | "GUARD" | string;
    vendorId?: string;
    name?: string;
  }) {
    const token = await this.jwt.signAsync(payload);
    return { access_token: token };
  }
}
