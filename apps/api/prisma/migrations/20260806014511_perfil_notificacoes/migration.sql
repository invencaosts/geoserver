-- CreateEnum
CREATE TYPE "NotificationTipo" AS ENUM ('contribuicao_aceita', 'contribuicao_retorno', 'novo_caso_area_interesse');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "areasInteresse" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "idiomas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "instituicao" TEXT,
ADD COLUMN     "telefone" TEXT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "NotificationTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_lida_idx" ON "notifications"("userId", "lida");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

