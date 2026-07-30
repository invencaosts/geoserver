-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('admin', 'verificador', 'contribuidor', 'leitor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ativo', 'inativo');

-- CreateEnum
CREATE TYPE "LayerType" AS ENUM ('WMS', 'WFS', 'WCS', 'Vector', 'Raster');

-- CreateEnum
CREATE TYPE "LayerCategory" AS ENUM ('base', 'overlay', 'analysis');

-- CreateEnum
CREATE TYPE "DatasetFormat" AS ENUM ('Shapefile', 'GeoJSON', 'KML', 'CSV');

-- CreateEnum
CREATE TYPE "DatasetGeomType" AS ENUM ('Point', 'Polygon', 'Line');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('processing', 'active', 'error');

-- CreateEnum
CREATE TYPE "CaseTipo" AS ENUM ('invasao_propriedade', 'ocupacao_irregular', 'desmatamento_ilegal', 'conflito_agrario');

-- CreateEnum
CREATE TYPE "CasePrioridade" AS ENUM ('baixa', 'media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('pendente', 'em_verificacao', 'validado', 'rejeitado');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "RoleName" NOT NULL DEFAULT 'leitor',
    "status" "UserStatus" NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layers" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "LayerType" NOT NULL,
    "categoria" "LayerCategory" NOT NULL DEFAULT 'overlay',
    "url" TEXT,
    "fonte" TEXT NOT NULL,
    "descricao" TEXT,
    "projecao" TEXT NOT NULL DEFAULT 'EPSG:4326',
    "visivel" BOOLEAN NOT NULL DEFAULT true,
    "opacidade" INTEGER NOT NULL DEFAULT 100,
    "tileSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "formato" "DatasetFormat" NOT NULL,
    "tipoGeometria" "DatasetGeomType" NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'processing',
    "registros" INTEGER NOT NULL DEFAULT 0,
    "projecaoOriginal" TEXT,
    "storageKey" TEXT,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "geom" geometry(Geometry,4326) NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "CaseTipo" NOT NULL,
    "municipio" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "descricao" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fonteDados" TEXT,
    "denunciante" TEXT,
    "prioridade" "CasePrioridade" NOT NULL DEFAULT 'media',
    "status" "CaseStatus" NOT NULL DEFAULT 'pendente',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "features_datasetId_idx" ON "features"("datasetId");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_municipio_idx" ON "cases"("municipio");

-- CreateIndex
CREATE INDEX "case_status_history_caseId_idx" ON "case_status_history"("caseId");

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
