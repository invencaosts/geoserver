import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import type { DatasetFormat } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";

const EXT_TO_FORMAT: Record<string, DatasetFormat> = {
  zip: "Shapefile",
  geojson: "GeoJSON",
  json: "GeoJSON",
  kml: "KML",
  csv: "CSV",
};

export const DATASET_IMPORT_QUEUE = "dataset-import";

@Injectable()
export class DatasetsService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    @InjectQueue(DATASET_IMPORT_QUEUE) private importQueue: Queue,
  ) {}

  findAll() {
    return this.prisma.dataset.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const dataset = await this.prisma.dataset.findUnique({ where: { id } });
    if (!dataset) throw new NotFoundException("Dataset não encontrado");
    return dataset;
  }

  async create(nome: string, file: Express.Multer.File) {
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    const formato = EXT_TO_FORMAT[ext];
    if (!formato) {
      throw new Error(
        `Extensão .${ext} não suportada. Use .zip (shapefile), .geojson, .kml ou .csv`,
      );
    }

    const dataset = await this.prisma.dataset.create({
      data: {
        nome,
        formato,
        tipoGeometria: "Point",
        status: "processing",
      },
    });

    const storageKey = `datasets/${dataset.id}/${file.originalname}`;
    await this.minio.upload(storageKey, file.buffer, file.mimetype);

    await this.prisma.dataset.update({
      where: { id: dataset.id },
      data: { storageKey },
    });

    await this.importQueue.add("import", { datasetId: dataset.id });

    return this.findOne(dataset.id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.dataset.delete({ where: { id } });
    return { success: true };
  }

  async getFeatures(datasetId: string, page = 1, pageSize = 50) {
    await this.findOne(datasetId);
    const offset = (page - 1) * pageSize;
    const rows = await this.prisma.$queryRaw<
      { id: string; properties: unknown; geometry: string }[]
    >`
      SELECT id, properties, ST_AsGeoJSON(geom) as geometry
      FROM features
      WHERE "datasetId" = ${datasetId}
      ORDER BY id
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return rows.map((r) => ({
      id: r.id,
      properties: r.properties,
      geometry: JSON.parse(r.geometry),
    }));
  }

  async exportGeoJson(datasetId: string) {
    await this.findOne(datasetId);
    const rows = await this.prisma.$queryRaw<
      { id: string; properties: unknown; geometry: string }[]
    >`
      SELECT id, properties, ST_AsGeoJSON(geom) as geometry
      FROM features
      WHERE "datasetId" = ${datasetId}
    `;
    return {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: JSON.parse(r.geometry),
        properties: r.properties,
      })),
    };
  }

  static generateFeatureId() {
    return randomUUID();
  }
}
