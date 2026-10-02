import { Controller, Get, Header, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { AuthUser, CaseStatus, CaseTipo } from "@geo/shared";
import { ReportsService } from "./reports.service";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { CurrentUser } from "../common/current-user.decorator";

@Controller("reports")
@UseGuards(OptionalJwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get("casos/csv")
  @RequirePermissions("data:export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="casos.csv"')
  casosCsv(
    @Query("status") status?: CaseStatus,
    @Query("municipio") municipio?: string,
    @Query("tipo") tipo?: CaseTipo,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.reportsService.casosCsv({ status, municipio, tipo }, user!);
  }

  @Get("casos/pdf")
  @RequirePermissions("data:export")
  async casosPdf(
    @Query("status") status: CaseStatus | undefined,
    @Query("municipio") municipio: string | undefined,
    @Query("tipo") tipo: CaseTipo | undefined,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthUser,
  ) {
    const doc = await this.reportsService.casosPdf({ status, municipio, tipo }, user!);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="casos.pdf"',
    });
    return new StreamableFile(doc);
  }

  @Get("datasets/csv")
  @RequirePermissions("data:export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="datasets.csv"')
  datasetsCsv(@CurrentUser() user: AuthUser) {
    return this.reportsService.datasetsCsv(user);
  }

  @Get("datasets/pdf")
  @RequirePermissions("data:export")
  async datasetsPdf(@Res({ passthrough: true }) res: Response, @CurrentUser() user: AuthUser) {
    const doc = await this.reportsService.datasetsPdf(user);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="datasets.pdf"',
    });
    return new StreamableFile(doc);
  }
}
