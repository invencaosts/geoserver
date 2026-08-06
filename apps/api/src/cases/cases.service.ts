import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { AuthUser, CaseStatus } from "@geo/shared";
import { CASE_TIPO_LABEL } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { UpdateCaseStatusDto } from "./dto/update-case-status.dto";

const ANEXO_EXTENSOES = ["pdf", "kmz"];

const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  pendente: ["em_verificacao", "rejeitado"],
  em_verificacao: ["validado", "rejeitado", "pendente"],
  validado: ["pendente"],
  rejeitado: ["pendente"],
};

@Injectable()
export class CasesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private notifications: NotificationsService,
  ) {}

  findAll(filters: { status?: CaseStatus; municipio?: string; tipo?: string }) {
    return this.prisma.case.findMany({
      where: {
        status: filters.status,
        municipio: filters.municipio ? { equals: filters.municipio, mode: "insensitive" } : undefined,
        tipo: filters.tipo as any,
      },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, nome: true } } },
    });
  }

  async findOne(id: string) {
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

    return this.findOne(created.id);
  }

  async updateStatus(id: string, dto: UpdateCaseStatusDto, user: AuthUser) {
    const current = await this.findOne(id);

    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${current.status} -> ${dto.status}. Permitido: ${allowed.join(", ")}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.case.update({ where: { id }, data: { status: dto.status } }),
      this.prisma.caseStatusHistory.create({
        data: {
          caseId: id,
          fromStatus: current.status,
          toStatus: dto.status,
          changedById: user.id,
          note: dto.note,
        },
      }),
    ]);

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
          dto.note
            ? `Seu caso "${current.nome}" foi rejeitado. Motivo: ${dto.note}`
            : `Seu caso "${current.nome}" foi rejeitado.`,
          id,
        );
      }
    }

    return this.findOne(id);
  }

  async uploadAnexo(id: string, file?: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Envie um arquivo");

    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    if (!ANEXO_EXTENSOES.includes(ext)) {
      throw new BadRequestException(
        `Extensão .${ext} não suportada para anexo. Use .pdf ou .kmz`,
      );
    }

    const key = `cases/${id}/${randomUUID()}.${ext}`;
    const anexoUrl = await this.minio.uploadAttachment(key, file.buffer, file.mimetype);

    await this.prisma.case.update({
      where: { id },
      data: { anexoUrl, anexoKey: key, anexoNome: file.originalname },
    });

    return this.findOne(id);
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

    const count = (status: CaseStatus) =>
      porStatus.find((s) => s.status === status)?._count ?? 0;

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
