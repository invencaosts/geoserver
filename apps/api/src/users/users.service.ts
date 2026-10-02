import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { hasPermission, RESEARCHER_ASSIGNABLE_ROLES, ROLE_LABEL, type AuthUser } from "@geo/shared";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MinioService } from "../storage/minio.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { validateAvatarUpload } from "../common/upload-validation";
import {
  normalizeOptionalCpfOrCnpj,
  normalizeOptionalEmail,
  normalizeOptionalText,
} from "../common/normalize-identifiers";
import {
  onboardingProfileIsComplete,
  researcherProfileIsComplete,
} from "../common/profile-completeness";

const SELF_SELECT = {
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
  onboardingProfile: {
    select: {
      municipio: true,
      estado: true,
      escolaridade: true,
      perfilUsuario: true,
      perfilUsuarioOutro: true,
      possuiVinculo: true,
      instituicaoCnpj: true,
      instituicaoNome: true,
      instituicaoEmail: true,
      tipoVinculo: true,
      tipoVinculoOutro: true,
      comoConheceu: true,
      comoConheceuOutro: true,
      finalidadeAcesso: true,
      finalidadeAcessoOutro: true,
    },
  },
  researcherProfile: {
    select: {
      emailProfissional: true,
      telefoneWhatsapp: true,
      instituicaoNome: true,
      instituicaoCnpj: true,
      instituicaoEmail: true,
      tipoVinculo: true,
      cargoFuncao: true,
      estadoAtuacao: true,
      municipioAtuacao: true,
      perfilProfissional: true,
      nivelFormacao: true,
      finalidadeUso: true,
      completo: true,
      links: { select: { id: true, tipo: true, url: true } },
    },
  },
} as const;

const SUMMARY_SELECT = {
  id: true,
  nome: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
  researcherProfile: { select: { completo: true } },
} as const;

function definedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: SUMMARY_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return users.map(({ researcherProfile, ...user }) => ({
      ...user,
      researcherProfileComplete: researcherProfile?.completo ?? false,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SELF_SELECT });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const { onboardingProfile, researcherProfile, ...userFields } = dto;
    const normalizedUserFields = {
      ...userFields,
      nomeSocial: normalizeOptionalText(userFields.nomeSocial),
      telefone: normalizeOptionalText(userFields.telefone),
      instituicao: normalizeOptionalText(userFields.instituicao),
      endereco: normalizeOptionalText(userFields.endereco),
      localidade: normalizeOptionalText(userFields.localidade),
      quemRepresenta: normalizeOptionalText(userFields.quemRepresenta),
      idiomas: userFields.idiomas?.map((value) => value.trim()).filter(Boolean),
    };
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`user-profile-role:${id}`}))`;
        const currentUser = await tx.user.findUnique({
          where: { id },
          select: { role: true, onboardingProfile: true, researcherProfile: true },
        });
        if (!currentUser) throw new NotFoundException("Usuário não encontrado");
        await tx.user.update({ where: { id }, data: normalizedUserFields });
        if (onboardingProfile) {
          const onboardingData = {
            ...onboardingProfile,
            municipio: normalizeOptionalText(onboardingProfile.municipio),
            estado:
              onboardingProfile.estado == null
                ? onboardingProfile.estado
                : onboardingProfile.estado.trim().toUpperCase(),
            escolaridade: normalizeOptionalText(onboardingProfile.escolaridade),
            perfilUsuario: normalizeOptionalText(onboardingProfile.perfilUsuario),
            perfilUsuarioOutro: normalizeOptionalText(onboardingProfile.perfilUsuarioOutro),
            instituicaoCnpj: normalizeOptionalCpfOrCnpj(onboardingProfile.instituicaoCnpj),
            instituicaoNome: normalizeOptionalText(onboardingProfile.instituicaoNome),
            instituicaoEmail: normalizeOptionalEmail(onboardingProfile.instituicaoEmail),
            tipoVinculo: normalizeOptionalText(onboardingProfile.tipoVinculo),
            tipoVinculoOutro: normalizeOptionalText(onboardingProfile.tipoVinculoOutro),
            comoConheceu: normalizeOptionalText(onboardingProfile.comoConheceu),
            comoConheceuOutro: normalizeOptionalText(onboardingProfile.comoConheceuOutro),
            finalidadeAcesso: normalizeOptionalText(onboardingProfile.finalidadeAcesso),
            finalidadeAcessoOutro: normalizeOptionalText(onboardingProfile.finalidadeAcessoOutro),
            ...(onboardingProfile.perfilUsuario !== undefined &&
            onboardingProfile.perfilUsuario !== "outro"
              ? { perfilUsuarioOutro: null }
              : {}),
            ...(onboardingProfile.comoConheceu !== undefined &&
            onboardingProfile.comoConheceu !== "outro"
              ? { comoConheceuOutro: null }
              : {}),
            ...(onboardingProfile.finalidadeAcesso !== undefined &&
            onboardingProfile.finalidadeAcesso !== "outro"
              ? { finalidadeAcessoOutro: null }
              : {}),
            ...(onboardingProfile.tipoVinculo !== undefined &&
            onboardingProfile.tipoVinculo !== "outro"
              ? { tipoVinculoOutro: null }
              : {}),
            ...(onboardingProfile.possuiVinculo === false
              ? {
                  instituicaoCnpj: null,
                  instituicaoNome: null,
                  instituicaoEmail: null,
                  tipoVinculo: null,
                  tipoVinculoOutro: null,
                }
              : {}),
          };
          if (
            !onboardingProfileIsComplete({
              ...(currentUser.onboardingProfile ?? {}),
              ...definedFields(onboardingData),
            })
          ) {
            throw new BadRequestException(
              "Complete município, UF, escolaridade, perfil, vínculo, origem e finalidade de acesso",
            );
          }
          await tx.userOnboardingProfile.upsert({
            where: { userId: id },
            create: { userId: id, ...onboardingData },
            update: onboardingData,
          });
        }
        if (researcherProfile) {
          const { links, ...profileFields } = researcherProfile;
          const normalizedProfileFields = {
            ...profileFields,
            emailProfissional: normalizeOptionalEmail(profileFields.emailProfissional),
            telefoneWhatsapp: normalizeOptionalText(profileFields.telefoneWhatsapp),
            instituicaoNome: normalizeOptionalText(profileFields.instituicaoNome),
            instituicaoCnpj: normalizeOptionalCpfOrCnpj(profileFields.instituicaoCnpj),
            instituicaoEmail: normalizeOptionalEmail(profileFields.instituicaoEmail),
            tipoVinculo: normalizeOptionalText(profileFields.tipoVinculo),
            cargoFuncao: normalizeOptionalText(profileFields.cargoFuncao),
            estadoAtuacao:
              profileFields.estadoAtuacao == null
                ? profileFields.estadoAtuacao
                : profileFields.estadoAtuacao.trim().toUpperCase(),
            municipioAtuacao: normalizeOptionalText(profileFields.municipioAtuacao),
            perfilProfissional: normalizeOptionalText(profileFields.perfilProfissional),
            nivelFormacao: normalizeOptionalText(profileFields.nivelFormacao),
            finalidadeUso: normalizeOptionalText(profileFields.finalidadeUso),
          };
          const institutionalRequired = currentUser.role === "pesquisador_envio_download";
          const completo = researcherProfileIsComplete(
            {
              ...(currentUser.researcherProfile ?? {}),
              ...definedFields(normalizedProfileFields),
            },
            institutionalRequired,
          );
          if (currentUser.role.startsWith("pesquisador_") && !completo) {
            throw new BadRequestException(
              institutionalRequired
                ? "O perfil profissional e institucional deve permanecer completo para este papel"
                : "O perfil profissional deve permanecer completo para este papel",
            );
          }
          const saved = await tx.researcherProfile.upsert({
            where: { userId: id },
            create: { userId: id, ...normalizedProfileFields, completo },
            update: { ...normalizedProfileFields, completo },
          });
          if (links) {
            await tx.researcherProfileLink.deleteMany({ where: { researcherProfileId: saved.id } });
            if (links.length) {
              await tx.researcherProfileLink.createMany({
                data: links.map((link) => ({
                  researcherProfileId: saved.id,
                  tipo: link.tipo,
                  url: link.url.trim(),
                })),
              });
            }
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    if (id === actor.id)
      throw new ForbiddenException("Você não pode alterar o próprio papel ou status");
    return this.prisma.$transaction(
      async (tx) => {
        // Evita write skew quando dois administradores tentam remover os últimos admins em paralelo.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('active-admin-role'))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`user-profile-role:${id}`}))`;
        const user = await tx.user.findUnique({
          where: { id },
          include: { researcherProfile: true },
        });
        if (!user) throw new NotFoundException("Usuário não encontrado");

        if (!hasPermission(actor.role, "user:manage")) {
          // Verificador: só move contas entre visualizador e os dois níveis de pesquisador.
          if (dto.status !== undefined) {
            throw new ForbiddenException(
              "Somente um administrador pode ativar ou desativar contas",
            );
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

        if (dto.role?.startsWith("pesquisador_") && dto.role !== user.role) {
          const institutionalRequired = dto.role === "pesquisador_envio_download";
          if (!researcherProfileIsComplete(user.researcherProfile, institutionalRequired)) {
            throw new BadRequestException(
              institutionalRequired
                ? "Complete o perfil profissional e institucional antes de conceder envio e download"
                : "Complete o perfil profissional antes de conceder acesso de pesquisador",
            );
          }
        }

        const removesActiveAdmin =
          user.role === "admin" &&
          user.status === "ativo" &&
          ((dto.role !== undefined && dto.role !== "admin") || dto.status === "inativo");
        if (removesActiveAdmin) {
          const otherAdmins = await tx.user.count({
            where: { id: { not: id }, role: "admin", status: "ativo" },
          });
          if (otherAdmins === 0) {
            throw new BadRequestException(
              "Não é possível remover ou desativar o último administrador",
            );
          }
        }

        const updated = await tx.user.updateMany({
          where: { id, role: user.role, status: user.status, updatedAt: user.updatedAt },
          data: dto,
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            "O usuário foi alterado por outra pessoa; atualize e tente novamente",
          );
        }
        const result = await tx.user.findUniqueOrThrow({ where: { id }, select: SUMMARY_SELECT });
        const { researcherProfile, ...summary } = result;
        return { ...summary, researcherProfileComplete: researcherProfile?.completo ?? false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
      select: SELF_SELECT,
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
