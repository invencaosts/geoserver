import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ApproveRoleDto } from "./dto/approve-role.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "@geo/shared";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequirePermissions("user:manage")
  findAll() {
    return this.usersService.findAll();
  }

  @Get("me")
  getOwnProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.findOne(user.id);
  }

  @Patch("me")
  updateOwnProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post("me/avatar")
  @UseInterceptors(FileInterceptor("file"))
  updateOwnAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.updateAvatar(user.id, file);
  }

  @Patch(":id")
  @RequirePermissions("user:manage")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(":id/approval")
  @RequirePermissions("user:manage")
  approveRole(@Param("id") id: string, @Body() dto: ApproveRoleDto) {
    return this.usersService.approveRole(id, dto.decision);
  }
}
