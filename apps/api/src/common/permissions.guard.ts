import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ANONYMOUS_ROLE, hasPermission, type AuthUser, type Permission } from "@geo/shared";
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
    const role = user?.role ?? ANONYMOUS_ROLE;

    const allowed = required.every((p) => hasPermission(role, p));
    if (allowed) return true;

    if (!user) throw new UnauthorizedException("Faça login para continuar");
    throw new ForbiddenException(
      `Papel "${user.role}" não tem permissão para: ${required.join(", ")}`,
    );
  }
}
