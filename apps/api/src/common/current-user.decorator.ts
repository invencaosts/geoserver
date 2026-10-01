import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "@geo/shared";

// Em rotas com OptionalJwtAuthGuard o valor é undefined para visitantes anônimos.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
