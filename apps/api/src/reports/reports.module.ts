import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { CasesModule } from "../cases/cases.module";
import { DatasetsModule } from "../datasets/datasets.module";

@Module({
  imports: [CasesModule, DatasetsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
