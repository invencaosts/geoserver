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
import { PrismaService } from "../prisma/prisma.service";
import { onboardingProfileIsComplete, researcherProfileIsComplete } from "./profile-completeness";

const RESEARCHER_PROFILE_GATED_PERMISSIONS = new Set<Permission>([
  "case:create",
  "dataset:write",
  "data:export",
]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    const role = user?.role ?? ANONYMOUS_ROLE;

    const allowed = required.every((p) => hasPermission(role, p));
    if (allowed) {
      if (
        user?.role.startsWith("pesquisador_") &&
        required.some((permission) => RESEARCHER_PROFILE_GATED_PERMISSIONS.has(permission))
      ) {
        const profile = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { onboardingProfile: true, researcherProfile: true },
        });
        const institutionalRequired = user.role === "pesquisador_envio_download";
        if (
          !onboardingProfileIsComplete(profile?.onboardingProfile) ||
          !researcherProfileIsComplete(profile?.researcherProfile, institutionalRequired)
        ) {
          throw new ForbiddenException(
            "Complete seu cadastro e perfil profissional antes de enviar ou baixar dados",
          );
        }
      }
      return true;
    }

    if (!user) throw new UnauthorizedException("Faça login para continuar");
    throw new ForbiddenException(
      `Papel "${user.role}" não tem permissão para: ${required.join(", ")}`,
    );
  }
}
