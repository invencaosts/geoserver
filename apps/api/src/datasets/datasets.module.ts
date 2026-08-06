import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DatasetsService, DATASET_IMPORT_QUEUE } from "./datasets.service";
import { DatasetsController } from "./datasets.controller";
import { DatasetImportProcessor } from "./dataset-import.processor";

@Module({
  imports: [BullModule.registerQueue({ name: DATASET_IMPORT_QUEUE })],
  providers: [DatasetsService, DatasetImportProcessor],
  controllers: [DatasetsController],
  exports: [DatasetsService],
})
export class DatasetsModule {}
