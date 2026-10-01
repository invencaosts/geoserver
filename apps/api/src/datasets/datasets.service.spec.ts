import { NotFoundException } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { DatasetsService } from "./datasets.service";

function dataset(storageKey: string | null = "datasets/ds-1/pontos.geojson") {
  return { id: "ds-1", nome: "Pontos", formato: "GeoJSON", status: "active", storageKey };
}

describe("DatasetsService.remove", () => {
  let service: DatasetsService;
  let prisma: {
    dataset: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  };
  let minio: { delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { dataset: { findUnique: vi.fn(), delete: vi.fn() } };
    minio = { delete: vi.fn().mockResolvedValue(undefined) };
    service = new DatasetsService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
      { add: vi.fn() } as unknown as Queue,
    );
  });

  it("exclui o registro e o arquivo do MinIO", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());

    await expect(service.remove("ds-1")).resolves.toEqual({ success: true });

    expect(prisma.dataset.delete).toHaveBeenCalledWith({ where: { id: "ds-1" } });
    expect(minio.delete).toHaveBeenCalledWith("datasets/ds-1/pontos.geojson");
  });

  it("não chama o MinIO quando o dataset não tem arquivo", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset(null));

    await service.remove("ds-1");

    expect(minio.delete).not.toHaveBeenCalled();
  });

  it("conclui a exclusão mesmo se o MinIO falhar", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());
    minio.delete.mockRejectedValue(new Error("MinIO indisponível"));

    await expect(service.remove("ds-1")).resolves.toEqual({ success: true });
    expect(prisma.dataset.delete).toHaveBeenCalled();
  });

  it("não remove o arquivo se o dataset não existir", async () => {
    prisma.dataset.findUnique.mockResolvedValue(null);

    await expect(service.remove("ds-x")).rejects.toBeInstanceOf(NotFoundException);
    expect(minio.delete).not.toHaveBeenCalled();
  });
});
