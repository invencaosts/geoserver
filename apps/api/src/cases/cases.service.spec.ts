import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser, CaseStatus } from "@geo/shared";
import { CasesService } from "./cases.service";

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
    anexoUrl: null,
    anexoNome: null,
    anexoKey: null,
    createdById: "author-1",
    createdBy: { id: "author-1", nome: "Autora" },
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-02T10:00:00Z"),
    statusHistory: [],
    notifications: [],
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
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      caseStatusHistory: { create: vi.fn() },
      $transaction: vi.fn(),
    };
    notifications = {
      create: vi.fn(),
      notifyAreaInteresse: vi.fn(),
    };
    minio = {
      uploadAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
    };
    service = new CasesService(prisma, minio, notifications);
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
        where: expect.objectContaining({ status: "validado" }),
        skip: 25,
        take: 25,
      }),
    );
    expect(prisma.case.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: "validado" }),
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
    expect(prisma.case.findUnique).toHaveBeenCalledWith({
      where: { id: "case-1" },
      include: {
        createdBy: { select: { id: true, nome: true } },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          include: { changedBy: { select: { id: true, nome: true } } },
        },
      },
    });
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

  it("redige denunciante e anexo de visualizadores e não autores", async () => {
    const detail = {
      ...caseDetail(),
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
      ...caseDetail(),
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
    expect(result).toHaveProperty("anexoUrl", "/storage/attachments/secret.pdf");
    expect(result).not.toHaveProperty("anexoKey");
  });

  it("impede que usuário não autor envie anexo", async () => {
    prisma.case.findUnique.mockResolvedValue(caseDetail());

    await expect(
      service.uploadAnexo("case-1", {} as Express.Multer.File, verifier),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(minio.uploadAttachment).not.toHaveBeenCalled();
  });

  it("remove o arquivo novo se perder uma corrida de upload", async () => {
    const author = { ...verifier, id: "author-1", role: "pesquisador_envio" as const };
    prisma.case.findUnique.mockResolvedValue(caseDetail());
    prisma.case.updateMany.mockResolvedValue({ count: 0 });
    minio.uploadAttachment.mockResolvedValue("/storage/attachments/new.pdf");
    minio.deleteAttachment.mockResolvedValue(undefined);
    const file = {
      originalname: "evidencia.pdf",
      buffer: Buffer.from("%PDF-1.7 test"),
    } as Express.Multer.File;

    await expect(service.uploadAnexo("case-1", file, author)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(minio.deleteAttachment).toHaveBeenCalledWith(expect.stringContaining("cases/case-1/"));
  });
});
