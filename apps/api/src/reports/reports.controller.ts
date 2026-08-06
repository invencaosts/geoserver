import { Controller, Get, Header, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { CaseStatus } from "@geo/shared";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";

@Controller("reports")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get("casos/csv")
  @RequirePermissions("case:read")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="casos.csv"')
  casosCsv(
    @Query("status") status?: CaseStatus,
    @Query("municipio") municipio?: string,
    @Query("tipo") tipo?: string,
  ) {
    return this.reportsService.casosCsv({ status, municipio, tipo });
  }

  @Get("casos/pdf")
  @RequirePermissions("case:read")
  async casosPdf(
    @Query("status") status: CaseStatus | undefined,
    @Query("municipio") municipio: string | undefined,
    @Query("tipo") tipo: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const doc = await this.reportsService.casosPdf({ status, municipio, tipo });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="casos.pdf"',
    });
    return new StreamableFile(doc);
  }

  @Get("datasets/csv")
  @RequirePermissions("dataset:read")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="datasets.csv"')
  datasetsCsv() {
    return this.reportsService.datasetsCsv();
  }

  @Get("datasets/pdf")
  @RequirePermissions("dataset:read")
  async datasetsPdf(@Res({ passthrough: true }) res: Response) {
    const doc = await this.reportsService.datasetsPdf();
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="datasets.pdf"',
    });
    return new StreamableFile(doc);
  }
}
