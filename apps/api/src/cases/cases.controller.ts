import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CasesService } from "./cases.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { ReviewDocumentPublicationDto, UploadCaseDocumentDto } from "./dto/create-case.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import { UpdateCaseStatusDto } from "./dto/update-case-status.dto";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "@geo/shared";
import { ATTACHMENT_MAX_BYTES } from "../common/upload-validation";
import type { Response } from "express";

@Controller("cases")
@UseGuards(OptionalJwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @RequirePermissions("case:read")
  findAll(@Query() query: ListCasesQueryDto, @CurrentUser() user?: AuthUser) {
    return this.casesService.findAll(query, user);
  }

  @Get("map")
  @RequirePermissions("case:read")
  findMapPoints() {
    return this.casesService.findMapPoints();
  }

  @Get("dashboard")
  @RequirePermissions("case:read")
  getDashboard(@CurrentUser() user?: AuthUser) {
    return this.casesService.getDashboard(user);
  }

  @Get("options")
  @RequirePermissions("case:read")
  listOptions(@Query("categoria") categoria?: string) {
    return this.casesService.listOptions(categoria);
  }

  @Get(":id")
  @RequirePermissions("case:read")
  findOne(@Param("id") id: string, @CurrentUser() user?: AuthUser) {
    return this.casesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("case:create")
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthUser) {
    return this.casesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("case:create")
  updateDraft(@Param("id") id: string, @Body() dto: UpdateCaseDto, @CurrentUser() user: AuthUser) {
    return this.casesService.updateDraft(id, dto, user);
  }

  @Post(":id/submit")
  @RequirePermissions("case:create")
  submit(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.casesService.submit(id, user);
  }

  @Post(":id/documents")
  @RequirePermissions("case:create")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 } }),
  )
  uploadDocument(
    @Param("id") id: string,
    @Body() dto: UploadCaseDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.casesService.uploadDocument(id, dto, file, user);
  }

  @Get(":id/documents/:documentId/download")
  @RequirePermissions("case:read")
  async downloadDocument(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.casesService.downloadDocument(id, documentId, user);
    response.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.nome)}`,
      "Cache-Control": "private, no-store",
    });
    return new StreamableFile(document.buffer);
  }

  @Patch(":id/documents/:documentId/publication")
  @RequirePermissions("case:validate")
  reviewDocumentPublication(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Body() dto: ReviewDocumentPublicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.casesService.reviewDocumentPublication(id, documentId, dto.approved, user);
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
