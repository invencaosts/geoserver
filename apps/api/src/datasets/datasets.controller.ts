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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";

@Controller("datasets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @RequirePermissions("dataset:read")
  exportGeoJson(@Param("id") id: string) {
    return this.datasetsService.exportGeoJson(id);
  }

  @Post()
  @RequirePermissions("dataset:write")
  @UseInterceptors(FileInterceptor("file"))
  create(@Body("nome") nome: string, @UploadedFile() file: Express.Multer.File) {
    return this.datasetsService.create(nome, file);
  }

  @Delete(":id")
  @RequirePermissions("dataset:delete")
  remove(@Param("id") id: string) {
    return this.datasetsService.remove(id);
  }
}
