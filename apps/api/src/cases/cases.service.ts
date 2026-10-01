import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import type { AuthUser, CaseStatus } from "@geo/shared";
import { CASE_TIPO_LABEL } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { UpdateCaseStatusDto } from "./dto/update-case-status.dto";
import { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import { validateCaseAttachment } from "../common/upload-validation";

const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  pendente: ["em_verificacao", "rejeitado"],
  em_verificacao: ["validado", "rejeitado", "pendente"],
  validado: ["pendente"],
  rejeitado: ["pendente"],
};

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private notifications: NotificationsService,
  ) {}

  async findAll(filters: ListCasesQueryDto, user?: AuthUser) {
    // A validação HTTP já impõe estes limites; a normalização também protege
    // chamadas internas e futuras reutilizações do serviço.
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 20)));
    const where = {
      status: filters.status,
      municipio: filters.municipio
        ? { equals: filters.municipio, mode: "insensitive" as const }
        : undefined,
      tipo: filters.tipo,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { createdBy: { select: { id: true, nome: true } } },
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeCase(item, user)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  findForExport(filters: { status?: CaseStatus; municipio?: string; tipo?: string }) {
    return this.prisma.case.findMany({
      where: {
        status: filters.status,
        municipio: filters.municipio
          ? { equals: filters.municipio, mode: "insensitive" as const }
          : undefined,
        tipo: filters.tipo as any,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { createdBy: { select: { id: true, nome: true } } },
    });
  }

  findMapPoints() {
    return this.prisma.case.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        tipo: true,
        prioridade: true,
        status: true,
        lat: true,
        lng: true,
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
      },
    });
    if (!item) throw new NotFoundException("Caso não encontrado");
    return item;
  }

  async findOne(id: string, user?: AuthUser) {
    const item = await this.findOneRaw(id);
    return this.serializeCase(item, user);
  }

  // Visitante anônimo (user undefined) nunca vê dados sensíveis.
  private canReadSensitive(item: { createdById: string }, user?: AuthUser) {
    if (!user) return false;
    return user.role === "admin" || user.role === "verificador" || item.createdById === user.id;
  }

  private serializeCase<T extends { createdById: string }>(item: T, user?: AuthUser) {
    const result: Record<string, unknown> = { ...item };
    // Chaves internas de armazenamento nunca fazem parte da API pública.
    delete result.anexoKey;
    if (!this.canReadSensitive(item, user)) {
      delete result.denunciante;
      delete result.anexoUrl;
      delete result.anexoNome;
    }
    return result;
  }

  async create(dto: CreateCaseDto, user: AuthUser) {
    const created = await this.prisma.case.create({
      data: {
        nome: dto.nome,
        tipo: dto.tipo,
        municipio: dto.municipio,
        estado: dto.estado,
        descricao: dto.descricao,
        lat: dto.lat,
        lng: dto.lng,
        fonteDados: dto.fonteDados,
        denunciante: dto.denunciante,
        prioridade: dto.prioridade ?? "media",
        status: "pendente",
        createdById: user.id,
      },
    });

    await this.prisma.caseStatusHistory.create({
      data: {
        caseId: created.id,
        fromStatus: null,
        toStatus: "pendente",
        changedById: user.id,
        note: "Caso criado",
      },
    });

    await this.notifications.notifyAreaInteresse(
      created.tipo,
      created.id,
      `Novo caso: ${CASE_TIPO_LABEL[created.tipo]}`,
      `"${created.nome}" foi registrado em ${created.municipio}/${created.estado}.`,
      user.id,
    );

    return this.findOne(created.id, user);
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

    if (dto.status === "rejeitado" && !note) {
      throw new BadRequestException("Informe o motivo da rejeição");
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.case.updateMany({
        where: { id, status: current.status },
        data: { status: dto.status },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "O status deste caso foi alterado por outra pessoa. Atualize os detalhes e tente novamente.",
        );
      }
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
        await this.notifications.create(
          current.createdById,
          "contribuicao_aceita",
          "Contribuição aceita",
          `Seu caso "${current.nome}" foi validado.`,
          id,
        );
      } else if (dto.status === "rejeitado") {
        await this.notifications.create(
          current.createdById,
          "contribuicao_retorno",
          "Retorno sobre sua contribuição",
          note
            ? `Seu caso "${current.nome}" foi rejeitado. Motivo: ${note}`
            : `Seu caso "${current.nome}" foi rejeitado.`,
          id,
        );
      }
    }

    return this.findOne(id, user);
  }

  async uploadAnexo(id: string, file: Express.Multer.File | undefined, user: AuthUser) {
    const current = await this.findOneRaw(id);
    if (user.role !== "admin" && current.createdById !== user.id) {
      throw new ForbiddenException(
        "Somente o autor do caso ou um administrador pode anexar arquivos",
      );
    }
    if (current.anexoKey || current.anexoUrl) {
      throw new ConflictException("Este caso já possui um anexo; a substituição não é permitida");
    }
    if (!file) throw new BadRequestException("Envie um arquivo");

    const validated = await validateCaseAttachment(file);
    const ext = validated.extension;

    const key = `cases/${id}/${randomUUID()}.${ext}`;
    const anexoUrl = await this.minio.uploadAttachment(key, file.buffer, validated.contentType);
    let persisted = false;
    try {
      const result = await this.prisma.case.updateMany({
        where: { id, anexoKey: null, anexoUrl: null },
        data: { anexoUrl, anexoKey: key, anexoNome: file.originalname },
      });
      if (result.count !== 1) {
        throw new ConflictException("Outro anexo foi enviado ao mesmo tempo; atualize o caso");
      }
      persisted = true;
    } finally {
      if (!persisted) {
        await this.minio.deleteAttachment(key).catch((error) => {
          this.logger.error(`Falha ao remover anexo órfão ${key} do caso ${id}`, error);
        });
      }
    }

    return this.findOne(id, user);
  }

  async getDashboard() {
    const [porStatus, porTipo, porMunicipio] = await Promise.all([
      this.prisma.case.groupBy({ by: ["status"], _count: true }),
      this.prisma.case.groupBy({
        by: ["tipo"],
        _count: true,
        where: { status: { in: ["pendente", "em_verificacao"] } },
      }),
      this.prisma.case.groupBy({
        by: ["municipio"],
        _count: true,
        orderBy: { _count: { municipio: "desc" } },
        take: 5,
      }),
    ]);

    const count = (status: CaseStatus) => porStatus.find((s) => s.status === status)?._count ?? 0;

    return {
      casosAtivos: count("pendente") + count("em_verificacao"),
      casosValidados: count("validado"),
      casosRejeitados: count("rejeitado"),
      validacoesPendentes: count("pendente"),
      casosPorTipo: porTipo.map((t) => ({ tipo: t.tipo, casos: t._count })),
      municipiosMaisAfetados: porMunicipio.map((m) => ({
        municipio: m.municipio,
        casos: m._count,
      })),
    };
  }
}
