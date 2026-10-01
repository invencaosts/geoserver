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
import { CasesService } from "./cases.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import { UpdateCaseStatusDto } from "./dto/update-case-status.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "@geo/shared";
import { ATTACHMENT_MAX_BYTES } from "../common/upload-validation";

@Controller("cases")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @RequirePermissions("case:read")
  findAll(@Query() query: ListCasesQueryDto, @CurrentUser() user: AuthUser) {
    return this.casesService.findAll(query, user);
  }

  @Get("map")
  @RequirePermissions("case:read")
  findMapPoints() {
    return this.casesService.findMapPoints();
  }

  @Get("dashboard")
  @RequirePermissions("case:read")
  getDashboard() {
    return this.casesService.getDashboard();
  }

  @Get(":id")
  @RequirePermissions("case:read")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.casesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("case:create")
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthUser) {
    return this.casesService.create(dto, user);
  }

  @Post(":id/anexo")
  @RequirePermissions("case:create")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 } }),
  )
  uploadAnexo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.casesService.uploadAnexo(id, file, user);
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
