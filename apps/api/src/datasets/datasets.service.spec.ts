import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { DatasetsService, MAP_FEATURE_LIMIT } from "./datasets.service";
import { LEGACY_VALIDATED_CASE_SCHEMA_VERSION, type AuthUser } from "@geo/shared";
import { DatasetsController } from "./datasets.controller";
import { PERMISSIONS_KEY } from "../common/permissions.decorator";

const admin: AuthUser = {
  id: "admin-1",
  nome: "Admin",
  email: "admin@test.local",
  role: "admin",
  status: "ativo",
};

function dataset(storageKey: string | null = "datasets/ds-1/pontos.geojson") {
  return {
    id: "ds-1",
    nome: "Pontos",
    formato: "GeoJSON",
    status: "active",
    storageKey,
    visibility: "restrito",
    createdById: admin.id,
    caseId: null,
  };
}

describe("DatasetsService.remove", () => {
  let service: DatasetsService;
  let prisma: {
    dataset: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    case: { findUnique: ReturnType<typeof vi.fn> };
  };
  let minio: { delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      dataset: { findUnique: vi.fn(), delete: vi.fn() },
      case: { findUnique: vi.fn() },
    };
    minio = { delete: vi.fn().mockResolvedValue(undefined) };
    service = new DatasetsService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
      { add: vi.fn() } as unknown as Queue,
    );
  });

  it("exclui o registro e o arquivo do MinIO", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());

    await expect(service.remove("ds-1", admin)).resolves.toEqual({ success: true });

    expect(prisma.dataset.delete).toHaveBeenCalledWith({ where: { id: "ds-1" } });
    expect(minio.delete).toHaveBeenCalledWith("datasets/ds-1/pontos.geojson");
  });

  it("não chama o MinIO quando o dataset não tem arquivo", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset(null));

    await service.remove("ds-1", admin);

    expect(minio.delete).not.toHaveBeenCalled();
  });

  it("conclui a exclusão mesmo se o MinIO falhar", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());
    minio.delete.mockRejectedValue(new Error("MinIO indisponível"));

    await expect(service.remove("ds-1", admin)).resolves.toEqual({ success: true });
    expect(prisma.dataset.delete).toHaveBeenCalled();
  });

  it("não remove o arquivo se o dataset não existir", async () => {
    prisma.dataset.findUnique.mockResolvedValue(null);

    await expect(service.remove("ds-x", admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(minio.delete).not.toHaveBeenCalled();
  });

  it("invalida o aceite ao remover dataset vinculado de um rascunho", async () => {
    prisma.dataset.findUnique.mockResolvedValue({ ...dataset(), caseId: "case-1" });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    (prisma as any).$transaction = vi.fn((operation: any) =>
      operation({ dataset: prisma.dataset, case: { updateMany } }),
    );

    await service.remove("ds-1", admin);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "case-1", status: "rascunho" },
      data: expect.objectContaining({
        declarationAccepted: false,
        declarationContentHash: null,
        revision: { increment: 1 },
      }),
    });
  });

  it("não expõe a chave interna de armazenamento na API", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());

    const result = await service.findOne("ds-1", admin);

    expect(result).not.toHaveProperty("storageKey");
  });

  it("oculta dataset restrito de visitante anônimo", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());

    await expect(service.findOne("ds-1", undefined)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("não libera dataset restrito de outro autor apenas pelo papel de download", async () => {
    prisma.dataset.findUnique.mockResolvedValue(dataset());
    const researcher: AuthUser = {
      ...admin,
      id: "researcher-1",
      role: "pesquisador_envio_download",
    };

    await expect(service.findOne("ds-1", researcher)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("oculta até dataset público quando o caso vinculado restringe divulgação", async () => {
    prisma.dataset.findUnique.mockResolvedValue({
      ...dataset(),
      visibility: "publico",
      caseId: "case-1",
    });
    prisma.case.findUnique.mockResolvedValue({
      status: "validado",
      contribution: {
        grauPublicidadeInformacoes: "publico",
        possuiRestricaoDivulgacao: true,
      },
    });

    await expect(service.findOne("ds-1", undefined)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("preserva leitura de dataset público ligado a caso validado legado", async () => {
    prisma.dataset.findUnique.mockResolvedValue({
      ...dataset(),
      visibility: "publico",
      caseId: "case-legacy",
    });
    prisma.case.findUnique.mockResolvedValue({
      status: "validado",
      formSchemaVersion: LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
      contribution: null,
    });

    await expect(service.findOne("ds-1", undefined)).resolves.toMatchObject({ id: "ds-1" });
  });

  it("não aprova publicação quando o caso vinculado restringe divulgação", async () => {
    const restricted = {
      ...dataset(),
      requestedPublic: true,
      caseId: "case-1",
    };
    prisma.dataset.findUnique.mockResolvedValue(restricted);
    prisma.case.findUnique.mockResolvedValue({
      status: "validado",
      contribution: {
        grauPublicidadeInformacoes: "acesso_restrito",
        possuiRestricaoDivulgacao: true,
      },
    });

    await expect(service.reviewPublication("ds-1", true, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("não aprova nova publicação em caso legado mesmo com contribuição parcial pública", async () => {
    prisma.dataset.findUnique.mockResolvedValue({
      ...dataset(),
      requestedPublic: true,
      caseId: "case-legacy",
    });
    prisma.case.findUnique.mockResolvedValue({
      status: "validado",
      formSchemaVersion: LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
      contribution: {
        grauPublicidadeInformacoes: "publico",
        possuiRestricaoDivulgacao: false,
      },
    });

    await expect(service.reviewPublication("ds-1", true, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("DatasetsService.getMapFeatures", () => {
  it("limita a quantidade de feições devolvidas ao mapa", async () => {
    const rows = Array.from({ length: MAP_FEATURE_LIMIT + 1 }, (_, index) => ({
      id: `feature-${index}`,
      properties: {},
      geometry: '{"type":"Point","coordinates":[0,0]}',
    }));
    const prisma = {
      dataset: { findUnique: vi.fn().mockResolvedValue(dataset()) },
      case: { findUnique: vi.fn() },
      $queryRaw: vi.fn().mockResolvedValue(rows),
    };
    const service = new DatasetsService(
      prisma as unknown as PrismaService,
      {} as MinioService,
      { add: vi.fn() } as unknown as Queue,
    );

    const result = await service.getMapFeatures("ds-1", admin);

    expect(result.features).toHaveLength(MAP_FEATURE_LIMIT);
    expect(result).toMatchObject({
      preview: true,
      generalized: true,
      truncated: true,
      limit: MAP_FEATURE_LIMIT,
    });
    expect(result.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {},
    });
    expect(result.features[0]).not.toHaveProperty("id");
  });
});

describe("DatasetsService.getFeatures", () => {
  it("recusa paginação de feições para papel sem data:export", async () => {
    const prisma = {
      dataset: { findUnique: vi.fn() },
      case: { findUnique: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const service = new DatasetsService(
      prisma as unknown as PrismaService,
      {} as MinioService,
      { add: vi.fn() } as unknown as Queue,
    );
    const sender: AuthUser = { ...admin, role: "pesquisador_envio" };

    await expect(service.getFeatures("ds-1", 1, 50, sender)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.dataset.findUnique).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("não exporta dataset restrito de outro autor mesmo para papel com data:export", async () => {
    const prisma = {
      dataset: { findUnique: vi.fn().mockResolvedValue(dataset()) },
      case: { findUnique: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const service = new DatasetsService(
      prisma as unknown as PrismaService,
      {} as MinioService,
      { add: vi.fn() } as unknown as Queue,
    );
    const downloader: AuthUser = {
      ...admin,
      id: "downloader-1",
      role: "pesquisador_envio_download",
    };

    await expect(service.getFeatures("ds-1", 1, 50, downloader)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("DatasetsController RBAC", () => {
  it("reserva feições paginadas à permissão de exportação e mantém só a prévia no mapa", () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DatasetsController.prototype.getFeatures)).toEqual([
      "data:export",
    ]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DatasetsController.prototype.getMapFeatures),
    ).toEqual(["dataset:read"]);
  });
});

describe("DatasetsService.create", () => {
  it("não permite que verificador vincule dataset pelo endpoint do autor", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      case: {
        findUnique: vi.fn().mockResolvedValue({
          createdById: "author-1",
          status: "rascunho",
        }),
      },
      dataset: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const minio = { upload: vi.fn(), delete: vi.fn() };
    const service = new DatasetsService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
      { add: vi.fn() } as unknown as Queue,
    );
    const buffer = Buffer.from('{"type":"FeatureCollection","features":[]}');
    const file = {
      originalname: "dados.geojson",
      buffer,
      size: buffer.length,
    } as Express.Multer.File;

    await expect(
      service.create({ nome: "Dados do caso", caseId: "case-1" }, file, {
        ...admin,
        role: "verificador",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.dataset.create).not.toHaveBeenCalled();
    expect(minio.upload).not.toHaveBeenCalled();
  });
});
