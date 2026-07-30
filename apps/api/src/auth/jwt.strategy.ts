import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET")!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === "inativo") {
      throw new UnauthorizedException("Sessão inválida");
    }
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role as AuthUser["role"],
      status: user.status as AuthUser["status"],
      avatarUrl: user.avatarUrl,
    };
  }
}
