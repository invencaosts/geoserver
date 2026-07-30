import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLayerDto } from "./dto/create-layer.dto";
import { UpdateLayerDto } from "./dto/update-layer.dto";

@Injectable()
export class LayersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.layer.findMany({ orderBy: { createdAt: "asc" } });
  }

  async findOne(id: string) {
    const layer = await this.prisma.layer.findUnique({ where: { id } });
    if (!layer) throw new NotFoundException("Camada não encontrada");
    return layer;
  }

  create(dto: CreateLayerDto) {
    return this.prisma.layer.create({
      data: {
        nome: dto.nome,
        tipo: dto.tipo,
        categoria: dto.categoria ?? "overlay",
        url: dto.url,
        fonte: dto.fonte,
        descricao: dto.descricao,
        opacidade: dto.opacidade ?? 100,
      },
    });
  }

  async update(id: string, dto: UpdateLayerDto) {
    await this.findOne(id);
    return this.prisma.layer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.layer.delete({ where: { id } });
    return { success: true };
  }
}
