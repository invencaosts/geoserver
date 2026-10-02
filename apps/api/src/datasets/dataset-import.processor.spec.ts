import type { Job } from "bullmq";
import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { DatasetImportProcessor } from "./dataset-import.processor";

describe("DatasetImportProcessor", () => {
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
