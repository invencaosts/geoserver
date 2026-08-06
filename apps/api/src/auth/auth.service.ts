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
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException("E-mail já cadastrado");

    const existingCpf = await this.prisma.user.findUnique({ where: { cpf: dto.cpf } });
    if (existingCpf) throw new ConflictException("CPF já cadastrado");

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const isFirstUser = (await this.prisma.user.count()) === 0;
    const requestedRole = dto.role ?? "leitor";

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        nomeSocial: dto.nomeSocial,
        email: dto.email,
        cpf: dto.cpf,
        senhaHash,
        // primeiro usuário do sistema vira admin automaticamente
        role: isFirstUser ? "admin" : "leitor",
        requestedRole: isFirstUser ? "admin" : requestedRole,
        // acesso além de "leitor" precisa validação de usuário com role superior
        roleApprovalStatus: isFirstUser || requestedRole === "leitor" ? "aprovado" : "pendente",
        perfilContribuidor: dto.perfilContribuidor,
        quemRepresenta: dto.quemRepresenta,
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
