import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { TimelineService, type TimelineModo } from "./timeline.service";
import { CreateTimelineEventDto } from "./dto/create-timeline-event.dto";
import { UpdateTimelineEventDto } from "./dto/update-timeline-event.dto";

@Controller("timeline")
export class TimelineController {
  constructor(private timelineService: TimelineService) {}

  @Get()
  get(@Query("modo") modo?: string, @Query("estados") estados?: string) {
    const modoValido: TimelineModo = modo === "nacional" || modo === "estadual" ? modo : "todos";
    const estadosList = estados
      ? estados
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : [];
    return this.timelineService.getTimeline(modoValido, estadosList);
  }

  @Get("estados")
  estados() {
    return this.timelineService.listEstados();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("timeline:manage")
  listAdmin() {
    return this.timelineService.listAdmin();
  }

  @Post("admin")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("timeline:manage")
  @UseInterceptors(FileInterceptor("file"))
  createAdmin(@Body() dto: CreateTimelineEventDto, @UploadedFile() file?: Express.Multer.File) {
    return this.timelineService.createAdmin(dto, file);
  }

  @Patch("admin/:id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("timeline:manage")
  @UseInterceptors(FileInterceptor("file"))
  updateAdmin(
    @Param("id") id: string,
    @Body() dto: UpdateTimelineEventDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.timelineService.updateAdmin(id, dto, file);
  }

  @Delete("admin/:id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("timeline:manage")
  removeAdmin(@Param("id") id: string) {
    return this.timelineService.removeAdmin(id);
  }
}
