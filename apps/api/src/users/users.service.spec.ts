import { ForbiddenException } from "@nestjs/common";
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
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };

  const admin: AuthUser = {
    id: "admin-1",
    nome: "Admin",
    email: "admin@example.test",
    role: "admin",
    status: "ativo",
  };
  const verificador: AuthUser = { ...admin, id: "verif-1", role: "verificador" };

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: "u1" }) } };
    service = new UsersService(prisma as unknown as PrismaService, {} as MinioService);
  });

  it("verificador promove visualizador a pesquisador", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "visualizador" });

    await service.update("u1", { role: "pesquisador_envio_download" }, verificador);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "pesquisador_envio_download" } }),
    );
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

    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("ninguém altera a própria conta", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: "admin" });

    await expect(service.update("admin-1", { role: "visualizador" }, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
