import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { TimelineJsonDTO, TimelineJsEvent } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { TimelineEscopo, type TimelineEvent } from "@prisma/client";
import type { CreateTimelineEventDto } from "./dto/create-timeline-event.dto";
import type { UpdateTimelineEventDto } from "./dto/update-timeline-event.dto";

export type TimelineModo = "todos" | "nacional" | "estadual";

const MEDIA_EXTENSOES = ["pdf", "png", "jpg", "jpeg", "webp", "svg"];

@Injectable()
export class TimelineService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  listAdmin() {
    return this.prisma.timelineEvent.findMany({
      orderBy: [{ escopo: "asc" }, { estado: "asc" }, { startYear: "asc" }],
    });
  }

  async createAdmin(dto: CreateTimelineEventDto, file?: Express.Multer.File) {
    const mediaUrl = file ? await this.uploadMedia(file) : null;

    return this.prisma.timelineEvent.create({
      data: {
        escopo: dto.escopo,
        estado: dto.escopo === "estadual" ? dto.estado!.toUpperCase() : null,
        startYear: dto.startYear,
        startMonth: dto.startMonth ?? null,
        startDay: dto.startDay ?? null,
        endYear: dto.endYear ?? null,
        endMonth: dto.endMonth ?? null,
        endDay: dto.endDay ?? null,
        displayDate: dto.displayDate || null,
        headline: dto.headline,
        text: dto.text,
        mediaUrl,
        mediaCredit: dto.mediaCredit || null,
        mediaCaption: dto.mediaCaption || null,
        type: dto.type || null,
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateTimelineEventDto, file?: Express.Multer.File) {
    const existing = await this.prisma.timelineEvent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Evento não encontrado");

    const mediaUrl = file
      ? await this.uploadMedia(file)
      : dto.removeMedia
        ? null
        : existing.mediaUrl;

    const escopo = dto.escopo ?? existing.escopo;

    return this.prisma.timelineEvent.update({
      where: { id },
      data: {
        escopo,
        estado: escopo === "estadual" ? (dto.estado ?? existing.estado)?.toUpperCase() : null,
        startYear: dto.startYear ?? existing.startYear,
        startMonth: dto.startMonth ?? existing.startMonth,
        startDay: dto.startDay ?? existing.startDay,
        endYear: dto.endYear ?? existing.endYear,
        endMonth: dto.endMonth ?? existing.endMonth,
        endDay: dto.endDay ?? existing.endDay,
        displayDate: dto.displayDate ?? existing.displayDate,
        headline: dto.headline ?? existing.headline,
        text: dto.text ?? existing.text,
        mediaUrl,
        mediaCredit: dto.mediaCredit ?? existing.mediaCredit,
        mediaCaption: dto.mediaCaption ?? existing.mediaCaption,
        type: dto.type !== undefined ? dto.type || null : existing.type,
      },
    });
  }

  async removeAdmin(id: string) {
    const existing = await this.prisma.timelineEvent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Evento não encontrado");
    await this.prisma.timelineEvent.delete({ where: { id } });
    return { success: true };
  }

  private async uploadMedia(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    if (!MEDIA_EXTENSOES.includes(ext)) {
      throw new BadRequestException(
        `Extensão .${ext} não suportada. Use: ${MEDIA_EXTENSOES.join(", ")}`,
      );
    }
    const key = `timeline/${randomUUID()}.${ext}`;
    return this.minio.uploadAttachment(key, file.buffer, file.mimetype);
  }

  async listEstados(): Promise<string[]> {
    const rows = await this.prisma.timelineEvent.findMany({
      where: { estado: { not: null } },
      distinct: ["estado"],
      select: { estado: true },
      orderBy: { estado: "asc" },
    });
    return rows.map((r) => r.estado!).filter(Boolean);
  }

  async getTimeline(modo: TimelineModo, estados: string[]): Promise<TimelineJsonDTO> {
    const where = buildWhere(modo, estados);

    const rows = await this.prisma.timelineEvent.findMany({
      where,
      orderBy: [{ startYear: "asc" }, { order: "asc" }],
    });

    const titleRow = rows.find((r) => r.type === "title");
    const events = rows
      .filter((r) => r.type !== "title" && r.startYear !== null)
      .map((r) => toTimelineJsEvent(r));

    return {
      title: titleRow
        ? {
            text: { headline: titleRow.headline, text: titleRow.text },
            media: titleRow.mediaUrl ? { url: titleRow.mediaUrl } : undefined,
          }
        : undefined,
      events,
    };
  }
}

function buildWhere(modo: TimelineModo, estados: string[]) {
  const estadualClause =
    estados.length > 0
      ? { escopo: TimelineEscopo.estadual, estado: { in: estados } }
      : { escopo: TimelineEscopo.estadual };

  if (modo === "nacional") return { escopo: TimelineEscopo.nacional };
  if (modo === "estadual") return estadualClause;
  return { OR: [{ escopo: TimelineEscopo.nacional }, estadualClause] };
}

function toTimelineJsEvent(row: TimelineEvent): TimelineJsEvent {
  return {
    unique_id: row.id,
    start_date: {
      year: row.startYear!,
      month: row.startMonth ?? undefined,
      day: row.startDay ?? undefined,
    },
    end_date: row.endYear
      ? { year: row.endYear, month: row.endMonth ?? undefined, day: row.endDay ?? undefined }
      : undefined,
    display_date: row.displayDate ?? undefined,
    text: { headline: row.headline, text: row.text },
    media: row.mediaUrl
      ? {
          url: row.mediaUrl,
          credit: row.mediaCredit ?? undefined,
          caption: row.mediaCaption ?? undefined,
          thumbnail: row.mediaThumb ?? undefined,
        }
      : undefined,
    group: row.estado ?? "Nacional",
    background: row.background ? { url: row.background } : undefined,
  };
}
