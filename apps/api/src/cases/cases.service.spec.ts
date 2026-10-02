import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import {
  CASE_DECLARATION_TEXT,
  CASE_DECLARATION_VERSION,
  CASE_FORM_SCHEMA_VERSION,
  LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
  type AuthUser,
  type CaseStatus,
} from "@geo/shared";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CasesService,
  LEGACY_EVIDENCE_CLAIM_TIMEOUT_MS,
  LEGACY_EVIDENCE_RECONCILIATION_BATCH_SIZE,
  LEGACY_EVIDENCE_RECONCILIATION_INTERVAL_MS,
  LEGACY_EVIDENCE_RETRY_BACKOFF_MS,
} from "./cases.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";

const verifier: AuthUser = {
  id: "verifier-1",
  nome: "Verificadora",
  email: "verificadora@example.test",
  role: "verificador",
  status: "ativo",
};

function caseDetail(status: CaseStatus = "pendente") {
  return {
    id: "case-1",
    nome: "Caso fictício",
    tipo: "car",
    municipio: "Barreiras",
    estado: "BA",
    descricao: "Relato de teste",
    lat: -12.15,
    lng: -44.99,
    fonteDados: "Fonte fictícia",
    denunciante: "Pessoa fictícia",
    prioridade: "alta",
    status,
    declarationAccepted: true,
    formSchemaVersion: null,
    revision: 0,
    submittedAt: new Date("2026-08-01T11:00:00Z"),
    anexoUrl: null,
    anexoNome: null,
    anexoKey: null,
    createdById: "author-1",
    createdBy: { id: "author-1", nome: "Autora" },
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-02T10:00:00Z"),
    statusHistory: [],
    notifications: [],
    contribution: null,
    sources: [],
    documents: [],
    facets: [],
    spatialReferences: [],
    datasets: [],
  };
}

const REQUIRED_CATEGORIES = [
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
];

function completeCaseForReview(restricted = false) {
  const declarationHash = createHash("sha256")
    .update(`${CASE_DECLARATION_VERSION}\n${CASE_DECLARATION_TEXT}`)
    .digest("hex");
  const contentHash = createHash("sha256").update(JSON.stringify({})).digest("hex");
  return {
    ...caseDetail("em_verificacao"),
    formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
    declarationAccepted: true,
    declarationVersion: CASE_DECLARATION_VERSION,
    declarationText: CASE_DECLARATION_TEXT,
    declarationHash,
    declarationContentHash: contentHash,
    declarationAcceptedRevision: 0,
    declarationAcceptedAt: new Date(),
    declarationAcceptedById: "author-1",
    contribution: {
      grauPublicidadeInformacoes: "publico",
      possuiRestricaoDivulgacao: restricted,
      restricaoDivulgacao: restricted ? "Proteção de comunidade" : null,
    },
    sources: [{ id: "source-1", titulo: "Fonte" }],
    facets: REQUIRED_CATEGORIES.map((categoria) => ({
      optionId: `option-${categoria}`,
      valorOutro: null,
      option: {
        categoria,
        codigo: categoria === "grau_publicidade" ? "publico" : "opcao",
        label: "Opção",
        ativo: true,
      },
    })),
    spatialReferences: [{ id: "reference-1", valor: "-12,-38" }],
  };
}

describe("CasesService", () => {
  let service: CasesService;
  let prisma: any;
  let notifications: any;
  let minio: any;

  beforeEach(() => {
    prisma = {
      case: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      caseStatusHistory: { create: vi.fn() },
      caseDocument: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      formOption: {
        findMany: vi.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.id.in.map((id: string) => ({
              id,
              categoria: id.startsWith("mecanismo") ? "mecanismo_grilagem" : "objeto_espolio",
              codigo: id.endsWith("outro") ? "outro" : "opcao",
            })),
          ),
        ),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    };
    notifications = {
      create: vi.fn().mockResolvedValue(undefined),
      notifyAreaInteresse: vi.fn().mockResolvedValue(undefined),
    };
    minio = {
      uploadCaseEvidence: vi.fn(),
      deleteCaseEvidence: vi.fn(),
      getCaseEvidence: vi.fn(),
      migrateLegacyCaseEvidence: vi.fn(),
    };
    service = new CasesService(prisma, minio, notifications);
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it("rejeita aceite de uma versão antiga da declaração", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };

    await expect(
      service.create({ declarationAccepted: true, declarationVersion: "versao-antiga" }, author),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("bloqueia escritas de rascunho durante a fase compatível do rolling deploy", async () => {
    const gated = new CasesService(prisma, minio, notifications, {
      get: (key: string) => (key === "CASE_DRAFTS_ENABLED" ? "false" : undefined),
    } as ConfigService);
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };

    await expect(gated.create({}, author)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      gated.updateDraft("case-1", { revision: 0, descricao: "mudança" }, author),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("registra o estado da migração de evidência legada até a conclusão", async () => {
    prisma.caseDocument.findMany.mockResolvedValue([
      { id: "document-1", storageKey: "cases/case-1/legacy.pdf" },
    ]);
    minio.migrateLegacyCaseEvidence.mockResolvedValue({
      size: 123,
      contentType: "application/pdf",
    });

    await service.onModuleInit();

    await vi.waitFor(() => expect(prisma.caseDocument.updateMany).toHaveBeenCalledTimes(2));

    const claim = prisma.caseDocument.updateMany.mock.calls[0][0];
    expect(claim).toEqual({
      where: expect.objectContaining({ id: "document-1", OR: expect.any(Array) }),
      data: expect.objectContaining({
        migrationStatus: "processing",
        migrationError: null,
        migrationClaimedAt: expect.any(Date),
        migrationNextAttemptAt: null,
      }),
    });
    expect(prisma.caseDocument.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "document-1",
        migrationStatus: "processing",
        migrationClaimedAt: claim.data.migrationClaimedAt,
      },
      data: {
        migrationStatus: "completed",
        migrationError: null,
        migrationClaimedAt: null,
        migrationNextAttemptAt: null,
        tamanho: 123,
        mimeType: "application/pdf",
      },
    });
  });

  it("persiste erro de migração para permitir retomada segura", async () => {
    prisma.caseDocument.findMany.mockResolvedValue([
      { id: "document-1", storageKey: "cases/case-1/legacy.pdf" },
    ]);
    minio.migrateLegacyCaseEvidence.mockRejectedValue(new Error("objeto ausente"));

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    await vi.waitFor(() =>
      expect(prisma.caseDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ migrationStatus: "error" }) }),
      ),
    );

    expect(prisma.caseDocument.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        id: "document-1",
        migrationStatus: "processing",
        migrationClaimedAt: expect.any(Date),
      }),
      data: {
        migrationStatus: "error",
        migrationError: "objeto ausente",
        migrationClaimedAt: null,
        migrationNextAttemptAt: expect.any(Date),
      },
    });
    const nextAttempt = prisma.caseDocument.updateMany.mock.lastCall[0].data
      .migrationNextAttemptAt as Date;
    expect(nextAttempt.getTime()).toBeGreaterThanOrEqual(
      Date.now() + LEGACY_EVIDENCE_RETRY_BACKOFF_MS - 1_000,
    );
  });

  it("não bloqueia a leitura do caso quando a reconciliação do anexo falha", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.caseDocument.findMany.mockResolvedValue([
      { id: "document-1", storageKey: "cases/case-1/ausente.pdf" },
    ]);
    minio.migrateLegacyCaseEvidence.mockRejectedValue(new Error("objeto ausente"));
    prisma.case.findUnique.mockResolvedValue(caseDetail("pendente"));

    await service.onModuleInit();
    await vi.waitFor(() =>
      expect(prisma.caseDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ migrationStatus: "error" }) }),
      ),
    );
    minio.migrateLegacyCaseEvidence.mockClear();

    await expect(service.findOne("case-1", verifier)).resolves.toMatchObject({ id: "case-1" });
    await expect(service.findOne("case-1", verifier)).resolves.toMatchObject({ id: "case-1" });
    expect(minio.migrateLegacyCaseEvidence).not.toHaveBeenCalled();
  });

  it("usa claim atômico e ignora documento obtido por outro pod", async () => {
    prisma.caseDocument.findMany.mockResolvedValue([
      { id: "document-1", storageKey: "cases/case-1/legacy.pdf" },
    ]);
    prisma.caseDocument.updateMany.mockResolvedValueOnce({ count: 0 });

    await service.onModuleInit();

    await vi.waitFor(() => expect(prisma.caseDocument.updateMany).toHaveBeenCalled());

    expect(prisma.caseDocument.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "document-1", OR: expect.any(Array) }),
      data: expect.objectContaining({
        migrationStatus: "processing",
        migrationClaimedAt: expect.any(Date),
        migrationNextAttemptAt: null,
      }),
    });
    expect(minio.migrateLegacyCaseEvidence).not.toHaveBeenCalled();
    const query = prisma.caseDocument.findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      orderBy: { id: "asc" },
      take: LEGACY_EVIDENCE_RECONCILIATION_BATCH_SIZE,
    });
    expect(query.where.OR[1]).toEqual({
      migrationStatus: "error",
      OR: [{ migrationNextAttemptAt: null }, { migrationNextAttemptAt: { lte: expect.any(Date) } }],
    });
    expect(query.where.OR[2].OR[1].migrationClaimedAt.lt.getTime()).toBeLessThanOrEqual(
      Date.now() - LEGACY_EVIDENCE_CLAIM_TIMEOUT_MS,
    );
  });

  it("reconcilia anexoKey criado por instância antiga e inicia migração idempotente", async () => {
    const createdAt = new Date("2026-10-01T10:00:00Z");
    prisma.$queryRaw.mockResolvedValue([
      {
        id: "case-legacy",
        createdById: "author-1",
        anexoKey: "cases/case-legacy/prova.pdf",
        anexoNome: "prova.pdf",
        createdAt,
      },
    ]);
    prisma.caseDocument.upsert.mockResolvedValue({
      id: "document-legacy",
      migrationStatus: "pending",
    });
    prisma.caseDocument.findMany.mockResolvedValue([]);

    await service.onModuleInit();

    await vi.waitFor(() => expect(prisma.caseDocument.upsert).toHaveBeenCalled());

    expect(prisma.caseDocument.upsert).toHaveBeenCalledWith({
      where: { storageKey: "cases/case-legacy/prova.pdf" },
      create: expect.objectContaining({
        caseId: "case-legacy",
        storageKey: "cases/case-legacy/prova.pdf",
        migrationStatus: "pending",
        visibility: "restrito",
      }),
      update: {},
      select: { id: true, migrationStatus: true },
    });
    expect(prisma.case.updateMany).toHaveBeenCalledWith({
      where: {
        id: "case-legacy",
        anexoKey: "cases/case-legacy/prova.pdf",
      },
      data: {
        legacyEvidenceReconciledKey: "cases/case-legacy/prova.pdf",
      },
    });
  });

  it("reconcilia periodicamente anexoKey criado após o startup por um pod antigo", async () => {
    vi.useFakeTimers();
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.caseDocument.findMany.mockResolvedValue([]);
    await service.onModuleInit();
    await vi.waitFor(() => expect(prisma.caseDocument.findMany).toHaveBeenCalled());

    prisma.$queryRaw.mockResolvedValue([
      {
        id: "case-rolling",
        createdById: "author-1",
        anexoKey: "cases/case-rolling/prova.pdf",
        anexoNome: "prova.pdf",
        createdAt: new Date(),
      },
    ]);
    prisma.caseDocument.upsert.mockResolvedValue({ id: "doc-rolling", migrationStatus: "pending" });

    await vi.advanceTimersByTimeAsync(LEGACY_EVIDENCE_RECONCILIATION_INTERVAL_MS);

    expect(prisma.caseDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storageKey: "cases/case-rolling/prova.pdf" } }),
    );
  });

  it("não bloqueia o startup nem os ciclos seguintes quando uma cópia legada trava", async () => {
    vi.useFakeTimers();
    prisma.caseDocument.findMany.mockResolvedValue([
      { id: "document-1", storageKey: "cases/case-1/legacy.pdf" },
    ]);
    minio.migrateLegacyCaseEvidence.mockReturnValue(new Promise(() => undefined));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await vi.waitFor(() => expect(minio.migrateLegacyCaseEvidence).toHaveBeenCalled());

    prisma.caseDocument.findMany.mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(LEGACY_EVIDENCE_RECONCILIATION_INTERVAL_MS);

    expect(prisma.caseDocument.findMany).toHaveBeenCalledTimes(2);
  });

  it("pagina e filtra por status no banco, retornando os metadados", async () => {
    const items = [caseDetail("validado")];
    prisma.case.findMany.mockReturnValue("find-many-query");
    prisma.case.count.mockReturnValue("count-query");
    prisma.$transaction.mockResolvedValue([items, 51]);

    await expect(
      service.findAll({ page: 2, limit: 25, status: "validado" }, verifier),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: "case-1", status: "validado" })],
      page: 2,
      limit: 25,
      total: 51,
      totalPages: 3,
    });

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ status: "validado" })]),
        }),
        skip: 25,
        take: 25,
      }),
    );
    expect(prisma.case.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([expect.objectContaining({ status: "validado" })]),
      }),
    });
  });

  it("aplica limites seguros mesmo quando chamado fora do controller", async () => {
    prisma.case.findMany.mockReturnValue("find-many-query");
    prisma.case.count.mockReturnValue("count-query");
    prisma.$transaction.mockResolvedValue([[], 0]);

    const result = await service.findAll({ page: -10, limit: 5_000 } as any, verifier);

    expect(result).toEqual({ items: [], page: 1, limit: 100, total: 0, totalPages: 0 });
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
  });

  it("retorna o detalhe com autor e histórico", async () => {
    const detail = caseDetail();
    prisma.case.findUnique.mockResolvedValue(detail);

    await expect(service.findOne("case-1", verifier)).resolves.toEqual(
      expect.objectContaining({ id: detail.id, denunciante: detail.denunciante }),
    );
    expect(prisma.case.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "case-1" },
        include: expect.objectContaining({
          createdBy: { select: { id: true, nome: true } },
          statusHistory: {
            orderBy: { createdAt: "asc" },
            include: { changedBy: { select: { id: true, nome: true } } },
          },
        }),
      }),
    );
  });

  it("informa quando o detalhe não existe", async () => {
    prisma.case.findUnique.mockResolvedValue(null);
    await expect(service.findOne("missing", verifier)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("registra uma transição válida e devolve o detalhe atualizado", async () => {
    const current = caseDetail("pendente");
    const updated = caseDetail("em_verificacao");
    prisma.case.findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseStatusHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(
      service.updateStatus(
        "case-1",
        { status: "em_verificacao", note: "  Análise iniciada  " },
        verifier,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: updated.id, status: "em_verificacao" }));

    expect(prisma.case.updateMany).toHaveBeenCalledWith({
      where: { id: "case-1", status: "pendente" },
      data: { status: "em_verificacao" },
    });
    expect(prisma.caseStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case-1",
        fromStatus: "pendente",
        toStatus: "em_verificacao",
        changedById: verifier.id,
        note: "Análise iniciada",
      }),
    });
    expect(notifications.create).not.toHaveBeenCalled();
    expect(notifications.notifyAreaInteresse).not.toHaveBeenCalled();
  });

  it("bloqueia transição incompatível com o status atual", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail("validado"));

    await expect(service.updateStatus("case-1", { status: "rejeitado" }, verifier)).rejects.toThrow(
      "Transição inválida",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("exige motivo ao rejeitar um caso", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail("pendente"));

    await expect(
      service.updateStatus("case-1", { status: "rejeitado", note: "   " }, verifier),
    ).rejects.toEqual(new BadRequestException("Informe o motivo da rejeição"));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("retorna conflito se outra validação alterar o status concorrentemente", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail("pendente"));
    prisma.case.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(
      service.updateStatus("case-1", { status: "em_verificacao" }, verifier),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.caseStatusHistory.create).not.toHaveBeenCalled();
  });

  it("usa revisão CAS para impedir perda de atualização no rascunho", async () => {
    prisma.case.findUnique.mockResolvedValue({ ...caseDetail("rascunho"), revision: 4 });
    prisma.case.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };

    await expect(
      service.updateDraft("case-1", { revision: 4, descricao: "Nova versão" }, author),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "case-1", status: "rascunho", revision: 4 },
        data: expect.objectContaining({ revision: { increment: 1 } }),
      }),
    );
  });

  it("rejeita cliente desatualizado antes de sobrescrever coleções", async () => {
    prisma.case.findUnique.mockResolvedValue({ ...caseDetail("rascunho"), revision: 4 });
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };

    await expect(
      service.updateDraft("case-1", { revision: 3, sources: [] }, author),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reabre caso rejeitado como rascunho e registra a transição", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const rejected = { ...caseDetail("rejeitado"), revision: 5 };
    const reopened = { ...caseDetail("rascunho"), revision: 7 };
    prisma.case.findUnique.mockResolvedValueOnce(rejected).mockResolvedValueOnce(reopened);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseStatusHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateDraft("case-1", { revision: 5, descricao: "Correção do autor" }, author);

    expect(prisma.caseStatusHistory.create).toHaveBeenCalledWith({
      data: {
        caseId: "case-1",
        fromStatus: "rejeitado",
        toStatus: "rascunho",
        changedById: "author-1",
        note: "Caso reaberto pelo autor para correção",
      },
    });
    expect(prisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "case-1", status: "rejeitado", revision: 5 },
        data: expect.objectContaining({ status: "rascunho", revision: { increment: 1 } }),
      }),
    );
  });

  it("impede verificador de editar ou submeter rascunho alheio", async () => {
    prisma.case.findUnique.mockResolvedValue({ ...caseDetail("rascunho"), revision: 1 });

    await expect(
      service.updateDraft("case-1", { revision: 1, descricao: "adulteração" }, verifier),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));
    await expect(service.submit("case-1", verifier)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.case.updateMany).not.toHaveBeenCalled();
  });

  it("registra o autor que aceitou a declaração", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    prisma.case.findUnique.mockResolvedValue({ ...caseDetail("rascunho"), revision: 1 });
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateDraft(
      "case-1",
      {
        revision: 1,
        declarationAccepted: true,
        declarationVersion: CASE_DECLARATION_VERSION,
      },
      author,
    );

    expect(prisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          declarationAccepted: true,
          declarationAcceptedById: author.id,
          declarationAcceptedRevision: 2,
          declarationContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("invalida aceite anterior quando qualquer conteúdo do rascunho muda", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    prisma.case.findUnique.mockResolvedValue({
      ...caseDetail("rascunho"),
      revision: 2,
      declarationAcceptedAt: new Date(),
      declarationAcceptedRevision: 2,
      declarationContentHash: "hash-antigo",
    });
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateDraft("case-1", { revision: 2, descricao: "Conteúdo novo" }, author);

    expect(prisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          declarationAccepted: false,
          declarationAcceptedAt: null,
          declarationContentHash: null,
          declarationAcceptedRevision: null,
        }),
      }),
    );
  });

  it("exige resposta explícita sobre restrição antes da submissão", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const categories = [
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
    ];
    const declarationHash = createHash("sha256")
      .update(`${CASE_DECLARATION_VERSION}\n${CASE_DECLARATION_TEXT}`)
      .digest("hex");
    prisma.case.findUnique.mockResolvedValue({
      ...caseDetail("rascunho"),
      nome: "Caso completo",
      municipio: "Salvador",
      estado: "BA",
      revision: 8,
      declarationAccepted: true,
      declarationVersion: CASE_DECLARATION_VERSION,
      declarationText: CASE_DECLARATION_TEXT,
      declarationHash,
      declarationContentHash: "conteudo",
      declarationAcceptedRevision: 8,
      declarationAcceptedAt: new Date(),
      declarationAcceptedById: author.id,
      contribution: {
        grauPublicidadeInformacoes: "publico",
        possuiRestricaoDivulgacao: null,
      },
      sources: [{ id: "source-1", titulo: "Fonte" }],
      facets: categories.map((categoria) => ({
        valorOutro: null,
        option: {
          categoria,
          codigo: categoria === "grau_publicidade" ? "publico" : "opcao",
          ativo: true,
        },
      })),
      spatialReferences: [{ id: "ref-1", valor: "-12,-38" }],
    });
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(service.submit("case-1", author)).rejects.toThrow("Complete o questionário");
    expect(prisma.case.updateMany).not.toHaveBeenCalled();
  });

  it("marca como atual o caso legado somente depois de completar e submeter o formulário", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const current = {
      ...completeCaseForReview(false),
      status: "rascunho" as const,
      formSchemaVersion: null,
      nome: "Caso legado complementado",
      municipio: "Salvador",
      estado: "BA",
    };
    const submitted = {
      ...current,
      status: "pendente" as const,
      formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
    };
    prisma.case.findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(submitted);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseStatusHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.submit("case-1", author);

    expect(prisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "case-1", status: "rascunho" },
        data: expect.objectContaining({
          status: "pendente",
          formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
        }),
      }),
    );
  });

  it("não distribui detalhes de caso restrito nas notificações por interesse", async () => {
    const current: any = completeCaseForReview(true);
    const updated = { ...current, status: "validado" };
    prisma.case.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(updated);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseStatusHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateStatus("case-1", { status: "validado" }, verifier);

    expect(notifications.create).toHaveBeenCalledWith(
      "author-1",
      "contribuicao_aceita",
      expect.any(String),
      expect.any(String),
      "case-1",
    );
    expect(notifications.notifyAreaInteresse).not.toHaveBeenCalled();
  });

  it("impede validar silenciosamente caso legado sem formulário e declaração atuais", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail("em_verificacao"));
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(service.updateStatus("case-1", { status: "validado" }, verifier)).rejects.toThrow(
      "Caso legado",
    );

    expect(prisma.case.updateMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("remove a exceção histórica quando um caso legado validado volta para pendente", async () => {
    const current = {
      ...caseDetail("validado"),
      formSchemaVersion: LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
    };
    const pending = { ...current, status: "pendente", formSchemaVersion: null };
    prisma.case.findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(pending);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseStatusHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateStatus("case-1", { status: "pendente" }, verifier);

    expect(prisma.case.updateMany).toHaveBeenCalledWith({
      where: { id: "case-1", status: "validado" },
      data: { status: "pendente", formSchemaVersion: null },
    });
  });

  it("não aprova documento público enquanto o caso restringe divulgação", async () => {
    prisma.caseDocument.findFirst = vi.fn().mockResolvedValue({
      id: "document-1",
      requestedPublic: true,
      possuiDadosPessoais: false,
    });
    prisma.caseDocument.update = vi.fn();
    prisma.case.findUnique.mockResolvedValue({
      status: "validado",
      formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
      contribution: {
        grauPublicidadeInformacoes: "publico",
        possuiRestricaoDivulgacao: true,
      },
    });
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(
      service.reviewDocumentPublication("case-1", "document-1", true, verifier),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.caseDocument.update).not.toHaveBeenCalled();
  });

  it("nunca aprova documento ligado a fonte restrita", async () => {
    prisma.caseDocument.findFirst = vi.fn().mockResolvedValue({
      id: "document-1",
      sourceId: "source-1",
      source: { grauPublicidade: "restrito" },
      requestedPublic: true,
      possuiDadosPessoais: false,
    });
    prisma.caseDocument.update = vi.fn();
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(
      service.reviewDocumentPublication("case-1", "document-1", true, verifier),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.caseDocument.update).not.toHaveBeenCalled();
  });

  it("persiste limpeza explícita e coleções vazias no rascunho", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const draft: any = { ...caseDetail("rascunho"), revision: 2 };
    prisma.case.findUnique.mockResolvedValue(draft);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseContribution = { upsert: vi.fn() };
    prisma.caseSource = { deleteMany: vi.fn() };
    prisma.caseFacetSelection = { deleteMany: vi.fn(), createMany: vi.fn() };
    prisma.caseSpatialReference = {
      deleteMany: vi.fn(),
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: "reference-1" })
        .mockResolvedValueOnce({ id: "reference-2" }),
      updateMany: vi.fn(),
    };
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateDraft(
      "case-1",
      {
        revision: 2,
        descricao: null,
        denunciante: null,
        contribution: { relacaoPesquisador: null },
        sources: [],
        facets: [],
        spatialReferences: [],
      },
      author,
    );

    expect(prisma.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ descricao: null, denunciante: null }),
      }),
    );
    expect(prisma.caseContribution.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { relacaoPesquisador: null } }),
    );
    expect(prisma.caseSource.deleteMany).toHaveBeenCalled();
    expect(prisma.caseFacetSelection.deleteMany).toHaveBeenCalled();
    expect(prisma.caseSpatialReference.deleteMany).toHaveBeenCalled();
  });

  it("mantém múltiplas facetas e referências espaciais no round-trip", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const draft: any = { ...caseDetail("rascunho"), revision: 3 };
    prisma.case.findUnique.mockResolvedValue(draft);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseFacetSelection = { deleteMany: vi.fn(), createMany: vi.fn() };
    prisma.caseSpatialReference = {
      deleteMany: vi.fn(),
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: "reference-1" })
        .mockResolvedValueOnce({ id: "reference-2" }),
      updateMany: vi.fn(),
    };
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateDraft(
      "case-1",
      {
        revision: 3,
        facets: [
          { optionId: "mecanismo-1" },
          { optionId: "objeto-outro", valorOutro: "Descrição específica" },
        ],
        spatialReferences: [
          { tipo: "car", valor: "CAR-1" },
          { tipo: "sigef", valor: "SIGEF-2", descricao: "Parcela" },
        ],
      },
      author,
    );

    expect(prisma.caseFacetSelection.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(prisma.caseSpatialReference.create).toHaveBeenCalledTimes(2);
    expect(prisma.caseSpatialReference.deleteMany).toHaveBeenCalledWith({
      where: { caseId: "case-1", id: { notIn: ["reference-1", "reference-2"] } },
    });
  });

  it("rejeita opção Outro sem especificação e opção fora do catálogo ativo", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const draft: any = { ...caseDetail("rascunho"), revision: 3 };
    prisma.case.findUnique.mockResolvedValue(draft);
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await expect(
      service.updateDraft(
        "case-1",
        { revision: 3, facets: [{ optionId: "objeto-outro", valorOutro: "   " }] },
        author,
      ),
    ).rejects.toThrow("Especifique a opção Outro");

    prisma.formOption.findMany.mockResolvedValueOnce([]);
    await expect(
      service.updateDraft("case-1", { revision: 3, facets: [{ optionId: "inexistente" }] }, author),
    ).rejects.toThrow("inválidas ou inativas");
  });

  it("preserva ids de referências espaciais pertencentes ao rascunho", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    const draft: any = {
      ...caseDetail("rascunho"),
      revision: 3,
      spatialReferences: [{ id: "reference-1", tipo: "car", valor: "antigo" }],
    };
    prisma.case.findUnique.mockResolvedValue(draft);
    prisma.case.updateMany.mockResolvedValue({ count: 1 });
    prisma.caseSpatialReference = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
      deleteMany: vi.fn(),
    };
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));

    await service.updateDraft(
      "case-1",
      {
        revision: 3,
        spatialReferences: [{ id: "reference-1", tipo: "car", valor: " CAR-ATUALIZADO " }],
      },
      author,
    );

    expect(prisma.caseSpatialReference.updateMany).toHaveBeenCalledWith({
      where: { id: "reference-1", caseId: "case-1" },
      data: { tipo: "car", valor: "CAR-ATUALIZADO", descricao: null },
    });
    expect(prisma.caseSpatialReference.create).not.toHaveBeenCalled();
  });

  it("redige denunciante e anexo de visualizadores e não autores", async () => {
    const detail = {
      ...caseDetail("validado"),
      anexoKey: "cases/case-1/secret.pdf",
      anexoUrl: "/storage/attachments/secret.pdf",
      anexoNome: "secret.pdf",
    };
    prisma.case.findUnique.mockResolvedValue(detail);

    const result = await service.findOne("case-1", {
      id: "reader-1",
      nome: "Leitora",
      email: "leitora@example.test",
      role: "visualizador",
      status: "ativo",
    });

    expect(result).not.toHaveProperty("denunciante");
    expect(result).not.toHaveProperty("anexoUrl");
    expect(result).not.toHaveProperty("anexoNome");
    expect(result).not.toHaveProperty("anexoKey");
  });

  it("redige denunciante e anexo de visitantes anônimos", async () => {
    prisma.case.findUnique.mockResolvedValue({
      ...caseDetail("validado"),
      anexoKey: "cases/case-1/secret.pdf",
      anexoUrl: "/storage/attachments/secret.pdf",
      anexoNome: "secret.pdf",
    });

    const result = await service.findOne("case-1", undefined);

    expect(result).not.toHaveProperty("denunciante");
    expect(result).not.toHaveProperty("anexoUrl");
    expect(result).not.toHaveProperty("anexoNome");
    expect(result).not.toHaveProperty("anexoKey");
  });

  it("permite dados sensíveis ao autor, mas nunca expõe a chave interna", async () => {
    const detail = {
      ...caseDetail(),
      campoInternoFuturo: "não pode vazar",
      anexoKey: "cases/case-1/secret.pdf",
      anexoUrl: "/storage/attachments/secret.pdf",
      anexoNome: "secret.pdf",
    };
    prisma.case.findUnique.mockResolvedValue(detail);

    const result = await service.findOne("case-1", {
      id: "author-1",
      nome: "Autora",
      email: "autora@example.test",
      role: "pesquisador_envio",
      status: "ativo",
    });

    expect(result).toHaveProperty("denunciante", "Pessoa fictícia");
    expect(result).not.toHaveProperty("anexoUrl");
    expect(result).not.toHaveProperty("anexoKey");
    expect(result).not.toHaveProperty("campoInternoFuturo");
  });

  it("impede que usuário não autor envie anexo", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail());
    const reader = { ...verifier, id: "reader-1", role: "visualizador" as const };

    await expect(
      service.uploadAnexo("case-1", {} as Express.Multer.File, reader),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(minio.uploadCaseEvidence).not.toHaveBeenCalled();
  });

  it("não permite que verificador use o endpoint do autor para anexar documento", async () => {
    prisma.case.findUnique.mockResolvedValue({ ...caseDetail("rascunho"), revision: 1 });

    await expect(
      service.uploadAnexo("case-1", {} as Express.Multer.File, verifier),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(minio.uploadCaseEvidence).not.toHaveBeenCalled();
  });

  it("remove o arquivo novo se falhar ao persistir o documento", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    prisma.case.findUnique.mockResolvedValue(caseDetail("rascunho"));
    prisma.caseDocument.create.mockRejectedValue(new ConflictException("conflito"));
    prisma.$transaction.mockImplementation((operation: any) => operation(prisma));
    minio.uploadCaseEvidence.mockResolvedValue("cases/case-1/new.pdf");
    minio.deleteCaseEvidence.mockResolvedValue(undefined);
    const file = {
      originalname: "evidencia.pdf",
      buffer: Buffer.from("%PDF-1.7 test"),
    } as Express.Multer.File;

    await expect(service.uploadAnexo("case-1", file, author)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(minio.deleteCaseEvidence).toHaveBeenCalledWith(expect.stringContaining("cases/case-1/"));
  });

  it("impõe status validado para visitantes nas listagens e no mapa", async () => {
    prisma.case.findMany.mockReturnValue("find-many-query");
    prisma.case.count.mockReturnValue("count-query");
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.findAll({ page: 1, limit: 20 }, undefined);
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ status: "validado" }]),
        }),
      }),
    );

    prisma.case.findMany.mockResolvedValue([]);
    await service.findMapPoints();
    expect(prisma.case.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "validado" }) }),
    );
  });

  it("mantém caso validado legado no mapa usando localização pública arredondada", async () => {
    prisma.case.findMany.mockResolvedValue([
      {
        id: "legacy-1",
        nome: "Caso histórico",
        tipo: "car",
        prioridade: "alta",
        status: "validado",
        lat: -12.123456,
        lng: -38.987654,
        formSchemaVersion: LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
      },
    ]);

    await expect(service.findMapPoints()).resolves.toEqual([
      expect.objectContaining({ id: "legacy-1", lat: -12.123, lng: -38.988 }),
    ]);

    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("formSchemaVersion");
  });

  it("não usa casos restritos como oráculo no filtro público de município", async () => {
    prisma.case.findMany.mockReturnValue("find-many-query");
    prisma.case.count.mockReturnValue("count-query");
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.findAll({ page: 1, limit: 20, municipio: "Barreiras" }, undefined);

    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("possuiRestricaoDivulgacao");
    expect(JSON.stringify(where)).toContain("Barreiras");
  });

  it("oculta caso não validado de usuário que não é autor", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail("pendente"));
    await expect(
      service.findOne("case-1", {
        id: "reader",
        nome: "Reader",
        email: "reader@test.local",
        role: "visualizador",
        status: "ativo",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("só entrega evidência pública após a validação do caso", async () => {
    const detail: any = caseDetail("validado");
    detail.formSchemaVersion = CASE_FORM_SCHEMA_VERSION;
    detail.contribution = {
      grauPublicidadeInformacoes: "publico",
      possuiRestricaoDivulgacao: false,
    };
    detail.documents = [
      {
        id: "doc-1",
        sourceId: null,
        nome: "prova.pdf",
        mimeType: "application/pdf",
        tamanho: 10,
        visibility: "publico",
        requestedPublic: true,
        publicationApprovedAt: new Date(),
        publicationApprovedById: "verifier-1",
        possuiDadosPessoais: false,
        motivoRestricao: null,
        storageKey: "cases/case-1/doc.pdf",
        createdAt: new Date(),
      },
    ];
    prisma.case.findUnique.mockResolvedValue(detail);
    minio.getCaseEvidence.mockResolvedValue(Buffer.from("pdf"));

    await expect(service.downloadDocument("case-1", "doc-1", undefined)).resolves.toEqual(
      expect.objectContaining({ nome: "prova.pdf" }),
    );

    detail.documents[0].visibility = "restrito";
    await expect(service.downloadDocument("case-1", "doc-1", undefined)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("oculta documento aprovado quando sua fonte é restrita", async () => {
    const detail: any = caseDetail("validado");
    detail.formSchemaVersion = CASE_FORM_SCHEMA_VERSION;
    detail.contribution = {
      grauPublicidadeInformacoes: "publico",
      possuiRestricaoDivulgacao: false,
    };
    detail.documents = [
      {
        id: "doc-1",
        sourceId: "source-1",
        source: { grauPublicidade: "restrito" },
        nome: "prova.pdf",
        mimeType: "application/pdf",
        tamanho: 10,
        visibility: "publico",
        requestedPublic: true,
        publicationApprovedAt: new Date(),
        possuiDadosPessoais: false,
        storageKey: "cases/case-1/doc.pdf",
        createdAt: new Date(),
      },
    ];
    prisma.case.findUnique.mockResolvedValue(detail);

    await expect(service.downloadDocument("case-1", "doc-1", undefined)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOne("case-1", undefined)).resolves.toMatchObject({ documents: [] });
  });

  it("remove localização e conteúdo estruturado da projeção pública restrita", async () => {
    const detail: any = caseDetail("validado");
    detail.formSchemaVersion = CASE_FORM_SCHEMA_VERSION;
    detail.contribution = {
      grauPublicidadeInformacoes: "publico",
      possuiRestricaoDivulgacao: true,
      restricaoDivulgacao: "Proteção de comunidade ameaçada",
    };
    detail.sources = [
      { id: "source-1", titulo: "Fonte", grauPublicidade: "publico", referencia: "x" },
    ];
    detail.facets = [
      {
        optionId: "opt-1",
        valorOutro: null,
        option: { categoria: "mecanismo", codigo: "x", label: "X" },
      },
    ];
    detail.spatialReferences = [
      { id: "ref-1", tipo: "car", valor: "CAR-SECRETO", descricao: null },
    ];
    detail.datasets = [
      { id: "dataset-1", visibility: "publico", createdById: "author-1", caseId: "case-1" },
    ];
    prisma.case.findUnique.mockResolvedValue(detail);

    const result = await service.findOne("case-1", undefined);

    expect(result).not.toHaveProperty("municipio");
    expect(result).not.toHaveProperty("descricao");
    expect(result).not.toHaveProperty("lat");
    expect(result.sources).toEqual([]);
    expect(result.facets).toEqual([]);
    expect(result.spatialReferences).toEqual([]);
    expect(result.datasets).toEqual([]);
  });

  it("trata resposta nula sobre restrição como restrita por padrão", async () => {
    const detail: any = caseDetail("validado");
    detail.formSchemaVersion = CASE_FORM_SCHEMA_VERSION;
    detail.contribution = {
      grauPublicidadeInformacoes: "publico",
      possuiRestricaoDivulgacao: null,
    };
    prisma.case.findUnique.mockResolvedValue(detail);

    const result = await service.findOne("case-1", undefined);

    expect(result).not.toHaveProperty("municipio");
    expect(result.contribution).toBeNull();
  });
});

describe("CreateCaseDto", () => {
  it("rejeita UF inválida e fonte formada apenas por espaços", async () => {
    const dto = plainToInstance(CreateCaseDto, {
      estado: "Bahia",
      sources: [{ titulo: "   " }],
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["estado", "sources"]),
    );
  });

  it("exige revisão no PATCH para concorrência otimista real", async () => {
    const withoutRevision = plainToInstance(UpdateCaseDto, { descricao: "mudança" });
    const withRevision = plainToInstance(UpdateCaseDto, { descricao: "mudança", revision: 3 });

    expect((await validate(withoutRevision)).map((error) => error.property)).toContain("revision");
    expect((await validate(withRevision)).map((error) => error.property)).not.toContain("revision");
  });
});

describe("migration de compatibilidade de casos legados", () => {
  it("distingue pods antigos de casos históricos já validados e protege a transição no banco", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261001230000_legacy_case_compatibility/migration.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "formSchemaVersion" TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "migrationClaimedAt" TIMESTAMP(3)');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "migrationNextAttemptAt" TIMESTAMP(3)');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "legacyEvidenceReconciledKey" TEXT');
    expect(sql).not.toMatch(/"formSchemaVersion"\s+TEXT\s+DEFAULT/i);
    expect(sql).toContain('c."declarationAcceptedRevision" = c."revision"');
    expect(sql).toContain("AND 16 = (");
    expect(sql).toContain("'formulario-2026-10-v1'");
    expect(sql).toContain("'legado-validado-pre-formulario-v1'");
    expect(sql).toContain('CHECK ("status" <> \'validado\' OR "formSchemaVersion" IS NOT NULL)');
  });
});
