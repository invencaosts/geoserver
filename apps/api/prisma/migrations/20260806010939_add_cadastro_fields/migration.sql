-- CreateEnum
CREATE TYPE "RoleApprovalStatus" AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- CreateEnum
CREATE TYPE "PerfilContribuidor" AS ENUM ('pesquisador', 'militante_movimento_social', 'partido_politico', 'servidor_publico', 'lideranca_comunitaria', 'movimento_social_organizado', 'conselhos_ongs');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "localidade" TEXT,
ADD COLUMN     "nomeSocial" TEXT,
ADD COLUMN     "perfilContribuidor" "PerfilContribuidor",
ADD COLUMN     "quemRepresenta" TEXT,
ADD COLUMN     "requestedRole" "RoleName" NOT NULL DEFAULT 'leitor',
ADD COLUMN     "roleApprovalStatus" "RoleApprovalStatus" NOT NULL DEFAULT 'aprovado';

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

