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
    if (dataset.status === "active") return;

    try {
      if (!dataset.storageKey) throw new Error("Dataset sem arquivo de origem");
      const buffer = await this.minio.getBuffer(dataset.storageKey!);
      const { features, geomType } = await parseSpatialFile(buffer, dataset.formato);

      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM datasets WHERE id = ${datasetId} FOR UPDATE`;
        const current = await tx.dataset.findUniqueOrThrow({
          where: { id: datasetId },
          select: { status: true },
        });
        // Jobs BullMQ são pelo menos uma vez; um retry tardio não regrava um import concluído.
        if (current.status === "active") return;
        await tx.feature.deleteMany({ where: { datasetId } });
        for (const feature of features) {
          await tx.$executeRaw`
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

        await tx.dataset.update({
          where: { id: datasetId },
          data: {
            status: "active",
            registros: features.length,
            tipoGeometria: geomType,
            erro: null,
          },
        });
      });
    } catch (err) {
      this.logger.error(`Falha ao importar dataset ${datasetId}`, err as Error);
      await this.prisma.dataset.updateMany({
        where: { id: datasetId, status: { not: "active" } },
        data: { status: "error", erro: (err as Error).message },
      });
      throw err;
    }
  }
}
