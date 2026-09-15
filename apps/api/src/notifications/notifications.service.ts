import { Injectable, NotFoundException } from "@nestjs/common";
import type { CaseTipo, NotificationTipo } from "@geo/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, lida: false } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notificação não encontrada");
    }
    return this.prisma.notification.update({ where: { id }, data: { lida: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, lida: false },
      data: { lida: true },
    });
  }

  create(
    userId: string,
    tipo: NotificationTipo,
    titulo: string,
    mensagem: string,
    caseId?: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, tipo, titulo, mensagem, caseId },
    });
  }

  async notifyAreaInteresse(
    tipo: CaseTipo,
    caseId: string,
    titulo: string,
    mensagem: string,
    excludeUserId: string,
  ) {
    const interessados = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        status: "ativo",
        areasInteresse: { has: tipo },
      },
      select: { id: true },
    });

    if (interessados.length === 0) return;

    await this.prisma.notification.createMany({
      data: interessados.map((u) => ({
        userId: u.id,
        tipo: "novo_caso_area_interesse" as NotificationTipo,
        titulo,
        mensagem,
        caseId,
      })),
    });
  }
}
