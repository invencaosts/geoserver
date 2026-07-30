import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { UpdateUserDto } from "./dto/update-user.dto";

const SAFE_SELECT = {
  id: true,
  nome: true,
  email: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: SAFE_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuário não encontrado");

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_SELECT,
    });
  }

  async updateAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Envie uma imagem");
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException("Formato inválido. Use JPEG, PNG ou WebP");
    }

    const ext = file.mimetype.split("/")[1];
    const key = `users/${userId}/${randomUUID()}.${ext}`;
    const avatarUrl = await this.minio.uploadAvatar(key, file.buffer, file.mimetype);

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: SAFE_SELECT,
    });
  }
}
