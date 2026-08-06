-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "InstituicaoTipo" AS ENUM ('educacao_basica', 'educacao_superior');

-- CreateTable
CREATE TABLE "instituicoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "tipo" "InstituicaoTipo" NOT NULL,
    "dependencia" TEXT,

    CONSTRAINT "instituicoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instituicoes_nome_idx" ON "instituicoes" USING GIN ("nome" gin_trgm_ops);

