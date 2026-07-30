import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { parseSpatialFile } from "./geo-parsers";
import { DATASET_IMPORT_QUEUE } from "./datasets.service";

@Processor(DATASET_IMPORT_QUEUE)
export class DatasetImportProcessor extends WorkerHost {
  private readonly logger = new Logger(DatasetImportProcessor.name);

  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {
    super();
  }

  async process(job: Job<{ datasetId: string }>) {
    const { datasetId } = job.data;
    const dataset = await this.prisma.dataset.findUniqueOrThrow({ where: { id: datasetId } });

    try {
      const buffer = await this.minio.getBuffer(dataset.storageKey!);
      const { features, geomType } = await parseSpatialFile(buffer, dataset.formato);

      for (const feature of features) {
        await this.prisma.$executeRaw`
          INSERT INTO features (id, "datasetId", geom, properties, "createdAt")
          VALUES (
            ${randomUUID()},
            ${datasetId},
            ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}), 4326),
            ${JSON.stringify(feature.properties)}::jsonb,
            now()
          )
        `;
      }

      await this.prisma.dataset.update({
        where: { id: datasetId },
        data: {
          status: "active",
          registros: features.length,
          tipoGeometria: geomType,
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao importar dataset ${datasetId}`, err as Error);
      await this.prisma.dataset.update({
        where: { id: datasetId },
        data: { status: "error", erro: (err as Error).message },
      });
    }
  }
}
