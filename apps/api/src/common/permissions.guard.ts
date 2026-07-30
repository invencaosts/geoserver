import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission, type AuthUser, type Permission } from "@geo/shared";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;

    if (!user) throw new ForbiddenException("Não autenticado");

    const allowed = required.every((p) => hasPermission(user.role, p));
    if (!allowed) {
      throw new ForbiddenException(
        `Papel "${user.role}" não tem permissão para: ${required.join(", ")}`,
      );
    }
    return true;
  }
}
