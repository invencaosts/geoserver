import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { PrismaService } from "../prisma/prisma.service";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";

describe("RegisterDto", () => {
  it("exige o cadastro completo do visualizador e o texto de Outro", async () => {
    const incomplete = plainToInstance(RegisterDto, {
      nome: "Pessoa",
      email: "pessoa@example.test",
      cpf: "52998224725",
      senha: "segredo",
      perfilUsuario: "outro",
    });
    const errors = await validate(incomplete);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        "municipio",
        "estado",
        "escolaridade",
        "perfilUsuarioOutro",
        "possuiVinculo",
        "comoConheceu",
        "finalidadeAcesso",
      ]),
    );
  });

  it("rejeita UF inexistente e textos obrigatórios compostos só por espaços", async () => {
    const invalid = plainToInstance(RegisterDto, {
      nome: "Pessoa",
      email: "pessoa@example.test",
      cpf: "52998224725",
      senha: "segredo",
      municipio: " Salvador ",
      estado: " zz ",
      escolaridade: "graduacao_completa",
      perfilUsuario: "outro",
      perfilUsuarioOutro: "   ",
      possuiVinculo: true,
      instituicaoCnpj: "11.222.333/0001-81",
      instituicaoNome: "   ",
      instituicaoEmail: "instituicao@example.test",
      tipoVinculo: "outro",
      tipoVinculoOutro: "   ",
      comoConheceu: "outro",
      comoConheceuOutro: "   ",
      finalidadeAcesso: "outro",
      finalidadeAcessoOutro: "   ",
    });

    const errors = await validate(invalid);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        "estado",
        "perfilUsuarioOutro",
        "instituicaoNome",
        "tipoVinculoOutro",
        "comoConheceuOutro",
        "finalidadeAcessoOutro",
      ]),
    );
    expect(invalid.municipio).toBe("Salvador");
    expect(invalid.estado).toBe("ZZ");
  });
});

describe("AuthService bootstrap e normalização", () => {
  const secret = "um-segredo-de-bootstrap-com-mais-de-32-caracteres";
  const requiredProfile = {
    municipio: "Salvador",
    estado: "BA",
    escolaridade: "graduacao_completa",
    perfilUsuario: "pesquisador",
    possuiVinculo: false,
    comoConheceu: "internet",
    finalidadeAcesso: "pesquisa_academica",
  };
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "admin-1",
            nome: data.nome,
            email: data.email,
            role: data.role,
            status: "ativo",
            avatarUrl: null,
          }),
        ),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn((operation: (tx: any) => unknown) => operation(prisma)),
    };
    const config = {
      get: vi.fn((key: string) =>
        key === "ADMIN_BOOTSTRAP_SECRET"
          ? secret
          : key === "REGISTRATION_ENABLED"
            ? "true"
            : undefined,
      ),
    };
    const jwt = { sign: vi.fn().mockReturnValue("token") };
    service = new AuthService(
      prisma as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  it("não consulta nem altera o banco com segredo ausente ou inválido", async () => {
    await expect(
      service.bootstrapAdmin(
        {
          nome: "Admin",
          email: "admin@example.test",
          cpf: "52998224725",
          senha: "segredo",
          ...requiredProfile,
        },
        "incorreto",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("serializa o bootstrap e normaliza e-mail e CPF", async () => {
    await service.bootstrapAdmin(
      {
        nome: " Admin ",
        email: " ADMIN@Example.Test ",
        cpf: "529.982.247-25",
        senha: "segredo",
        ...requiredProfile,
      },
      secret,
    );

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: "Admin",
          email: "admin@example.test",
          cpf: "52998224725",
          role: "admin",
        }),
      }),
    );
  });

  it("não persiste instituição quando a pessoa declara não possuir vínculo", async () => {
    await service.register({
      nome: "Pessoa",
      email: "pessoa@example.test",
      cpf: "52998224725",
      senha: "segredo",
      possuiVinculo: false,
      instituicaoCnpj: "11.222.333/0001-81",
      instituicaoNome: "Não deve persistir",
      instituicaoEmail: "instituicao@example.test",
      tipoVinculo: "docente",
      municipio: "Salvador",
      estado: "BA",
      escolaridade: "graduacao_completa",
      perfilUsuario: "pesquisador",
      comoConheceu: "internet",
      finalidadeAcesso: "pesquisa_academica",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingProfile: {
            create: expect.objectContaining({
              possuiVinculo: false,
              instituicaoCnpj: undefined,
              instituicaoNome: undefined,
              instituicaoEmail: undefined,
              tipoVinculo: undefined,
            }),
          },
        }),
      }),
    );
  });
});
