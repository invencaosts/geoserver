import {
  Body,
  Controller,
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
import type { CaseStatus } from "@geo/shared";
import { CasesService } from "./cases.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { UpdateCaseStatusDto } from "./dto/update-case-status.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "@geo/shared";

@Controller("cases")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @RequirePermissions("case:read")
  findAll(
    @Query("status") status?: CaseStatus,
    @Query("municipio") municipio?: string,
    @Query("tipo") tipo?: string,
  ) {
    return this.casesService.findAll({ status, municipio, tipo });
  }

  @Get("dashboard")
  @RequirePermissions("case:read")
  getDashboard() {
    return this.casesService.getDashboard();
  }

  @Get(":id")
  @RequirePermissions("case:read")
  findOne(@Param("id") id: string) {
    return this.casesService.findOne(id);
  }

  @Post()
  @RequirePermissions("case:create")
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthUser) {
    return this.casesService.create(dto, user);
  }

  @Post(":id/anexo")
  @RequirePermissions("case:create")
  @UseInterceptors(FileInterceptor("file"))
  uploadAnexo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.casesService.uploadAnexo(id, file);
  }

  @Patch(":id/status")
  @RequirePermissions("case:validate")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateCaseStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.casesService.updateStatus(id, dto, user);
  }
}
