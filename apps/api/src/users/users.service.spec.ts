import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "@geo/shared";
import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { UsersService } from "./users.service";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function avatarFile() {
  return {
    originalname: "foto.png",
    mimetype: "image/png",
    size: PNG.length,
    buffer: PNG,
  } as Express.Multer.File;
}

describe("UsersService.updateAvatar", () => {
  let service: UsersService;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
  let minio: {
    uploadAvatar: ReturnType<typeof vi.fn>;
    deleteAvatarByUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: "u1" }) } };
    minio = {
      uploadAvatar: vi.fn().mockResolvedValue("http://minio/avatars/users/u1/nova.png"),
      deleteAvatarByUrl: vi.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
    );
  });

  it("remove o avatar anterior depois de salvar o novo", async () => {
    prisma.user.findUnique.mockResolvedValue({
      avatarUrl: "http://minio/avatars/users/u1/antiga.png",
    });

    await service.updateAvatar("u1", avatarFile());

    expect(prisma.user.update).toHaveBeenCalled();
    expect(minio.deleteAvatarByUrl).toHaveBeenCalledWith(
      "http://minio/avatars/users/u1/antiga.png",
      "u1",
    );
  });

  it("não tenta remover nada no primeiro avatar", async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarUrl: null });

    await service.updateAvatar("u1", avatarFile());

    expect(minio.deleteAvatarByUrl).not.toHaveBeenCalled();
  });

  it("mantém a troca mesmo se a remoção do antigo falhar", async () => {
    prisma.user.findUnique.mockResolvedValue({
      avatarUrl: "http://minio/avatars/users/u1/antiga.png",
    });
    minio.deleteAvatarByUrl.mockRejectedValue(new Error("MinIO indisponível"));

    await expect(service.updateAvatar("u1", avatarFile())).resolves.toEqual({ id: "u1" });
  });
});

describe("UsersService.update", () => {
  let service: UsersService;
  let prisma: any;

  const admin: AuthUser = {
    id: "admin-1",
    nome: "Admin",
    email: "admin@example.test",
    role: "admin",
    status: "ativo",
  };
  const verificador: AuthUser = { ...admin, id: "verif-1", role: "verificador" };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "u1",
          nome: "Pessoa",
          role: "visualizador",
          status: "ativo",
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          researcherProfile: null,
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn((operation: (tx: any) => unknown) => operation(prisma)),
    };
    service = new UsersService(prisma as unknown as PrismaService, {} as MinioService);
  });

  it("verificador promove visualizador a pesquisador", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      role: "visualizador",
      researcherProfile: {
        emailProfissional: "pesquisa@example.test",
        telefoneWhatsapp: "71999999999",
        instituicaoNome: "Universidade",
        instituicaoCnpj: "00.000.000/0001-00",
        instituicaoEmail: "contato@example.test",
        tipoVinculo: "docente",
        cargoFuncao: "Pesquisadora",
        estadoAtuacao: "BA",
        municipioAtuacao: "Salvador",
        perfilProfissional: "Docente",
        nivelFormacao: "Doutorado",
        finalidadeUso: "Pesquisa",
      },
    });

    await service.update("u1", { role: "pesquisador_envio_download" }, verificador);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "pesquisador_envio_download" } }),
    );
  });

  it("impede promoção para download sem perfil institucional completo", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      role: "visualizador",
      researcherProfile: { emailProfissional: "pesquisa@example.test" },
    });

    await expect(
      service.update("u1", { role: "pesquisador_envio_download" }, verificador),
    ).rejects.toThrow("Complete o perfil profissional e institucional");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("verificador não atribui papel de verificador ou admin", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "pesquisador_envio" });

    await expect(service.update("u1", { role: "verificador" }, verificador)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.update("u1", { role: "admin" }, verificador)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("verificador não mexe em admin nem em outro verificador", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "verificador" });

    await expect(
      service.update("u1", { role: "visualizador" }, verificador),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("verificador não ativa nem desativa contas", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "visualizador" });

    await expect(service.update("u1", { status: "inativo" }, verificador)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("admin atribui qualquer papel", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "visualizador" });

    await service.update("u1", { role: "verificador" }, admin);

    expect(prisma.user.updateMany).toHaveBeenCalled();
  });

  it("ninguém altera a própria conta", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: "admin" });

    await expect(service.update("admin-1", { role: "visualizador" }, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("serializa e impede remover o último administrador ativo", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "admin-2",
      role: "admin",
      status: "ativo",
      updatedAt: new Date(),
      researcherProfile: null,
    });
    prisma.user.count.mockResolvedValue(0);

    await expect(service.update("admin-2", { role: "visualizador" }, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("UsersService.findAll", () => {
  it("usa uma projeção administrativa sem e-mail, CPF ou perfil institucional", async () => {
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new UsersService(prisma as unknown as PrismaService, {} as MinioService);

    await service.findAll();

    const select = prisma.user.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("email");
    expect(select).not.toHaveProperty("cpf");
    expect(select).not.toHaveProperty("onboardingProfile");
    expect(select.researcherProfile.select).toEqual({ completo: true });
  });
});

describe("UsersService.updateProfile", () => {
  it("não permite que pesquisador com download torne o perfil institucional incompleto", async () => {
    const completeProfile = {
      emailProfissional: "pesquisa@example.test",
      telefoneWhatsapp: "71999999999",
      instituicaoNome: "Universidade",
      instituicaoCnpj: "11222333000181",
      instituicaoEmail: "contato@example.test",
      tipoVinculo: "docente",
      cargoFuncao: "Pesquisadora",
      estadoAtuacao: "BA",
      municipioAtuacao: "Salvador",
      perfilProfissional: "Docente",
      nivelFormacao: "Doutorado",
      finalidadeUso: "Pesquisa",
    };
    const tx = {
      $executeRaw: vi.fn(),
      user: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          role: "pesquisador_envio_download",
          researcherProfile: completeProfile,
        }),
      },
      researcherProfile: { upsert: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((operation: (client: any) => unknown) => operation(tx)) };
    const service = new UsersService(prisma as unknown as PrismaService, {} as MinioService);

    await expect(
      service.updateProfile("u1", { researcherProfile: { instituicaoNome: "" } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.researcherProfile.upsert).not.toHaveBeenCalled();
  });

  it("exige que o cadastro do visualizador permaneça completo e normaliza os textos", async () => {
    const currentOnboarding = {
      municipio: "Salvador",
      estado: "BA",
      escolaridade: "graduacao_completa",
      perfilUsuario: "pesquisador",
      perfilUsuarioOutro: null,
      possuiVinculo: false,
      comoConheceu: "internet",
      comoConheceuOutro: null,
      finalidadeAcesso: "pesquisa_academica",
      finalidadeAcessoOutro: null,
    };
    const tx = {
      $executeRaw: vi.fn(),
      user: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          role: "visualizador",
          onboardingProfile: currentOnboarding,
          researcherProfile: null,
        }),
      },
      userOnboardingProfile: { upsert: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((operation: (client: any) => unknown) => operation(tx)) };
    const service = new UsersService(prisma as unknown as PrismaService, {} as MinioService);
    vi.spyOn(service, "findOne").mockResolvedValue({ id: "u1" } as any);

    await service.updateProfile("u1", {
      onboardingProfile: { municipio: "  Feira de Santana  ", estado: "ba" },
    });

    expect(tx.userOnboardingProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ municipio: "Feira de Santana", estado: "BA" }),
      }),
    );

    await expect(
      service.updateProfile("u1", {
        onboardingProfile: { perfilUsuario: "outro", perfilUsuarioOutro: null },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
