import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import {
  CASE_FORM_SCHEMA_VERSION,
  hasPermission,
  type AuthUser,
  type DatasetFormat,
} from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { validateDatasetUpload } from "../common/upload-validation";
import type { CreateDatasetDto } from "./dto/create-dataset.dto";
import { canReadDataset, datasetAccessWhere, isDatasetReviewer } from "./dataset-access.policy";

const INVALIDATE_CASE_DECLARATION = {
  declarationAccepted: false,
  declarationVersion: null,
  declarationText: null,
  declarationHash: null,
  declarationContentHash: null,
  declarationAcceptedRevision: null,
  declarationAcceptedAt: null,
  declarationAcceptedById: null,
} as const;

const EXT_TO_FORMAT: Record<string, DatasetFormat> = {
  zip: "Shapefile",
  geojson: "GeoJSON",
  json: "GeoJSON",
  kml: "KML",
  kmz: "KMZ",
  csv: "CSV",
  pdf: "PDF",
};

export const DATASET_IMPORT_QUEUE = "dataset-import";
/** Prévia cartográfica fixa: não é um endpoint alternativo de exportação. */
export const MAP_FEATURE_LIMIT = 1_000;
export const MAP_FEATURE_GRID_DEGREES = 0.005;
export const MAP_FEATURE_DECIMAL_DIGITS = 3;

const DATASET_PUBLIC_SELECT = {
  id: true,
  nome: true,
  formato: true,
  tipoGeometria: true,
  status: true,
  registros: true,
  projecaoOriginal: true,
  erro: true,
  caseId: true,
  createdById: true,
  visibility: true,
  codigoCar: true,
  codigoSigef: true,
  requestedPublic: true,
  publicationApprovedAt: true,
  publicationApprovedById: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    @InjectQueue(DATASET_IMPORT_QUEUE) private importQueue: Queue,
  ) {}

  findAll(user?: AuthUser) {
    return this.prisma.dataset.findMany({
      where: datasetAccessWhere(user),
      orderBy: { createdAt: "desc" },
      select: DATASET_PUBLIC_SELECT,
    });
  }

  private async findOneRaw(id: string) {
    const dataset = await this.prisma.dataset.findUnique({ where: { id } });
    if (!dataset) throw new NotFoundException("Dataset não encontrado");
    return dataset;
  }

  private async assertCanRead(
    dataset: Awaited<ReturnType<DatasetsService["findOneRaw"]>>,
    user?: AuthUser,
  ) {
    const linkedCase = dataset.caseId
      ? await this.prisma.case.findUnique({
          where: { id: dataset.caseId },
          select: {
            status: true,
            formSchemaVersion: true,
            contribution: {
              select: {
                grauPublicidadeInformacoes: true,
                possuiRestricaoDivulgacao: true,
              },
            },
          },
        })
      : null;
    if (!canReadDataset(dataset, linkedCase, user)) {
      throw new NotFoundException("Dataset não encontrado");
    }
  }

  async findOne(id: string, user?: AuthUser) {
    const dataset = await this.findOneRaw(id);
    await this.assertCanRead(dataset, user);
    return {
      id: dataset.id,
      nome: dataset.nome,
      formato: dataset.formato,
      tipoGeometria: dataset.tipoGeometria,
      status: dataset.status,
      registros: dataset.registros,
      projecaoOriginal: dataset.projecaoOriginal,
      erro: dataset.erro,
      caseId: dataset.caseId,
      createdById: dataset.createdById,
      visibility: dataset.visibility,
      codigoCar: dataset.codigoCar,
      codigoSigef: dataset.codigoSigef,
      requestedPublic: dataset.requestedPublic,
      publicationApprovedAt: dataset.publicationApprovedAt,
      publicationApprovedById: dataset.publicationApprovedById,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
    };
  }

  private async findOneForMutation(id: string, user: AuthUser) {
    const dataset = await this.findOneRaw(id);
    await this.assertCanRead(dataset, user);
    return dataset;
  }

  async create(dto: CreateDatasetDto, file: Express.Multer.File | undefined, user: AuthUser) {
    if (!file) throw new BadRequestException("Envie um arquivo");
    const validated = await validateDatasetUpload(file);
    const ext = validated.extension;
    const formato = EXT_TO_FORMAT[ext];
    if (!formato || formato === "PDF") {
      throw new Error(
        `Extensão .${ext} não suportada para dataset. Use .zip (shapefile), .geojson, .kml, .kmz ou .csv; comprovantes PDF devem ser anexados ao caso`,
      );
    }

    const dataset = await this.prisma.$transaction(async (tx) => {
      if (dto.caseId) {
        await tx.$queryRaw`SELECT id FROM cases WHERE id = ${dto.caseId} FOR UPDATE`;
        const linkedCase = await tx.case.findUnique({
          where: { id: dto.caseId },
          select: { createdById: true, status: true },
        });
        if (!linkedCase) throw new BadRequestException("Caso vinculado não encontrado");
        if (linkedCase.createdById !== user.id) {
          throw new ForbiddenException("Você não pode vincular dados a este caso");
        }
        if (linkedCase.status !== "rascunho") {
          throw new BadRequestException("Vincule datasets antes de submeter o caso");
        }
      }
      const created = await tx.dataset.create({
        data: {
          nome: dto.nome.trim(),
          formato,
          tipoGeometria: "Point",
          status: "processing",
          caseId: dto.caseId,
          createdById: user.id,
          visibility: "restrito",
          requestedPublic: dto.visibility === "publico",
          codigoCar: dto.codigoCar?.trim() || null,
          codigoSigef: dto.codigoSigef?.trim() || null,
        },
      });
      if (dto.caseId) {
        await tx.case.update({
          where: { id: dto.caseId },
          data: { ...INVALIDATE_CASE_DECLARATION, revision: { increment: 1 } },
        });
      }
      return created;
    });

    const storageKey = `datasets/${dataset.id}/${randomUUID()}.${ext}`;
    try {
      await this.minio.upload(storageKey, file.buffer, validated.contentType);
      await this.prisma.dataset.update({
        where: { id: dataset.id },
        data: { storageKey },
      });

      await this.importQueue.add(
        "import",
        { datasetId: dataset.id },
        { jobId: `dataset-${dataset.id}` },
      );
    } catch (error) {
      await this.minio.delete(storageKey).catch((cleanupError) => {
        this.logger.error(`Falha ao remover upload incompleto ${storageKey}`, cleanupError);
      });
      await this.prisma.dataset.delete({ where: { id: dataset.id } }).catch(() => undefined);
      throw error;
    }

    return this.findOne(dataset.id, user);
  }

  async reviewPublication(id: string, approved: boolean, user: AuthUser) {
    const dataset = await this.findOneRaw(id);
    if (!isDatasetReviewer(user)) throw new ForbiddenException("Ação restrita à verificação");
    if (approved) {
      if (!dataset.requestedPublic) {
        throw new BadRequestException("A publicação deste dataset não foi solicitada pelo autor");
      }
      if (dataset.status !== "active") {
        throw new BadRequestException("Somente datasets processados podem ser publicados");
      }
      if (dataset.caseId) {
        const linkedCase = await this.prisma.case.findUnique({
          where: { id: dataset.caseId },
          select: {
            status: true,
            formSchemaVersion: true,
            contribution: {
              select: { grauPublicidadeInformacoes: true, possuiRestricaoDivulgacao: true },
            },
          },
        });
        if (
          !linkedCase ||
          linkedCase.status !== "validado" ||
          linkedCase.formSchemaVersion !== CASE_FORM_SCHEMA_VERSION ||
          !linkedCase.contribution ||
          linkedCase.contribution.grauPublicidadeInformacoes !== "publico" ||
          linkedCase.contribution.possuiRestricaoDivulgacao !== false
        ) {
          throw new BadRequestException("O caso vinculado não permite publicação de datasets");
        }
      }
    }
    await this.prisma.dataset.update({
      where: { id },
      data: approved
        ? {
            visibility: "publico",
            publicationApprovedAt: new Date(),
            publicationApprovedById: user.id,
          }
        : {
            visibility: "restrito",
            publicationApprovedAt: null,
            publicationApprovedById: null,
          },
    });
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    const dataset = await this.findOneForMutation(id, user);
    if (dataset.caseId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.dataset.delete({ where: { id } });
        await tx.case.updateMany({
          where: { id: dataset.caseId!, status: "rascunho" },
          data: { ...INVALIDATE_CASE_DECLARATION, revision: { increment: 1 } },
        });
      });
    } else {
      await this.prisma.dataset.delete({ where: { id } });
    }

    // o registro já foi excluído; uma falha no MinIO só deixa o arquivo órfão, não desfaz a exclusão
    if (dataset.storageKey) {
      await this.minio.delete(dataset.storageKey).catch((error) => {
        this.logger.error(`Falha ao remover arquivo ${dataset.storageKey} do dataset ${id}`, error);
      });
    }
    return { success: true };
  }

  async getFeatures(datasetId: string, page = 1, pageSize = 50, user: AuthUser) {
    if (!hasPermission(user.role, "data:export")) {
      throw new ForbiddenException("Seu perfil não possui permissão para exportar dados");
    }
    await this.findOne(datasetId, user);
    page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    pageSize = Number.isFinite(pageSize) ? Math.min(500, Math.max(1, Math.floor(pageSize))) : 50;
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
      geometry: JSON.parse(r.geometry) as unknown,
    }));
  }

  async exportGeoJson(datasetId: string, user: AuthUser) {
    if (!hasPermission(user.role, "data:export")) {
      throw new ForbiddenException("Seu perfil não possui permissão para exportar dados");
    }
    await this.findOne(datasetId, user);
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
        geometry: JSON.parse(r.geometry) as unknown,
        properties: r.properties,
      })),
    };
  }

  async getMapFeatures(datasetId: string, user?: AuthUser) {
    await this.findOne(datasetId, user);
    const rows = await this.prisma.$queryRaw<{ geometry: string | null }[]>`
      SELECT ST_AsGeoJSON(
        ST_Force2D(
          ST_SimplifyPreserveTopology(
            ST_SnapToGrid(geom, ${MAP_FEATURE_GRID_DEGREES}),
            ${MAP_FEATURE_GRID_DEGREES}
          )
        ),
        ${MAP_FEATURE_DECIMAL_DIGITS}
      ) as geometry
      FROM features
      WHERE "datasetId" = ${datasetId}
        AND NOT ST_IsEmpty(geom)
      ORDER BY md5(id)
      LIMIT ${MAP_FEATURE_LIMIT + 1}
    `;
    const geometries = rows.filter(
      (row): row is { geometry: string } => typeof row.geometry === "string",
    );
    const truncated = geometries.length > MAP_FEATURE_LIMIT;
    return {
      type: "FeatureCollection",
      preview: true,
      generalized: true,
      truncated,
      limit: MAP_FEATURE_LIMIT,
      features: geometries.slice(0, MAP_FEATURE_LIMIT).map((row) => ({
        type: "Feature",
        geometry: JSON.parse(row.geometry) as unknown,
        properties: {},
      })),
    };
  }

  static generateFeatureId() {
    return randomUUID();
  }
}
