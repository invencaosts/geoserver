import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
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
import {
  DatasetMapConfigDto,
  DatasetMapFeaturesQueryDto,
  DatasetClusterQueryDto,
} from "./dto/dataset-map-query.dto";
import type { Response } from "express";

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
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization")
  @RequirePermissions("data:export")
  getMapFeatures(
    @Param("id") id: string,
    @Query() query: DatasetMapFeaturesQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.datasetsService.getMapFeatures(id, user, query);
  }

  @Get(":id/map-metadata")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization")
  @RequirePermissions("dataset:read")
  getMapMetadata(@Param("id") id: string, @CurrentUser() user?: AuthUser) {
    return this.datasetsService.getMapMetadata(id, user);
  }

  @Get(":id/map-features/:featureId")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization")
  @RequirePermissions("dataset:read")
  getMapFeature(
    @Param("id") id: string,
    @Param("featureId") featureId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.datasetsService.getMapFeature(id, featureId, user);
  }

  @Get(":id/map-cluster-features")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization")
  @RequirePermissions("dataset:read")
  getMapClusterFeatures(
    @Param("id") id: string,
    @Query() query: DatasetClusterQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.datasetsService.getMapClusterFeatures(id, query, user);
  }

  @Get(":id/tiles/:z/:x/:y.mvt")
  @RequirePermissions("dataset:read")
  async getMapTile(
    @Param("id") id: string,
    @Param("z", ParseIntPipe) z: number,
    @Param("x", ParseIntPipe) x: number,
    @Param("y", ParseIntPipe) y: number,
    @CurrentUser() user: AuthUser | undefined,
    @Res() response: Response,
  ) {
    const tile = await this.datasetsService.getMapTile(id, z, x, y, user);
    response.setHeader("Content-Type", "application/vnd.mapbox-vector-tile");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Vary", "Authorization");
    response.send(tile);
  }

  @Patch(":id/map-config")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization")
  @RequirePermissions("dataset:write")
  configureMap(
    @Param("id") id: string,
    @Body() patch: DatasetMapConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.datasetsService.configureMap(id, patch, user);
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
