import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { hasPermission, RESEARCHER_ASSIGNABLE_ROLES, ROLE_LABEL, type AuthUser } from "@geo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { validateAvatarUpload } from "../common/upload-validation";

const SAFE_SELECT = {
  id: true,
  nome: true,
  nomeSocial: true,
  email: true,
  cpf: true,
  role: true,
  localidade: true,
  quemRepresenta: true,
  telefone: true,
  instituicao: true,
  endereco: true,
  idiomas: true,
  areasInteresse: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    return user;
  }

  updateProfile(id: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    if (user.id === actor.id) {
      throw new ForbiddenException("Você não pode alterar o próprio papel ou status");
    }

    if (!hasPermission(actor.role, "user:manage")) {
      // Verificador: só move contas entre visualizador e os dois níveis de pesquisador.
      if (dto.status !== undefined) {
        throw new ForbiddenException("Somente um administrador pode ativar ou desativar contas");
      }
      if (!RESEARCHER_ASSIGNABLE_ROLES.includes(user.role)) {
        throw new ForbiddenException(
          `Somente um administrador pode alterar o papel de ${ROLE_LABEL[user.role]}`,
        );
      }
      if (dto.role && !RESEARCHER_ASSIGNABLE_ROLES.includes(dto.role)) {
        throw new ForbiddenException(
          `Somente um administrador pode atribuir o papel ${ROLE_LABEL[dto.role]}`,
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_SELECT,
    });
  }

  async updateAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Envie uma imagem");
    const validated = validateAvatarUpload(file);
    const key = `users/${userId}/${randomUUID()}.${validated.extension}`;
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const avatarUrl = await this.minio.uploadAvatar(key, file.buffer, validated.contentType);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: SAFE_SELECT,
    });

    // a foto nova já está salva; uma falha aqui só deixa a antiga órfã no bucket
    if (previous?.avatarUrl && previous.avatarUrl !== avatarUrl) {
      await this.minio.deleteAvatarByUrl(previous.avatarUrl, userId).catch((error) => {
        this.logger.error(`Falha ao remover avatar antigo do usuário ${userId}`, error);
      });
    }
    return updated;
  }
}
