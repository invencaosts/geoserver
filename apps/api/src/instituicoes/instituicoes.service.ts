import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InstituicoesService {
  constructor(private prisma: PrismaService) {}

  search(q: string) {
    if (!q || q.trim().length < 2) return [];

    return this.prisma.instituicao.findMany({
      where: { nome: { contains: q.trim(), mode: "insensitive" } },
      select: { nome: true, municipio: true, uf: true, tipo: true, dependencia: true },
      take: 20,
      orderBy: { nome: "asc" },
    });
  }
}
