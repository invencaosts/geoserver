import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AuthUser, Permission, RoleName } from "@geo/shared";
import { PermissionsGuard } from "./permissions.guard";

function check(required: Permission[], role?: RoleName) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const user: AuthUser | undefined = role
    ? { id: "u1", nome: "U", email: "u@example.test", role, status: "ativo" }
    : undefined;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return () => new PermissionsGuard(reflector).canActivate(context);
}

describe("PermissionsGuard", () => {
  it("libera leitura para visitante anônimo", () => {
    expect(check(["case:read"])()).toBe(true);
  });

  it("pede login quando o anônimo tenta enviar ou baixar", () => {
    expect(check(["case:create"])).toThrow(UnauthorizedException);
    expect(check(["data:export"])).toThrow(UnauthorizedException);
  });

  it("visualizador logado não envia nem baixa", () => {
    expect(check(["dataset:write"], "visualizador")).toThrow(ForbiddenException);
    expect(check(["data:export"], "visualizador")).toThrow(ForbiddenException);
  });

  it("pesquisador de envio envia mas não baixa", () => {
    expect(check(["dataset:write"], "pesquisador_envio")()).toBe(true);
    expect(check(["case:create"], "pesquisador_envio")()).toBe(true);
    expect(check(["data:export"], "pesquisador_envio")).toThrow(ForbiddenException);
  });

  it("pesquisador de envio e download envia e baixa", () => {
    expect(check(["dataset:write"], "pesquisador_envio_download")()).toBe(true);
    expect(check(["data:export"], "pesquisador_envio_download")()).toBe(true);
    expect(check(["case:validate"], "pesquisador_envio_download")).toThrow(ForbiddenException);
  });

  it("verificador define pesquisadores mas não gerencia usuários", () => {
    expect(check(["user:assign_researcher"], "verificador")()).toBe(true);
    expect(check(["user:manage"], "verificador")).toThrow(ForbiddenException);
  });
});
