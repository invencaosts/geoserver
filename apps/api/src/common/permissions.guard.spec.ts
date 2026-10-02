import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthUser, Permission, RoleName } from "@geo/shared";
import { PermissionsGuard } from "./permissions.guard";

const completeProfile = {
  onboardingProfile: {
    municipio: "Salvador",
    estado: "BA",
    escolaridade: "superior",
    perfilUsuario: "pesquisador",
    possuiVinculo: false,
    comoConheceu: "internet",
    finalidadeAcesso: "pesquisa",
  },
  researcherProfile: {
    emailProfissional: "pesquisa@example.test",
    telefoneWhatsapp: "71999999999",
    instituicaoNome: "Universidade",
    instituicaoCnpj: "12345678000190",
    instituicaoEmail: "contato@example.test",
    tipoVinculo: "servidor",
    cargoFuncao: "Pesquisadora",
    estadoAtuacao: "BA",
    municipioAtuacao: "Salvador",
    perfilProfissional: "docente",
    nivelFormacao: "doutorado",
    finalidadeUso: "pesquisa",
  },
};

function check(required: Permission[], role?: RoleName, profile: unknown = completeProfile) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const user: AuthUser | undefined = role
    ? { id: "u1", nome: "U", email: "u@example.test", role, status: "ativo" }
    : undefined;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(profile) },
  } as unknown as PrismaService;
  return () => new PermissionsGuard(reflector, prisma).canActivate(context);
}

describe("PermissionsGuard", () => {
  it("libera leitura para visitante anônimo", async () => {
    await expect(check(["case:read"])()).resolves.toBe(true);
  });

  it("pede login quando o anônimo tenta enviar ou baixar", async () => {
    await expect(check(["case:create"])()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(check(["data:export"])()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("visualizador logado não envia nem baixa", async () => {
    await expect(check(["dataset:write"], "visualizador")()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(check(["data:export"], "visualizador")()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("pesquisador de envio envia mas não baixa", async () => {
    await expect(check(["dataset:write"], "pesquisador_envio")()).resolves.toBe(true);
    await expect(check(["case:create"], "pesquisador_envio")()).resolves.toBe(true);
    await expect(check(["data:export"], "pesquisador_envio")()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("pesquisador de envio e download envia e baixa", async () => {
    await expect(check(["dataset:write"], "pesquisador_envio_download")()).resolves.toBe(true);
    await expect(check(["data:export"], "pesquisador_envio_download")()).resolves.toBe(true);
    await expect(check(["case:validate"], "pesquisador_envio_download")()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("verificador define pesquisadores mas não gerencia usuários", async () => {
    await expect(check(["user:assign_researcher"], "verificador")()).resolves.toBe(true);
    await expect(check(["user:manage"], "verificador")()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("bloqueia ações de pesquisador legado incompleto sem bloquear leitura", async () => {
    await expect(check(["case:create"], "pesquisador_envio", null)()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(check(["case:read"], "pesquisador_envio", null)()).resolves.toBe(true);
  });
});
