import type { Job } from "bullmq";
import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { DatasetImportProcessor } from "./dataset-import.processor";

describe("DatasetImportProcessor", () => {
  it("grava feições em lotes, preserva projeção e mantém publicação restrita", async () => {
    const dataset = {
      id: "dataset-batch",
      status: "processing",
      formato: "GeoJSON",
      storageKey: "origem.geojson",
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      dataset: { findUniqueOrThrow: vi.fn().mockResolvedValue(dataset), update: vi.fn() },
      feature: { deleteMany: vi.fn() },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const prisma = {
      dataset: { findUniqueOrThrow: vi.fn().mockResolvedValue(dataset), updateMany: vi.fn() },
      $transaction: vi.fn(async (operation: (transaction: typeof tx) => Promise<void>) =>
        operation(tx),
      ),
    };
    const features = Array.from({ length: 501 }, (_, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-40, -10] },
      properties: { nome: `Feição ${index}`, numero: index },
    }));
    const minio = {
      getBuffer: vi
        .fn()
        .mockResolvedValue(Buffer.from(JSON.stringify({ type: "FeatureCollection", features }))),
    };
    const processor = new DatasetImportProcessor(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
    );
    await processor.process({ data: { datasetId: dataset.id } } as Job<{ datasetId: string }>);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    const firstSql = tx.$executeRaw.mock.calls[0][0] as { values: unknown[] };
    expect(firstSql.values).toContain(JSON.stringify(features[0].properties));
    expect(firstSql.values).toContain(JSON.stringify(features[0].geometry));
    expect(tx.dataset.update).toHaveBeenCalledWith({
      where: { id: dataset.id },
      data: {
        status: "active",
        registros: 501,
        tipoGeometria: "Point",
        projecaoOriginal: "EPSG:4326",
        erro: null,
      },
    });
    expect((tx.dataset.update.mock.calls[0][0] as { data: unknown }).data).not.toHaveProperty(
      "visibility",
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 180_000,
      maxWait: 10_000,
    });
  });

  it("trata job repetido de dataset ativo como idempotente", async () => {
    const prisma = {
      dataset: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "dataset-1",
          status: "active",
          storageKey: "datasets/dataset-1/origem.geojson",
        }),
      },
    };
    const minio = { getBuffer: vi.fn() };
    const processor = new DatasetImportProcessor(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
    );

    await processor.process({ data: { datasetId: "dataset-1" } } as Job<{
      datasetId: string;
    }>);

    expect(minio.getBuffer).not.toHaveBeenCalled();
  });

  it("não permite que uma falha tardia sobrescreva o status active", async () => {
    const prisma = {
      dataset: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "dataset-1",
          status: "processing",
          storageKey: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const processor = new DatasetImportProcessor(
      prisma as unknown as PrismaService,
      {} as MinioService,
    );

    await expect(
      processor.process({ data: { datasetId: "dataset-1" } } as Job<{ datasetId: string }>),
    ).rejects.toThrow("Dataset sem arquivo de origem");
    expect(prisma.dataset.updateMany).toHaveBeenCalledWith({
      where: { id: "dataset-1", status: { not: "active" } },
      data: { status: "error", erro: "Dataset sem arquivo de origem" },
    });
  });
});
