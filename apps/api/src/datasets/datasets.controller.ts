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
import { DatasetsService } from "./datasets.service";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { DATASET_MAX_BYTES } from "../common/upload-validation";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "@geo/shared";
import { CreateDatasetDto, ReviewDatasetPublicationDto } from "./dto/create-dataset.dto";
import { ListDatasetFeaturesQueryDto } from "./dto/list-dataset-features-query.dto";

@Controller("datasets")
@UseGuards(OptionalJwtAuthGuard, PermissionsGuard)
export class DatasetsController {
  constructor(private datasetsService: DatasetsService) {}

  @Get()
  @RequirePermissions("dataset:read")
  findAll(@CurrentUser() user?: AuthUser) {
    return this.datasetsService.findAll(user);
  }

  @Get(":id")
  @RequirePermissions("dataset:read")
  findOne(@Param("id") id: string, @CurrentUser() user?: AuthUser) {
    return this.datasetsService.findOne(id, user);
  }

  @Get(":id/features")
  @RequirePermissions("data:export")
  getFeatures(
    @Param("id") id: string,
    @Query() query: ListDatasetFeaturesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.datasetsService.getFeatures(id, query.page, query.pageSize, user);
  }

  @Get(":id/export")
  @RequirePermissions("data:export")
  exportGeoJson(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.datasetsService.exportGeoJson(id, user);
  }

  @Get(":id/map-features")
  @RequirePermissions("dataset:read")
  getMapFeatures(@Param("id") id: string, @CurrentUser() user?: AuthUser) {
    return this.datasetsService.getMapFeatures(id, user);
  }

  @Post()
  @RequirePermissions("dataset:write")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: DATASET_MAX_BYTES, files: 1 } }))
  create(
    @Body() dto: CreateDatasetDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.datasetsService.create(dto, file, user);
  }

  @Delete(":id")
  @RequirePermissions("dataset:delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.datasetsService.remove(id, user);
  }

  @Patch(":id/publication")
  @RequirePermissions("case:validate")
  reviewPublication(
    @Param("id") id: string,
    @Body() dto: ReviewDatasetPublicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.datasetsService.reviewPublication(id, dto.approved, user);
  }
}
