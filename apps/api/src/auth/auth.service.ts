import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { AuthUser } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

function toAuthUser(user: {
  id: string;
  nome: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
}): AuthUser {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role as AuthUser["role"],
    status: user.status as AuthUser["status"],
    avatarUrl: user.avatarUrl,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("E-mail já cadastrado");

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const isFirstUser = (await this.prisma.user.count()) === 0;

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        // primeiro usuário do sistema vira admin automaticamente
        role: isFirstUser ? "admin" : (dto.role ?? "leitor"),
      },
    });

    return this.buildSession(toAuthUser(user));
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("Credenciais inválidas");
    if (user.status === "inativo") throw new UnauthorizedException("Usuário inativo");

    const valid = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!valid) throw new UnauthorizedException("Credenciais inválidas");

    return this.buildSession(toAuthUser(user));
  }

  private buildSession(user: AuthUser) {
    const token = this.jwt.sign({ sub: user.id, role: user.role });
    return { user, token };
  }
}
