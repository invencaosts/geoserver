// Cria uma conta de acesso padrão para cada papel, com e-mail e senha lidos do .env
// (variáveis SEED_<PAPEL>_EMAIL / SEED_<PAPEL>_PASSWORD). Uso exclusivo de desenvolvimento e beta.
// Rodar: pnpm --filter api run seed:usuarios
import "dotenv/config";
import * as bcrypt from "bcrypt";
import { PrismaClient, RoleName } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const MIN_PASSWORD_LENGTH = 8;

const ACCOUNTS: { role: RoleName; envPrefix: string; nome: string }[] = [
  { role: "admin", envPrefix: "SEED_ADMIN", nome: "Administrador Padrão" },
  { role: "verificador", envPrefix: "SEED_VERIFICADOR", nome: "Verificador Padrão" },
  {
    role: "pesquisador_envio_download",
    envPrefix: "SEED_PESQUISADOR_ENVIO_DOWNLOAD",
    nome: "Pesquisador Envio e Download Padrão",
  },
  {
    role: "pesquisador_envio",
    envPrefix: "SEED_PESQUISADOR_ENVIO",
    nome: "Pesquisador Envio Padrão",
  },
  { role: "visualizador", envPrefix: "SEED_VISUALIZADOR", nome: "Visualizador Padrão" },
];

// Perfil completo exigido pelo PermissionsGuard para pesquisadores enviarem/baixarem dados.
function researcherProfile(email: string, institutional: boolean) {
  return {
    emailProfissional: email,
    telefoneWhatsapp: "(31) 90000-0000",
    cargoFuncao: "Pesquisador(a)",
    estadoAtuacao: "MG",
    municipioAtuacao: "Belo Horizonte",
    perfilProfissional: "pesquisador",
    nivelFormacao: "mestrado",
    finalidadeUso: "Conta padrão para testes da plataforma",
    ...(institutional
      ? {
          instituicaoNome: "Instituição de Teste",
          instituicaoCnpj: "11222333000181",
          instituicaoEmail: "contato@instituicao.local",
          tipoVinculo: "universidade",
        }
      : {}),
    completo: true,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:usuarios cria contas com senhas conhecidas e não roda em produção.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    for (const account of ACCOUNTS) {
      const email = process.env[`${account.envPrefix}_EMAIL`]?.trim().toLowerCase();
      const senha = process.env[`${account.envPrefix}_PASSWORD`] ?? "";
      if (!email || !senha) {
        console.log(`${account.role}: ${account.envPrefix}_EMAIL/_PASSWORD vazios, pulando.`);
        continue;
      }
      if (senha.length < MIN_PASSWORD_LENGTH) {
        throw new Error(
          `${account.envPrefix}_PASSWORD precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        );
      }
      if (await prisma.user.findUnique({ where: { email } })) {
        console.log(`${account.role}: ${email} já existe, pulando.`);
        continue;
      }

      const isResearcher = account.role.startsWith("pesquisador_");
      await prisma.user.create({
        data: {
          nome: account.nome,
          email,
          senhaHash: await bcrypt.hash(senha, 10),
          role: account.role,
          onboardingProfile: {
            create: {
              municipio: "Belo Horizonte",
              estado: "MG",
              escolaridade: "graduacao_completa",
              perfilUsuario: "pesquisador",
              possuiVinculo: false,
              comoConheceu: "pesquisa_academica",
              finalidadeAcesso: "pesquisa_academica",
            },
          },
          researcherProfile: isResearcher
            ? {
                create: researcherProfile(email, account.role === "pesquisador_envio_download"),
              }
            : undefined,
        },
      });
      console.log(`${account.role}: ${email} criado.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
