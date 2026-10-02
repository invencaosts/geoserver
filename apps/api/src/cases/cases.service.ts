import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import {
  CASE_DECLARATION_TEXT,
  CASE_DECLARATION_VERSION,
  CASE_FORM_SCHEMA_VERSION,
  CASE_TIPO_LABEL,
  LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
  hasPermission,
  type AuthUser,
  type CaseStatus,
  type CaseTipo,
} from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateCaseDto, UploadCaseDocumentDto } from "./dto/create-case.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { UpdateCaseStatusDto } from "./dto/update-case-status.dto";
import { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import { validateCaseAttachment } from "../common/upload-validation";
import { canReadDataset } from "../datasets/dataset-access.policy";
import { isBrazilUf } from "../common/brazil-ufs";
import type { CaseFacetDto } from "./dto/create-case.dto";

const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  rascunho: [],
  pendente: ["em_verificacao", "rejeitado"],
  em_verificacao: ["validado", "rejeitado", "pendente"],
  validado: ["pendente"],
  rejeitado: [],
};

const CASE_LIST_SELECT = {
  id: true,
  nome: true,
  tipo: true,
  municipio: true,
  estado: true,
  descricao: true,
  lat: true,
  lng: true,
  fonteDados: true,
  prioridade: true,
  status: true,
  declarationAccepted: true,
  declarationVersion: true,
  declarationHash: true,
  declarationContentHash: true,
  declarationAcceptedRevision: true,
  declarationAcceptedAt: true,
  formSchemaVersion: true,
  submittedAt: true,
  revision: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, nome: true } },
  contribution: {
    select: { grauPublicidadeInformacoes: true, possuiRestricaoDivulgacao: true },
  },
} as const;

type CaseListItem = Prisma.CaseGetPayload<{ select: typeof CASE_LIST_SELECT }>;

const CASE_VALIDATION_INCLUDE = {
  contribution: true,
  sources: { select: { id: true, titulo: true } },
  facets: {
    include: {
      option: { select: { categoria: true, codigo: true, ativo: true } },
    },
  },
  spatialReferences: { select: { id: true, valor: true } },
} as const;

type CaseForValidation = Prisma.CaseGetPayload<{ include: typeof CASE_VALIDATION_INCLUDE }>;

const CASE_DECLARATION_HASH = createHash("sha256")
  .update(`${CASE_DECLARATION_VERSION}\n${CASE_DECLARATION_TEXT}`)
  .digest("hex");

const SINGLE_SELECT_CATEGORIES = new Set([
  "relacao_pesquisador",
  "participacao_producao",
  "instrumento_central",
  "publicidade_documentos",
  "grau_publicidade",
  "periodo_ocorrencia",
  "cancelamento_titulos",
  "retorno_patrimonio",
  "destinacao_terras",
  "situacao_imovel",
  "escala_caso",
]);

const REQUIRED_FORM_CATEGORIES = [
  "relacao_pesquisador",
  "participacao_producao",
  "instrumento_central",
  "fonte_documento",
  "publicidade_documentos",
  "mecanismo_grilagem",
  "objeto_espolio",
  "grau_publicidade",
  "periodo_ocorrencia",
  "cancelamento_titulos",
  "retorno_patrimonio",
  "destinacao_terras",
  "situacao_imovel",
  "sujeitos_sociais",
  "escala_caso",
  "localizacao",
] as const;

export const LEGACY_EVIDENCE_RECONCILIATION_INTERVAL_MS = 5 * 60_000;
export const LEGACY_EVIDENCE_CLAIM_TIMEOUT_MS = 10 * 60_000;
export const LEGACY_EVIDENCE_RETRY_BACKOFF_MS = 15 * 60_000;
export const LEGACY_EVIDENCE_RECONCILIATION_BATCH_SIZE = 100;
export const LEGACY_EVIDENCE_ITEM_TIMEOUT_MS = 2 * 60_000;

@Injectable()
export class CasesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CasesService.name);
  private legacyEvidenceReconciliationTimer?: ReturnType<typeof setInterval>;
  private legacyEvidenceReconciliation?: Promise<void>;

  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private notifications: NotificationsService,
    @Optional() private config?: ConfigService,
  ) {}

  private assertDraftWritesEnabled() {
    const configured = this.config?.get<string>("CASE_DRAFTS_ENABLED");
    const enabled = configured
      ? configured.toLowerCase() === "true"
      : process.env.NODE_ENV !== "production";
    if (!enabled) {
      throw new ServiceUnavailableException(
        "Envio de casos temporariamente pausado durante a atualização do sistema",
      );
    }
  }

  async onModuleInit() {
    // A indisponibilidade pontual do objeto legado não derruba a API: o erro fica
    // auditável no documento e o ciclo periódico tenta novamente.
    void this.runLegacyEvidenceReconciliation().catch((error) =>
      this.logger.error("Falha na reconciliação inicial de evidências legadas", error),
    );
    this.legacyEvidenceReconciliationTimer = setInterval(() => {
      void this.runLegacyEvidenceReconciliation().catch((error) =>
        this.logger.error("Falha na reconciliação periódica de evidências legadas", error),
      );
    }, LEGACY_EVIDENCE_RECONCILIATION_INTERVAL_MS);
    this.legacyEvidenceReconciliationTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.legacyEvidenceReconciliationTimer) {
      clearInterval(this.legacyEvidenceReconciliationTimer);
      this.legacyEvidenceReconciliationTimer = undefined;
    }
  }

  private async runLegacyEvidenceReconciliation() {
    if (this.legacyEvidenceReconciliation) return this.legacyEvidenceReconciliation;
    const operation = (async () => {
      await this.reconcileLegacyEvidence();
      await this.migrateLegacyEvidence();
    })();
    this.legacyEvidenceReconciliation = operation;
    try {
      await operation;
    } finally {
      if (this.legacyEvidenceReconciliation === operation) {
        this.legacyEvidenceReconciliation = undefined;
      }
    }
  }

  private async reconcileLegacyEvidence() {
    const legacyCases = await this.prisma.$queryRaw<
      {
        id: string;
        createdById: string;
        anexoKey: string;
        anexoNome: string | null;
        createdAt: Date;
      }[]
    >`
      SELECT "id", "createdById", "anexoKey", "anexoNome", "createdAt"
      FROM "cases"
      WHERE "anexoKey" IS NOT NULL
        AND "anexoKey" IS DISTINCT FROM "legacyEvidenceReconciledKey"
      ORDER BY "id"
      LIMIT ${LEGACY_EVIDENCE_RECONCILIATION_BATCH_SIZE}
    `;
    // Além de facilitar mocks unitários, evita interromper a inicialização caso um
    // adapter incompatível devolva uma resposta inesperada durante um rolling deploy.
    if (!Array.isArray(legacyCases)) return;
    for (const legacyCase of legacyCases) {
      if (!legacyCase.anexoKey) continue;
      const existing = await this.prisma.caseDocument.upsert({
        where: { storageKey: legacyCase.anexoKey },
        create: {
          caseId: legacyCase.id,
          uploadedById: legacyCase.createdById,
          nome: legacyCase.anexoNome?.trim() || "anexo legado",
          mimeType: "application/octet-stream",
          tamanho: 0,
          storageKey: legacyCase.anexoKey,
          visibility: "restrito",
          migrationStatus: "pending",
          createdAt: legacyCase.createdAt,
        },
        update: {},
        select: { id: true, migrationStatus: true },
      });
      if (existing.migrationStatus === "native") {
        // Compatibilidade com o snapshot da primeira versão da migration, que
        // não marcava explicitamente esses registros como legados.
        await this.prisma.caseDocument.updateMany({
          where: { id: existing.id, migrationStatus: "native" },
          data: {
            migrationStatus: "pending",
            migrationError: null,
            migrationClaimedAt: null,
          },
        });
      }
      await this.prisma.case.updateMany({
        where: { id: legacyCase.id, anexoKey: legacyCase.anexoKey },
        data: { legacyEvidenceReconciledKey: legacyCase.anexoKey },
      });
    }
  }

  private async migrateLegacyEvidence() {
    let failed = false;
    const staleBefore = new Date(Date.now() - LEGACY_EVIDENCE_CLAIM_TIMEOUT_MS);
    const retryAt = new Date();
    const claimable = {
      OR: [
        { migrationStatus: "pending" },
        {
          migrationStatus: "error",
          OR: [{ migrationNextAttemptAt: null }, { migrationNextAttemptAt: { lte: retryAt } }],
        },
        {
          migrationStatus: "processing",
          OR: [{ migrationClaimedAt: null }, { migrationClaimedAt: { lt: staleBefore } }],
        },
      ],
    } satisfies Prisma.CaseDocumentWhereInput;
    const legacyDocuments = await this.prisma.caseDocument.findMany({
      where: {
        ...claimable,
      },
      select: { id: true, storageKey: true },
      orderBy: { id: "asc" },
      take: LEGACY_EVIDENCE_RECONCILIATION_BATCH_SIZE,
    });
    if (!Array.isArray(legacyDocuments)) return;
    for (const document of legacyDocuments) {
      const claimedAt = new Date();
      const claim = await this.prisma.caseDocument.updateMany({
        where: { id: document.id, ...claimable },
        data: {
          migrationStatus: "processing",
          migrationError: null,
          migrationClaimedAt: claimedAt,
          migrationNextAttemptAt: null,
        },
      });
      if (claim.count !== 1) continue;
      try {
        const migrated = await this.withTimeout(
          this.minio.migrateLegacyCaseEvidence(document.storageKey),
          LEGACY_EVIDENCE_ITEM_TIMEOUT_MS,
          `Tempo esgotado ao migrar a evidência ${document.storageKey}`,
        );
        await this.prisma.caseDocument.updateMany({
          where: {
            id: document.id,
            migrationStatus: "processing",
            migrationClaimedAt: claimedAt,
          },
          data: {
            migrationStatus: "completed",
            migrationError: null,
            migrationClaimedAt: null,
            migrationNextAttemptAt: null,
            tamanho: migrated.size,
            ...(migrated.contentType ? { mimeType: migrated.contentType } : {}),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 1000) : "Falha desconhecida";
        const marked = await this.prisma.caseDocument.updateMany({
          where: {
            id: document.id,
            migrationStatus: "processing",
            migrationClaimedAt: claimedAt,
          },
          data: {
            migrationStatus: "error",
            migrationError: message,
            migrationClaimedAt: null,
            migrationNextAttemptAt: new Date(Date.now() + LEGACY_EVIDENCE_RETRY_BACKOFF_MS),
          },
        });
        failed ||= marked.count === 1;
        this.logger.error(
          `Falha ao migrar evidência legada ${document.storageKey} para o bucket privado`,
          error,
        );
      }
    }
    if (failed) {
      throw new Error(
        "A migração de evidências legadas não foi concluída; consulte migrationError e tente novamente",
      );
    }
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      timer.unref?.();
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private isReviewer(user?: AuthUser) {
    return user?.role === "admin" || user?.role === "verificador";
  }

  private visibilityWhere(user?: AuthUser) {
    if (this.isReviewer(user)) return {};
    if (user) return { OR: [{ status: "validado" as const }, { createdById: user.id }] };
    return { status: "validado" as const };
  }

  private structuredVisibilityWhere(user?: AuthUser) {
    if (this.isReviewer(user)) return {};
    const publicStructured = {
      formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
      contribution: {
        is: {
          grauPublicidadeInformacoes: "publico",
          possuiRestricaoDivulgacao: false,
        },
      },
    };
    return user ? { OR: [{ createdById: user.id }, publicStructured] } : publicStructured;
  }

  async findAll(filters: ListCasesQueryDto, user?: AuthUser) {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 20)));
    const where = {
      AND: [
        this.visibilityWhere(user),
        filters.municipio ? this.structuredVisibilityWhere(user) : {},
        {
          status: filters.status,
          municipio: filters.municipio
            ? { equals: filters.municipio, mode: "insensitive" as const }
            : undefined,
          tipo: filters.tipo,
        },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: CASE_LIST_SELECT,
      }),
      this.prisma.case.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serializeListCase(item, user)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findForExport(
    filters: { status?: CaseStatus; municipio?: string; tipo?: CaseTipo },
    user: AuthUser,
  ) {
    const items = await this.prisma.case.findMany({
      where: {
        AND: [
          this.visibilityWhere(user),
          filters.municipio ? this.structuredVisibilityWhere(user) : {},
          {
            status: filters.status,
            municipio: filters.municipio
              ? { equals: filters.municipio, mode: "insensitive" as const }
              : undefined,
            tipo: filters.tipo,
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: CASE_LIST_SELECT,
    });
    return items.map((item) => this.serializeListCase(item, user));
  }

  async findDetailedForExport(
    filters: { status?: CaseStatus; municipio?: string; tipo?: CaseTipo },
    user: AuthUser,
  ) {
    const visible = await this.findForExport(filters, user);
    return Promise.all(visible.map((item) => this.findOne(item.id, user)));
  }

  async findMapPoints() {
    const points = await this.prisma.case.findMany({
      where: {
        status: "validado",
        lat: { not: null },
        lng: { not: null },
        OR: [
          { formSchemaVersion: null },
          { formSchemaVersion: LEGACY_VALIDATED_CASE_SCHEMA_VERSION },
          {
            formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
            contribution: {
              is: {
                grauPublicidadeInformacoes: "publico",
                possuiRestricaoDivulgacao: false,
              },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        tipo: true,
        prioridade: true,
        status: true,
        lat: true,
        lng: true,
        formSchemaVersion: true,
      },
    });
    return points.map(({ formSchemaVersion, ...point }) =>
      formSchemaVersion === CASE_FORM_SCHEMA_VERSION
        ? point
        : {
            ...point,
            // A localização histórica continua visível, sem republicar precisão
            // potencialmente sensível que o formulário legado não classificava.
            lat: point.lat == null ? null : Math.round(point.lat * 1_000) / 1_000,
            lng: point.lng == null ? null : Math.round(point.lng * 1_000) / 1_000,
          },
    );
  }

  listOptions(categoria?: string) {
    return this.prisma.formOption.findMany({
      where: { ativo: true, categoria },
      orderBy: [{ categoria: "asc" }, { ordem: "asc" }, { label: "asc" }],
      select: {
        id: true,
        categoria: true,
        codigo: true,
        label: true,
        descricao: true,
        ordem: true,
      },
    });
  }

  private async findOneRaw(id: string) {
    const item = await this.prisma.case.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, nome: true } },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          include: { changedBy: { select: { id: true, nome: true } } },
        },
        contribution: true,
        sources: { orderBy: { createdAt: "asc" } },
        documents: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            sourceId: true,
            nome: true,
            mimeType: true,
            tamanho: true,
            visibility: true,
            requestedPublic: true,
            publicationApprovedAt: true,
            publicationApprovedById: true,
            possuiDadosPessoais: true,
            motivoRestricao: true,
            storageKey: true,
            source: { select: { grauPublicidade: true } },
            createdAt: true,
          },
        },
        facets: {
          include: {
            option: { select: { categoria: true, codigo: true, label: true, ativo: true } },
          },
        },
        spatialReferences: { orderBy: { createdAt: "asc" } },
        datasets: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!item) throw new NotFoundException("Caso não encontrado");
    return item;
  }

  async findOne(id: string, user?: AuthUser) {
    const item = await this.findOneRaw(id);
    if (item.status !== "validado" && !this.canReadSensitive(item, user)) {
      throw new NotFoundException("Caso não encontrado");
    }
    return this.serializeCase(item, user);
  }

  private canReadSensitive(item: { createdById: string }, user?: AuthUser) {
    return Boolean(
      user && (hasPermission(user.role, "case:read_restricted") || item.createdById === user.id),
    );
  }

  private structuredDataIsPublic(item: {
    formSchemaVersion?: string | null;
    contribution?: {
      grauPublicidadeInformacoes: string | null;
      possuiRestricaoDivulgacao: boolean | null;
    } | null;
  }) {
    return Boolean(
      item.formSchemaVersion === CASE_FORM_SCHEMA_VERSION &&
      item.contribution &&
      item.contribution.grauPublicidadeInformacoes === "publico" &&
      item.contribution.possuiRestricaoDivulgacao === false,
    );
  }

  private declarationData(
    accepted: boolean,
    version: string | null | undefined,
    acceptedById: string,
    contentHash?: string,
    acceptedRevision?: number,
  ) {
    if (accepted && version !== CASE_DECLARATION_VERSION) {
      throw new BadRequestException(
        "A declaração foi atualizada. Leia e aceite a versão vigente antes de salvar",
      );
    }
    if (accepted && (!contentHash || acceptedRevision === undefined)) {
      throw new BadRequestException("Não foi possível vincular o aceite ao conteúdo do caso");
    }
    return accepted
      ? {
          declarationAccepted: true,
          declarationVersion: CASE_DECLARATION_VERSION,
          declarationText: CASE_DECLARATION_TEXT,
          declarationHash: CASE_DECLARATION_HASH,
          declarationContentHash: contentHash,
          declarationAcceptedRevision: acceptedRevision,
          declarationAcceptedAt: new Date(),
          declarationAcceptedById: acceptedById,
        }
      : {
          declarationAccepted: false,
          declarationVersion: null,
          declarationText: null,
          declarationHash: null,
          declarationContentHash: null,
          declarationAcceptedRevision: null,
          declarationAcceptedAt: null,
          declarationAcceptedById: null,
        };
  }

  private async contentSnapshot(tx: Prisma.TransactionClient, id: string) {
    const item = await tx.case.findUniqueOrThrow({
      where: { id },
      select: {
        nome: true,
        tipo: true,
        municipio: true,
        estado: true,
        descricao: true,
        lat: true,
        lng: true,
        fonteDados: true,
        denunciante: true,
        prioridade: true,
        contribution: true,
        sources: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            titulo: true,
            tipo: true,
            referencia: true,
            grauPublicidade: true,
          },
        },
        facets: {
          orderBy: { optionId: "asc" },
          select: { optionId: true, valorOutro: true },
        },
        spatialReferences: {
          orderBy: { id: "asc" },
          select: { id: true, tipo: true, valor: true, descricao: true },
        },
        documents: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            sourceId: true,
            nome: true,
            mimeType: true,
            tamanho: true,
            requestedPublic: true,
            possuiDadosPessoais: true,
            motivoRestricao: true,
          },
        },
        datasets: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            nome: true,
            formato: true,
            requestedPublic: true,
            codigoCar: true,
            codigoSigef: true,
          },
        },
      },
    });
    return createHash("sha256").update(JSON.stringify(item)).digest("hex");
  }

  private assertReadyForReview(current: CaseForValidation) {
    if (current.formSchemaVersion !== CASE_FORM_SCHEMA_VERSION) {
      throw new BadRequestException(
        "Caso legado: devolva o registro ao autor para completar o formulário atual antes da validação",
      );
    }
    if (
      !current.declarationAccepted ||
      current.declarationVersion !== CASE_DECLARATION_VERSION ||
      current.declarationText !== CASE_DECLARATION_TEXT ||
      current.declarationHash !== CASE_DECLARATION_HASH ||
      !current.declarationContentHash ||
      current.declarationAcceptedRevision !== current.revision ||
      !current.declarationAcceptedAt ||
      current.declarationAcceptedById !== current.createdById
    ) {
      throw new BadRequestException(
        "O caso não possui uma declaração vigente vinculada ao conteúdo submetido",
      );
    }
    if (current.sources.length === 0 || current.sources.some((source) => !source.titulo.trim())) {
      throw new BadRequestException("O caso precisa de ao menos uma fonte válida");
    }
    const selectedCategories = new Set(current.facets.map((facet) => facet.option.categoria));
    const missingCategories = REQUIRED_FORM_CATEGORIES.filter(
      (category) => !selectedCategories.has(category),
    );
    const publicityOption = current.facets.find(
      (facet) => facet.option.categoria === "grau_publicidade",
    );
    if (
      !current.contribution ||
      !current.contribution.grauPublicidadeInformacoes ||
      current.contribution.grauPublicidadeInformacoes !== publicityOption?.option.codigo ||
      typeof current.contribution.possuiRestricaoDivulgacao !== "boolean" ||
      (current.contribution.possuiRestricaoDivulgacao &&
        !current.contribution.restricaoDivulgacao?.trim()) ||
      current.spatialReferences.length === 0 ||
      current.spatialReferences.some((reference) => !reference.valor.trim()) ||
      missingCategories.length > 0 ||
      current.facets.some(
        (facet) =>
          !facet.option.ativo || (facet.option.codigo === "outro" && !facet.valorOutro?.trim()),
      )
    ) {
      throw new BadRequestException(
        `O formulário atual está incompleto${
          missingCategories.length ? `: ${missingCategories.join(", ")}` : ""
        }`,
      );
    }
  }

  private async validatedFacets(tx: Prisma.TransactionClient, facets: CaseFacetDto[]) {
    const optionIds = facets.map((facet) => facet.optionId);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new BadRequestException("Não repita a mesma opção no questionário");
    }
    if (!optionIds.length) return [];

    const options = await tx.formOption.findMany({
      where: { id: { in: optionIds }, ativo: true },
      select: { id: true, categoria: true, codigo: true },
    });
    if (options.length !== optionIds.length) {
      throw new BadRequestException("Uma ou mais opções do questionário são inválidas ou inativas");
    }
    const optionById = new Map(options.map((option) => [option.id, option]));
    const countByCategory = new Map<string, number>();
    const prepared = facets.map((facet) => {
      const option = optionById.get(facet.optionId)!;
      countByCategory.set(option.categoria, (countByCategory.get(option.categoria) ?? 0) + 1);
      const valorOutro = facet.valorOutro?.trim() || null;
      if (option.codigo === "outro" && !valorOutro) {
        throw new BadRequestException(`Especifique a opção Outro em ${option.categoria}`);
      }
      return {
        optionId: facet.optionId,
        valorOutro: option.codigo === "outro" ? valorOutro : null,
      };
    });
    const duplicatedSingleCategory = [...countByCategory.entries()].find(
      ([category, count]) => SINGLE_SELECT_CATEGORIES.has(category) && count > 1,
    );
    if (duplicatedSingleCategory) {
      throw new BadRequestException(`Selecione apenas uma opção em ${duplicatedSingleCategory[0]}`);
    }
    return prepared;
  }

  private serializeListCase(item: CaseListItem, user?: AuthUser) {
    const sensitive = this.canReadSensitive(item, user);
    const canPublishStructuredData = sensitive || this.structuredDataIsPublic(item);
    const { contribution: _contribution, formSchemaVersion, ...base } = item;
    const projected = {
      ...base,
      formSchemaVersion,
      requiresFormCompletion: formSchemaVersion !== CASE_FORM_SCHEMA_VERSION,
    };
    if (canPublishStructuredData) return projected;
    const {
      descricao: _descricao,
      lat: _lat,
      lng: _lng,
      fonteDados: _fonteDados,
      municipio: _municipio,
      ...safe
    } = projected;
    return {
      ...safe,
      municipio: "",
      descricao: undefined,
      lat: undefined,
      lng: undefined,
      fonteDados: undefined,
    };
  }

  /** Allowlist: campos novos no banco não são publicados por acidente. */
  private serializeCase(item: Awaited<ReturnType<CasesService["findOneRaw"]>>, user?: AuthUser) {
    const sensitive = this.canReadSensitive(item, user);
    const canPublishStructuredData = sensitive || this.structuredDataIsPublic(item);
    const documents = (item.documents ?? [])
      .filter(
        (document) =>
          sensitive ||
          (canPublishStructuredData &&
            item.status === "validado" &&
            document.visibility === "publico" &&
            Boolean(document.publicationApprovedAt) &&
            !document.possuiDadosPessoais &&
            (!document.sourceId || document.source?.grauPublicidade === "publico")),
      )
      .map((document) => ({
        id: document.id,
        sourceId: document.sourceId,
        nome: document.nome,
        mimeType: document.mimeType,
        tamanho: document.tamanho,
        visibility: document.visibility,
        requestedPublic: document.requestedPublic,
        publicationApprovedAt: document.publicationApprovedAt,
        publicationApprovedById: document.publicationApprovedById,
        possuiDadosPessoais: document.possuiDadosPessoais,
        motivoRestricao: sensitive ? document.motivoRestricao : undefined,
        downloadUrl: `/cases/${item.id}/documents/${document.id}/download`,
        createdAt: document.createdAt,
      }));
    const contribution =
      item.contribution && canPublishStructuredData
        ? {
            relacaoPesquisador: item.contribution.relacaoPesquisador,
            participouProducao: item.contribution.participouProducao,
            participouValidacao: item.contribution.participouValidacao,
            responsavelValidacao: item.contribution.responsavelValidacao,
            instrumentoCentral: item.contribution.instrumentoCentral,
            objetoEspolio: item.contribution.objetoEspolio,
            instituicaoPromotora: item.contribution.instituicaoPromotora,
            grauPublicidadeInformacoes: item.contribution.grauPublicidadeInformacoes,
            possuiRestricaoDivulgacao: item.contribution.possuiRestricaoDivulgacao,
            restricaoDivulgacao: sensitive ? item.contribution.restricaoDivulgacao : undefined,
            periodoInicio: item.contribution.periodoInicio,
            periodoFim: item.contribution.periodoFim,
            situacaoCancelamento: item.contribution.situacaoCancelamento,
            orgaoCancelamento: item.contribution.orgaoCancelamento,
            retornouPatrimonioPublico: item.contribution.retornouPatrimonioPublico,
            destinacaoPosterior: item.contribution.destinacaoPosterior,
            situacaoAtualImovel: item.contribution.situacaoAtualImovel,
            conflitos: item.contribution.conflitos,
            sujeitosSociais: item.contribution.sujeitosSociais,
            escalaEspacial: item.contribution.escalaEspacial,
          }
        : null;
    return {
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      ...(canPublishStructuredData ? { municipio: item.municipio } : {}),
      estado: item.estado,
      ...(canPublishStructuredData
        ? {
            descricao: item.descricao,
            lat: item.lat,
            lng: item.lng,
            fonteDados: item.fonteDados,
          }
        : {}),
      ...(sensitive ? { denunciante: item.denunciante } : {}),
      prioridade: item.prioridade,
      status: item.status,
      formSchemaVersion: item.formSchemaVersion,
      requiresFormCompletion: item.formSchemaVersion !== CASE_FORM_SCHEMA_VERSION,
      ...(sensitive
        ? {
            declarationAccepted: item.declarationAccepted,
            declarationVersion: item.declarationVersion,
            declarationText: item.declarationText,
            declarationHash: item.declarationHash,
            declarationContentHash: item.declarationContentHash,
            declarationAcceptedRevision: item.declarationAcceptedRevision,
            declarationAcceptedAt: item.declarationAcceptedAt,
            declarationAcceptedById: item.declarationAcceptedById,
          }
        : {}),
      submittedAt: item.submittedAt,
      revision: item.revision,
      createdById: item.createdById,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
      statusHistory: sensitive ? (item.statusHistory ?? []) : [],
      contribution,
      sources: (item.sources ?? [])
        .filter(
          (source) =>
            sensitive || (canPublishStructuredData && source.grauPublicidade === "publico"),
        )
        .map((source) => ({
          id: source.id,
          titulo: source.titulo,
          tipo: source.tipo,
          referencia: source.referencia,
          grauPublicidade: source.grauPublicidade,
        })),
      documents,
      facets: (canPublishStructuredData ? (item.facets ?? []) : []).map((facet) => ({
        optionId: facet.optionId,
        valorOutro: facet.valorOutro,
        categoria: facet.option.categoria,
        codigo: facet.option.codigo,
        label: facet.option.label,
      })),
      spatialReferences: (canPublishStructuredData ? (item.spatialReferences ?? []) : []).map(
        (reference) => ({
          id: reference.id,
          tipo: reference.tipo,
          valor: reference.valor,
          descricao: reference.descricao,
        }),
      ),
      datasets: (item.datasets ?? [])
        .filter(
          (dataset) =>
            (sensitive || canPublishStructuredData) &&
            canReadDataset(
              dataset,
              {
                status: item.status,
                formSchemaVersion: item.formSchemaVersion,
                contribution: item.contribution
                  ? {
                      grauPublicidadeInformacoes: item.contribution.grauPublicidadeInformacoes,
                      possuiRestricaoDivulgacao: item.contribution.possuiRestricaoDivulgacao,
                    }
                  : null,
              },
              user,
            ),
        )
        .map((dataset) => ({
          id: dataset.id,
          nome: dataset.nome,
          formato: dataset.formato,
          tipoGeometria: dataset.tipoGeometria,
          status: dataset.status,
          registros: dataset.registros,
          projecaoOriginal: dataset.projecaoOriginal,
          erro: sensitive ? dataset.erro : undefined,
          caseId: dataset.caseId,
          createdById: dataset.createdById,
          visibility: dataset.visibility,
          codigoCar: dataset.codigoCar,
          codigoSigef: dataset.codigoSigef,
          requestedPublic: dataset.requestedPublic,
          publicationApprovedAt: dataset.publicationApprovedAt,
          publicationApprovedById: dataset.publicationApprovedById,
          createdAt: dataset.createdAt,
        })),
    };
  }

  async create(dto: CreateCaseDto, user: AuthUser) {
    this.assertDraftWritesEnabled();
    if (dto.declarationAccepted && dto.declarationVersion !== CASE_DECLARATION_VERSION) {
      throw new BadRequestException(
        "A declaração foi atualizada. Leia e aceite a versão vigente antes de salvar",
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const facets = dto.facets ? await this.validatedFacets(tx, dto.facets) : undefined;
      const item = await tx.case.create({
        data: {
          nome: dto.nome?.trim() || "Rascunho sem título",
          tipo: dto.tipo ?? "institucional",
          municipio: dto.municipio?.trim() ?? "",
          estado: dto.estado?.trim().toUpperCase() ?? "",
          descricao: dto.descricao?.trim() || null,
          lat: dto.lat,
          lng: dto.lng,
          fonteDados: dto.fonteDados?.trim() || null,
          denunciante: dto.denunciante?.trim() || null,
          prioridade: dto.prioridade ?? "media",
          status: "rascunho",
          formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
          createdById: user.id,
          contribution: dto.contribution ? { create: dto.contribution } : undefined,
          sources: dto.sources?.length
            ? {
                create: dto.sources.map((source) => ({
                  titulo: source.titulo.trim(),
                  tipo: source.tipo?.trim() || null,
                  referencia: source.referencia?.trim() || null,
                  grauPublicidade: source.grauPublicidade ?? "restrito",
                })),
              }
            : undefined,
          facets: facets?.length ? { create: facets } : undefined,
          spatialReferences: dto.spatialReferences?.length
            ? {
                create: dto.spatialReferences.map((reference) => ({
                  tipo: reference.tipo,
                  valor: reference.valor.trim(),
                  descricao: reference.descricao?.trim() || null,
                })),
              }
            : undefined,
        },
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: item.id,
          fromStatus: null,
          toStatus: "rascunho",
          changedById: user.id,
          note: "Rascunho criado",
        },
      });
      if (dto.declarationAccepted) {
        const contentHash = await this.contentSnapshot(tx, item.id);
        await tx.case.update({
          where: { id: item.id },
          data: this.declarationData(
            true,
            dto.declarationVersion,
            user.id,
            contentHash,
            item.revision,
          ),
        });
      }
      return item;
    });
    return this.findOne(created.id, user);
  }

  async updateDraft(id: string, dto: UpdateCaseDto, user: AuthUser) {
    this.assertDraftWritesEnabled();
    const current = await this.findOneRaw(id);
    if (current.status !== "rascunho" && current.status !== "rejeitado")
      throw new ConflictException("Somente rascunhos ou casos devolvidos podem ser editados");
    if (current.createdById !== user.id) {
      throw new ForbiddenException("Somente o autor pode editar este rascunho");
    }
    if (dto.revision !== current.revision) {
      throw new ConflictException("O rascunho foi alterado; atualize e tente novamente");
    }
    const {
      contribution,
      sources,
      facets,
      spatialReferences,
      declarationAccepted,
      declarationVersion,
      revision,
      ...fields
    } = dto;
    if (declarationVersion !== undefined && declarationAccepted === undefined) {
      throw new BadRequestException("Informe o aceite junto com a versão da declaração");
    }
    if (declarationAccepted && declarationVersion !== CASE_DECLARATION_VERSION) {
      throw new BadRequestException(
        "A declaração foi atualizada. Leia e aceite a versão vigente antes de salvar",
      );
    }
    const contentChanged =
      Object.keys(fields).length > 0 ||
      contribution !== undefined ||
      sources !== undefined ||
      facets !== undefined ||
      spatialReferences !== undefined;
    const nextRevision = revision + 1;
    await this.prisma.$transaction(async (tx) => {
      const preparedFacets = facets ? await this.validatedFacets(tx, facets) : undefined;
      const updated = await tx.case.updateMany({
        where: {
          id,
          status: current.status,
          revision,
        },
        data: {
          ...fields,
          nome: fields.nome?.trim(),
          municipio: fields.municipio?.trim(),
          estado: fields.estado?.trim().toUpperCase(),
          descricao: fields.descricao == null ? fields.descricao : fields.descricao.trim() || null,
          fonteDados:
            fields.fonteDados == null ? fields.fonteDados : fields.fonteDados.trim() || null,
          denunciante:
            fields.denunciante == null ? fields.denunciante : fields.denunciante.trim() || null,
          ...(current.status === "rejeitado" ? { status: "rascunho" as const } : {}),
          ...(contentChanged || declarationAccepted === false
            ? this.declarationData(false, undefined, user.id)
            : {}),
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("O rascunho foi alterado; atualize e tente novamente");
      }
      if (current.status === "rejeitado") {
        await tx.caseStatusHistory.create({
          data: {
            caseId: id,
            fromStatus: "rejeitado",
            toStatus: "rascunho",
            changedById: user.id,
            note: "Caso reaberto pelo autor para correção",
          },
        });
      }
      if (contribution) {
        await tx.caseContribution.upsert({
          where: { caseId: id },
          create: { caseId: id, ...contribution },
          update: contribution,
        });
      }
      if (sources) {
        const knownIds = new Set(current.sources.map((source) => source.id));
        const suppliedIds = sources.flatMap((source) => (source.id ? [source.id] : []));
        if (new Set(suppliedIds).size !== suppliedIds.length) {
          throw new BadRequestException("Não repita a mesma fonte");
        }
        const retainedIds: string[] = [];
        for (const source of sources) {
          if (source.id && !knownIds.has(source.id)) {
            throw new BadRequestException("Uma das fontes não pertence a este caso");
          }
          const data = {
            titulo: source.titulo.trim(),
            tipo: source.tipo?.trim() || null,
            referencia: source.referencia?.trim() || null,
            grauPublicidade: source.grauPublicidade ?? "restrito",
          };
          if (source.id) {
            await tx.caseSource.update({ where: { id: source.id }, data });
            retainedIds.push(source.id);
          } else {
            const created = await tx.caseSource.create({ data: { caseId: id, ...data } });
            retainedIds.push(created.id);
          }
        }
        await tx.caseSource.deleteMany({
          where: {
            caseId: id,
            ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
          },
        });
      }
      if (preparedFacets) {
        await tx.caseFacetSelection.deleteMany({ where: { caseId: id } });
        if (preparedFacets.length)
          await tx.caseFacetSelection.createMany({
            data: preparedFacets.map((facet) => ({ caseId: id, ...facet })),
          });
      }
      if (spatialReferences) {
        const knownIds = new Set(current.spatialReferences.map((reference) => reference.id));
        const suppliedIds = spatialReferences.flatMap((reference) =>
          reference.id ? [reference.id] : [],
        );
        if (new Set(suppliedIds).size !== suppliedIds.length) {
          throw new BadRequestException("Não repita a mesma referência espacial");
        }
        const retainedIds: string[] = [];
        for (const reference of spatialReferences) {
          if (reference.id && !knownIds.has(reference.id)) {
            throw new BadRequestException("Uma referência espacial não pertence a este caso");
          }
          const data = {
            tipo: reference.tipo,
            valor: reference.valor.trim(),
            descricao: reference.descricao?.trim() || null,
          };
          if (reference.id) {
            const updatedReference = await tx.caseSpatialReference.updateMany({
              where: { id: reference.id, caseId: id },
              data,
            });
            if (updatedReference.count !== 1) {
              throw new ConflictException("A referência espacial foi alterada; atualize a página");
            }
            retainedIds.push(reference.id);
          } else {
            const createdReference = await tx.caseSpatialReference.create({
              data: { caseId: id, ...data },
              select: { id: true },
            });
            retainedIds.push(createdReference.id);
          }
        }
        await tx.caseSpatialReference.deleteMany({
          where: {
            caseId: id,
            ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
          },
        });
      }
      if (declarationAccepted) {
        const contentHash = await this.contentSnapshot(tx, id);
        const accepted = await tx.case.updateMany({
          where: { id, status: "rascunho", revision: nextRevision },
          data: this.declarationData(true, declarationVersion, user.id, contentHash, nextRevision),
        });
        if (accepted.count !== 1) {
          throw new ConflictException("O rascunho foi alterado; atualize e aceite novamente");
        }
      }
    });
    return this.findOne(id, user);
  }

  async submit(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cases WHERE id = ${id} FOR UPDATE`;
      const current = await tx.case.findUnique({
        where: { id },
        include: CASE_VALIDATION_INCLUDE,
      });
      if (!current) throw new NotFoundException("Caso não encontrado");
      if (current.status !== "rascunho") throw new ConflictException("Este caso já foi submetido");
      if (current.createdById !== user.id) {
        throw new ForbiddenException("Somente o autor pode submeter este rascunho");
      }
      if (
        !current.nome.trim() ||
        current.nome === "Rascunho sem título" ||
        !current.municipio.trim() ||
        !current.estado.trim() ||
        !isBrazilUf(current.estado)
      ) {
        throw new BadRequestException("Preencha nome, município e estado antes de submeter");
      }
      if (
        !current.declarationAccepted ||
        current.declarationVersion !== CASE_DECLARATION_VERSION ||
        current.declarationText !== CASE_DECLARATION_TEXT ||
        current.declarationHash !== CASE_DECLARATION_HASH ||
        !current.declarationContentHash ||
        current.declarationAcceptedRevision !== current.revision ||
        !current.declarationAcceptedAt ||
        current.declarationAcceptedById !== current.createdById
      ) {
        throw new BadRequestException(
          "A declaração foi atualizada. Reabra o rascunho, leia e aceite a versão vigente",
        );
      }
      if (current.sources.length === 0 || current.sources.some((source) => !source.titulo.trim())) {
        throw new BadRequestException("Informe ao menos uma fonte antes de submeter");
      }
      const selectedCategories = new Set(current.facets.map((facet) => facet.option.categoria));
      const missingCategories = REQUIRED_FORM_CATEGORIES.filter(
        (category) => !selectedCategories.has(category),
      );
      const missingOtherValue = current.facets.some(
        (facet) => facet.option.codigo === "outro" && !facet.valorOutro?.trim(),
      );
      const inactiveOption = current.facets.some((facet) => !facet.option.ativo);
      const publicityOption = current.facets.find(
        (facet) => facet.option.categoria === "grau_publicidade",
      );
      if (
        !current.contribution ||
        !current.contribution.grauPublicidadeInformacoes ||
        current.contribution.grauPublicidadeInformacoes !== publicityOption?.option.codigo ||
        typeof current.contribution.possuiRestricaoDivulgacao !== "boolean" ||
        (current.contribution.possuiRestricaoDivulgacao === true &&
          !current.contribution.restricaoDivulgacao?.trim()) ||
        current.spatialReferences.length === 0 ||
        current.spatialReferences.some((reference) => !reference.valor.trim()) ||
        missingCategories.length > 0 ||
        missingOtherValue ||
        inactiveOption
      ) {
        throw new BadRequestException(
          `Complete o questionário antes de submeter${
            missingCategories.length ? `: ${missingCategories.join(", ")}` : ""
          }`,
        );
      }
      const currentContentHash = await this.contentSnapshot(tx, id);
      if (current.declarationContentHash !== currentContentHash) {
        throw new BadRequestException(
          "O conteúdo mudou depois do aceite. Revise o caso e aceite novamente a declaração",
        );
      }
      const submittedAt = new Date();
      const updated = await tx.case.updateMany({
        where: { id, status: "rascunho" },
        data: {
          status: "pendente",
          formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
          submittedAt,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("O caso foi alterado; atualize e tente novamente");
      await tx.caseStatusHistory.create({
        data: {
          caseId: id,
          fromStatus: "rascunho",
          toStatus: "pendente",
          changedById: user.id,
          note: "Caso submetido para verificação",
        },
      });
    });
    return this.findOne(id, user);
  }

  async updateStatus(id: string, dto: UpdateCaseStatusDto, user: AuthUser) {
    const current = await this.findOneRaw(id);
    const note = dto.note?.trim() || undefined;
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${current.status} -> ${dto.status}. Permitido: ${allowed.join(", ")}`,
      );
    }
    if (dto.status === "rejeitado" && !note)
      throw new BadRequestException("Informe o motivo da rejeição");
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cases WHERE id = ${id} FOR UPDATE`;
      if (dto.status === "validado") {
        const locked = await tx.case.findUnique({
          where: { id },
          include: CASE_VALIDATION_INCLUDE,
        });
        if (!locked || locked.status !== current.status) {
          throw new ConflictException(
            "O status deste caso foi alterado por outra pessoa. Atualize os detalhes e tente novamente.",
          );
        }
        this.assertReadyForReview(locked);
        const currentContentHash = await this.contentSnapshot(tx, id);
        if (locked.declarationContentHash !== currentContentHash) {
          throw new BadRequestException(
            "O conteúdo mudou depois do aceite; devolva o caso ao autor para revisão",
          );
        }
      }
      const updated = await tx.case.updateMany({
        where: { id, status: current.status },
        data: {
          status: dto.status,
          // Ao retirar um caso histórico da publicação, ele deixa de carregar a
          // exceção legada e só poderá voltar após completar o formulário atual.
          ...(current.status === "validado" &&
          dto.status === "pendente" &&
          current.formSchemaVersion === LEGACY_VALIDATED_CASE_SCHEMA_VERSION
            ? { formSchemaVersion: null }
            : {}),
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "O status deste caso foi alterado por outra pessoa. Atualize os detalhes e tente novamente.",
        );
      await tx.caseStatusHistory.create({
        data: {
          caseId: id,
          fromStatus: current.status,
          toStatus: dto.status,
          changedById: user.id,
          note,
        },
      });
    });
    if (current.createdById !== user.id) {
      if (dto.status === "validado") {
        await this.notifications
          .create(
            current.createdById,
            "contribuicao_aceita",
            "Contribuição aceita",
            `Seu caso "${current.nome}" foi validado.`,
            id,
          )
          .catch((error) => this.logger.error(`Falha ao notificar autor do caso ${id}`, error));
      } else if (dto.status === "rejeitado") {
        await this.notifications
          .create(
            current.createdById,
            "contribuicao_retorno",
            "Retorno sobre sua contribuição",
            `Seu caso "${current.nome}" foi rejeitado. Motivo: ${note}`,
            id,
          )
          .catch((error) => this.logger.error(`Falha ao notificar autor do caso ${id}`, error));
      }
    }
    if (dto.status === "validado" && this.structuredDataIsPublic(current)) {
      await this.notifications
        .notifyAreaInteresse(
          current.tipo,
          current.id,
          `Novo caso: ${CASE_TIPO_LABEL[current.tipo]}`,
          `"${current.nome}" foi validado em ${current.municipio}/${current.estado}.`,
          current.createdById,
        )
        .catch((error) =>
          this.logger.error(`Falha ao notificar interessados no caso ${id}`, error),
        );
    }
    return this.findOne(id, user);
  }

  async uploadDocument(
    id: string,
    dto: UploadCaseDocumentDto,
    file: Express.Multer.File | undefined,
    user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("Envie um arquivo");
    const preflight = await this.findOneRaw(id);
    if (preflight.createdById !== user.id) {
      throw new ForbiddenException("Somente o autor pode anexar documentos a este caso");
    }
    if (preflight.status !== "rascunho") {
      throw new ConflictException(
        "Documentos só podem ser incluídos enquanto o caso está em rascunho",
      );
    }
    const validated = await validateCaseAttachment(file);
    const key = `cases/${id}/${randomUUID()}.${validated.extension}`;
    await this.minio.uploadCaseEvidence(key, file.buffer, validated.contentType);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM cases WHERE id = ${id} FOR UPDATE`;
        const current = await tx.case.findUnique({
          where: { id },
          select: { createdById: true, status: true },
        });
        if (!current) throw new NotFoundException("Caso não encontrado");
        if (current.createdById !== user.id) {
          throw new ForbiddenException("Somente o autor pode anexar documentos a este caso");
        }
        if (current.status !== "rascunho") {
          throw new ConflictException(
            "Documentos só podem ser incluídos enquanto o caso está em rascunho",
          );
        }
        let sourceVisibility: string | null | undefined;
        if (dto.sourceId) {
          const source = await tx.caseSource.findFirst({ where: { id: dto.sourceId, caseId: id } });
          if (!source) throw new BadRequestException("A fonte informada não pertence a este caso");
          sourceVisibility = source.grauPublicidade;
          if (dto.visibility === "publico" && sourceVisibility !== "publico") {
            throw new BadRequestException(
              "Um documento ligado a uma fonte restrita não pode solicitar publicação",
            );
          }
        }
        await tx.caseDocument.create({
          data: {
            caseId: id,
            sourceId: dto.sourceId,
            uploadedById: user.id,
            nome: file.originalname,
            mimeType: validated.contentType,
            tamanho: file.size ?? file.buffer.length,
            storageKey: key,
            visibility: "restrito",
            requestedPublic:
              dto.visibility === "publico" &&
              dto.possuiDadosPessoais !== true &&
              (!dto.sourceId || sourceVisibility === "publico"),
            possuiDadosPessoais: dto.possuiDadosPessoais ?? false,
            motivoRestricao: dto.motivoRestricao,
          },
        });
        await tx.case.update({
          where: { id },
          data: {
            ...this.declarationData(false, undefined, user.id),
            revision: { increment: 1 },
          },
        });
      });
    } catch (error) {
      await this.minio
        .deleteCaseEvidence(key)
        .catch((cleanupError) =>
          this.logger.error(`Falha ao remover evidência órfã ${key}`, cleanupError),
        );
      throw error;
    }
    return this.findOne(id, user);
  }

  uploadAnexo(id: string, file: Express.Multer.File | undefined, user: AuthUser) {
    return this.uploadDocument(id, { visibility: "restrito" }, file, user);
  }

  async reviewDocumentPublication(
    caseId: string,
    documentId: string,
    approved: boolean,
    user: AuthUser,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.caseDocument.findFirst({
        where: { id: documentId, caseId },
        include: { source: { select: { grauPublicidade: true } } },
      });
      if (!document) throw new NotFoundException("Documento não encontrado");
      if (
        approved &&
        (!document.requestedPublic ||
          document.possuiDadosPessoais ||
          (document.sourceId && document.source?.grauPublicidade !== "publico"))
      ) {
        throw new BadRequestException("Este documento não pode ser publicado");
      }
      if (approved) {
        const linkedCase = await tx.case.findUnique({
          where: { id: caseId },
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
        });
        if (
          !linkedCase ||
          linkedCase.status !== "validado" ||
          !this.structuredDataIsPublic(linkedCase)
        ) {
          throw new BadRequestException("O caso ainda não permite a publicação de documentos");
        }
      }
      await tx.caseDocument.update({
        where: { id: documentId },
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
    });
    return this.findOne(caseId, user);
  }

  async downloadDocument(caseId: string, documentId: string, user?: AuthUser) {
    const item = await this.findOneRaw(caseId);
    const document = item.documents.find((candidate) => candidate.id === documentId);
    if (!document) throw new NotFoundException("Documento não encontrado");
    const isPublic =
      this.structuredDataIsPublic(item) &&
      item.status === "validado" &&
      document.visibility === "publico" &&
      Boolean(document.publicationApprovedAt) &&
      !document.possuiDadosPessoais &&
      (!document.sourceId || document.source?.grauPublicidade === "publico");
    const canDownloadRestricted = Boolean(
      user &&
      (item.createdById === user.id || hasPermission(user.role, "document:download_restricted")),
    );
    if (!isPublic && !canDownloadRestricted) {
      throw new NotFoundException("Documento não encontrado");
    }
    return {
      buffer: await this.minio.getCaseEvidence(document.storageKey),
      nome: document.nome,
      mimeType: document.mimeType,
    };
  }

  async getDashboard(user?: AuthUser) {
    const visibility = this.visibilityWhere(user);
    const [porStatus, porTipo, porMunicipio] = await Promise.all([
      this.prisma.case.groupBy({ by: ["status"], _count: true, where: visibility }),
      this.prisma.case.groupBy({
        by: ["tipo"],
        _count: true,
        where: {
          AND: [visibility, { status: { in: ["pendente", "em_verificacao", "validado"] } }],
        },
      }),
      this.prisma.case.groupBy({
        by: ["municipio"],
        _count: true,
        where: { AND: [visibility, this.structuredVisibilityWhere(user)] },
        orderBy: { _count: { municipio: "desc" } },
        take: 5,
      }),
    ]);
    const count = (status: CaseStatus) =>
      porStatus.find((row) => row.status === status)?._count ?? 0;
    return {
      casosAtivos: count("pendente") + count("em_verificacao"),
      casosValidados: count("validado"),
      casosRejeitados: count("rejeitado"),
      validacoesPendentes: count("pendente"),
      casosPorTipo: porTipo.map((row) => ({ tipo: row.tipo, casos: row._count })),
      municipiosMaisAfetados: porMunicipio.map((row) => ({
        municipio: row.municipio,
        casos: row._count,
      })),
    };
  }
}
