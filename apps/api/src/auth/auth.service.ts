import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { AuthUser } from "@geo/shared";
import { Prisma } from "@prisma/client";
import { createHash, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeCpfOrCnpj, normalizeEmail } from "../common/normalize-identifiers";
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
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if ((this.config.get<string>("REGISTRATION_ENABLED") ?? "true").toLowerCase() !== "true") {
      throw new ForbiddenException("Novos cadastros estão temporariamente desativados");
    }

    return this.createAccount(dto, "visualizador");
  }

  async bootstrapAdmin(dto: RegisterDto, suppliedSecret?: string) {
    const expectedSecret = this.config.get<string>("ADMIN_BOOTSTRAP_SECRET")?.trim();
    const expectedDigest = createHash("sha256")
      .update(expectedSecret ?? "")
      .digest();
    const suppliedDigest = createHash("sha256")
      .update(suppliedSecret ?? "")
      .digest();
    if (
      !expectedSecret ||
      expectedSecret.length < 32 ||
      !timingSafeEqual(expectedDigest, suppliedDigest)
    ) {
      throw new ForbiddenException("Bootstrap administrativo indisponível");
    }
    return this.createAccount(dto, "admin", true);
  }

  private async createAccount(dto: RegisterDto, role: "admin" | "visualizador", bootstrap = false) {
    const email = normalizeEmail(dto.email);
    const cpf = normalizeCpfOrCnpj(dto.cpf);
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    try {
      const user = await this.prisma.$transaction(
        async (tx) => {
          if (bootstrap) {
            // Serializa todas as tentativas, inclusive quando há mais de uma instância da API.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bootstrap-admin'))`;
          }
          if (bootstrap && (await tx.user.count({ where: { role: "admin" } })) > 0) {
            throw new ConflictException("O administrador inicial já foi configurado");
          }
          return tx.user.create({
            data: {
              nome: dto.nome.trim(),
              nomeSocial: dto.nomeSocial?.trim(),
              email,
              cpf,
              senhaHash,
              role,
              onboardingProfile: {
                create: {
                  municipio: dto.municipio.trim(),
                  estado: dto.estado.trim().toUpperCase(),
                  escolaridade: dto.escolaridade,
                  perfilUsuario: dto.perfilUsuario,
                  perfilUsuarioOutro:
                    dto.perfilUsuario === "outro" ? dto.perfilUsuarioOutro?.trim() : undefined,
                  possuiVinculo: dto.possuiVinculo,
                  instituicaoCnpj:
                    dto.possuiVinculo && dto.instituicaoCnpj
                      ? normalizeCpfOrCnpj(dto.instituicaoCnpj)
                      : undefined,
                  instituicaoNome: dto.possuiVinculo ? dto.instituicaoNome?.trim() : undefined,
                  instituicaoEmail:
                    dto.possuiVinculo && dto.instituicaoEmail
                      ? normalizeEmail(dto.instituicaoEmail)
                      : undefined,
                  tipoVinculo: dto.possuiVinculo ? dto.tipoVinculo : undefined,
                  tipoVinculoOutro:
                    dto.possuiVinculo && dto.tipoVinculo === "outro"
                      ? dto.tipoVinculoOutro?.trim()
                      : undefined,
                  comoConheceu: dto.comoConheceu,
                  comoConheceuOutro:
                    dto.comoConheceu === "outro" ? dto.comoConheceuOutro?.trim() : undefined,
                  finalidadeAcesso: dto.finalidadeAcesso,
                  finalidadeAcessoOutro:
                    dto.finalidadeAcesso === "outro"
                      ? dto.finalidadeAcessoOutro?.trim()
                      : undefined,
                },
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.buildSession(toAuthUser(user));
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : "";
        throw new ConflictException(
          fields.includes("cpf") ? "CPF já cadastrado" : "E-mail já cadastrado",
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });
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
