-- Evolução aditiva do formulário de cadastro, perfil do pesquisador e casos.
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'pendente';

CREATE TYPE "DataVisibility" AS ENUM ('publico', 'restrito');

ALTER TABLE "cases"
  ADD COLUMN "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "declarationVersion" TEXT,
  ADD COLUMN "declarationText" TEXT,
  ADD COLUMN "declarationHash" TEXT,
  ADD COLUMN "declarationAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "cases" ALTER COLUMN "status" SET DEFAULT 'rascunho';

ALTER TABLE "datasets"
  ADD COLUMN "caseId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "visibility" "DataVisibility" NOT NULL DEFAULT 'restrito',
  ADD COLUMN "codigoCar" TEXT,
  ADD COLUMN "codigoSigef" TEXT;

-- Datasets já existentes eram públicos antes desta evolução. Preservamos esse comportamento;
-- novos uploads continuam nascendo restritos e sempre possuem createdById.
UPDATE "datasets" SET "visibility" = 'publico' WHERE "createdById" IS NULL;

CREATE TABLE "user_onboarding_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "municipio" TEXT,
  "estado" TEXT,
  "escolaridade" TEXT,
  "perfilUsuario" TEXT,
  "possuiVinculo" BOOLEAN,
  "instituicaoCnpj" TEXT,
  "instituicaoNome" TEXT,
  "instituicaoEmail" TEXT,
  "tipoVinculo" TEXT,
  "comoConheceu" TEXT,
  "comoConheceuOutro" TEXT,
  "finalidadeAcesso" TEXT,
  "finalidadeAcessoOutro" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_onboarding_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "researcher_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailProfissional" TEXT,
  "telefoneWhatsapp" TEXT,
  "instituicaoNome" TEXT,
  "instituicaoCnpj" TEXT,
  "instituicaoEmail" TEXT,
  "tipoVinculo" TEXT,
  "cargoFuncao" TEXT,
  "estadoAtuacao" TEXT,
  "municipioAtuacao" TEXT,
  "perfilProfissional" TEXT,
  "nivelFormacao" TEXT,
  "finalidadeUso" TEXT,
  "completo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "researcher_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "researcher_profile_links" (
  "id" TEXT NOT NULL,
  "researcherProfileId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "researcher_profile_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_options" (
  "id" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "descricao" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "form_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_contributions" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "relacaoPesquisador" TEXT,
  "participouProducao" BOOLEAN,
  "participouValidacao" BOOLEAN,
  "responsavelValidacao" TEXT,
  "instrumentoCentral" TEXT,
  "objetoEspolio" TEXT,
  "instituicaoPromotora" TEXT,
  "grauPublicidadeInformacoes" TEXT,
  "possuiRestricaoDivulgacao" BOOLEAN,
  "restricaoDivulgacao" TEXT,
  "periodoInicio" INTEGER,
  "periodoFim" INTEGER,
  "situacaoCancelamento" TEXT,
  "orgaoCancelamento" TEXT,
  "retornouPatrimonioPublico" BOOLEAN,
  "destinacaoPosterior" TEXT,
  "situacaoAtualImovel" TEXT,
  "conflitos" TEXT,
  "sujeitosSociais" TEXT,
  "escalaEspacial" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "case_contributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_sources" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "tipo" TEXT,
  "referencia" TEXT,
  "grauPublicidade" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "case_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_documents" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "sourceId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "visibility" "DataVisibility" NOT NULL DEFAULT 'restrito',
  "requestedPublic" BOOLEAN NOT NULL DEFAULT false,
  "publicationApprovedAt" TIMESTAMP(3),
  "publicationApprovedById" TEXT,
  "possuiDadosPessoais" BOOLEAN NOT NULL DEFAULT false,
  "motivoRestricao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_facet_selections" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "valorOutro" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_facet_selections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "case_spatial_references" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "descricao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_spatial_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_onboarding_profiles_userId_key" ON "user_onboarding_profiles"("userId");
CREATE UNIQUE INDEX "researcher_profiles_userId_key" ON "researcher_profiles"("userId");
CREATE INDEX "researcher_profile_links_researcherProfileId_idx" ON "researcher_profile_links"("researcherProfileId");
CREATE UNIQUE INDEX "form_options_categoria_codigo_key" ON "form_options"("categoria", "codigo");
CREATE INDEX "form_options_categoria_ativo_ordem_idx" ON "form_options"("categoria", "ativo", "ordem");
CREATE UNIQUE INDEX "case_contributions_caseId_key" ON "case_contributions"("caseId");
CREATE INDEX "case_sources_caseId_idx" ON "case_sources"("caseId");
CREATE UNIQUE INDEX "case_documents_storageKey_key" ON "case_documents"("storageKey");
CREATE INDEX "case_documents_caseId_idx" ON "case_documents"("caseId");
CREATE INDEX "case_documents_sourceId_idx" ON "case_documents"("sourceId");
CREATE UNIQUE INDEX "case_facet_selections_caseId_optionId_key" ON "case_facet_selections"("caseId", "optionId");
CREATE INDEX "case_facet_selections_caseId_idx" ON "case_facet_selections"("caseId");
CREATE INDEX "case_spatial_references_caseId_idx" ON "case_spatial_references"("caseId");
CREATE INDEX "datasets_caseId_idx" ON "datasets"("caseId");
CREATE INDEX "datasets_createdById_idx" ON "datasets"("createdById");

ALTER TABLE "user_onboarding_profiles" ADD CONSTRAINT "user_onboarding_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "researcher_profiles" ADD CONSTRAINT "researcher_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "researcher_profile_links" ADD CONSTRAINT "researcher_profile_links_researcherProfileId_fkey" FOREIGN KEY ("researcherProfileId") REFERENCES "researcher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_contributions" ADD CONSTRAINT "case_contributions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_sources" ADD CONSTRAINT "case_sources_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "case_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_publicationApprovedById_fkey" FOREIGN KEY ("publicationApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_facet_selections" ADD CONSTRAINT "case_facet_selections_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_facet_selections" ADD CONSTRAINT "case_facet_selections_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "form_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_spatial_references" ADD CONSTRAINT "case_spatial_references_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Perfis são criados vazios para contas existentes, sem alterar papéis já concedidos.
INSERT INTO "user_onboarding_profiles" ("id", "userId", "createdAt", "updatedAt")
SELECT 'onb_' || md5(random()::text || "id"), "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "users"
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "researcher_profiles" ("id", "userId", "createdAt", "updatedAt")
SELECT 'res_' || md5(random()::text || "id"), "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "users"
WHERE "role" IN ('pesquisador_envio', 'pesquisador_envio_download')
ON CONFLICT ("userId") DO NOTHING;

-- O anexo legado passa a constar na coleção de documentos. Na primeira inicialização,
-- CasesService move o objeto físico para o bucket privado e remove a cópia pública.
INSERT INTO "case_documents" ("id", "caseId", "uploadedById", "nome", "mimeType", "tamanho", "storageKey", "visibility", "createdAt")
SELECT 'doc_' || md5(random()::text || c."id"), c."id", c."createdById", COALESCE(c."anexoNome", 'anexo legado'),
       'application/octet-stream', 0, c."anexoKey", 'restrito', c."createdAt"
FROM "cases" c
WHERE c."anexoKey" IS NOT NULL
ON CONFLICT ("storageKey") DO NOTHING;

INSERT INTO "form_options" ("id", "categoria", "codigo", "label", "ordem", "createdAt", "updatedAt") VALUES
  ('opt_mec_falsificacao', 'mecanismo_grilagem', 'falsificacao_documental', 'Falsificação documental', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_mec_sobreposicao', 'mecanismo_grilagem', 'sobreposicao_registros', 'Sobreposição de registros', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_mec_car', 'mecanismo_grilagem', 'uso_fraudulento_car', 'Uso fraudulento do CAR', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_mec_judicial', 'mecanismo_grilagem', 'fraude_judicial', 'Fraude judicial ou administrativa', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_mec_outro', 'mecanismo_grilagem', 'outro', 'Outro', 999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_obj_terra', 'objeto_espolio', 'terra_publica', 'Terra pública', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_obj_tradicional', 'objeto_espolio', 'territorio_tradicional', 'Território tradicional', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_obj_assentamento', 'objeto_espolio', 'assentamento', 'Assentamento', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_obj_outro', 'objeto_espolio', 'outro', 'Outro', 999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_conflito_indigena', 'sujeito_social', 'povos_indigenas', 'Povos indígenas', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_conflito_quilombola', 'sujeito_social', 'comunidades_quilombolas', 'Comunidades quilombolas', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_conflito_campones', 'sujeito_social', 'camponeses', 'Camponeses e agricultores familiares', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_conflito_outro', 'sujeito_social', 'outro', 'Outro', 999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("categoria", "codigo") DO NOTHING;
