import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

@Controller("datasets")
@UseGuards(OptionalJwtAuthGuard, PermissionsGuard)
export class DatasetsController {
  constructor(private datasetsService: DatasetsService) {}

  @Get()
  @RequirePermissions("dataset:read")
  findAll() {
    return this.datasetsService.findAll();
  }

  @Get(":id")
  @RequirePermissions("dataset:read")
  findOne(@Param("id") id: string) {
    return this.datasetsService.findOne(id);
  }

  @Get(":id/features")
  @RequirePermissions("dataset:read")
  getFeatures(
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.datasetsService.getFeatures(id, Number(page) || 1, Number(pageSize) || 50);
  }

  @Get(":id/export")
  @RequirePermissions("data:export")
  exportGeoJson(@Param("id") id: string) {
    return this.datasetsService.exportGeoJson(id);
  }

  @Post()
  @RequirePermissions("dataset:write")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: DATASET_MAX_BYTES, files: 1 } }))
  create(@Body("nome") nome: string, @UploadedFile() file: Express.Multer.File) {
    return this.datasetsService.create(nome, file);
  }

  @Delete(":id")
  @RequirePermissions("dataset:delete")
  remove(@Param("id") id: string) {
    return this.datasetsService.remove(id);
  }
}
