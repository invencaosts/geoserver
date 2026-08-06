import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@geo/shared";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.notificationsService.findForUser(user.id);
  }

  @Get("nao-lidas/count")
  countUnread(@CurrentUser() user: AuthUser) {
    return this.notificationsService.countUnread(user.id);
  }

  @Patch("lidas")
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(":id/lida")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user.id);
  }
}
