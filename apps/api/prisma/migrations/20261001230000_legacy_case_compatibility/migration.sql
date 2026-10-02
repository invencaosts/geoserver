-- Compatibilidade auditável entre casos legados e o formulário detalhado.
-- O default permanece NULL de propósito: durante rolling deploy, um pod antigo
-- que não conhece a coluna continua criando registros identificáveis como legados.
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "formSchemaVersion" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "legacyEvidenceReconciledKey" TEXT;

-- Lease da migração de anexos legados. Permite coordenação entre pods e
-- retomada de um processamento abandonado sem duas instâncias finalizarem o
-- mesmo documento simultaneamente.
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "migrationClaimedAt" TIMESTAMP(3);
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "migrationNextAttemptAt" TIMESTAMP(3);

-- A migration anterior já materializou os anexos existentes; a chave evita
-- varrer e fazer upsert de todo o histórico em cada pod/ciclo.
UPDATE "cases" c
SET "legacyEvidenceReconciledKey" = c."anexoKey"
WHERE c."anexoKey" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "case_documents" document
    WHERE document."caseId" = c."id" AND document."storageKey" = c."anexoKey"
  );

-- Reconhece submissões do formulário novo que possam ter sido gravadas antes
-- desta migration. Casos antigos incompletos continuam NULL e, portanto, não
-- podem ser validados silenciosamente pela aplicação nova.
UPDATE "cases" c
SET "formSchemaVersion" = 'formulario-2026-10-v1'
WHERE c."formSchemaVersion" IS NULL
  AND c."declarationAccepted" = true
  AND c."declarationVersion" = '2026-10-01'
  AND c."declarationHash" = 'c215274f9e54eac7baf56edd8e0fbfa9a0c81054fe188b3276da4d4234bc084b'
  AND c."declarationContentHash" IS NOT NULL
  AND c."declarationAcceptedRevision" = c."revision"
  AND c."declarationAcceptedAt" IS NOT NULL
  AND c."declarationAcceptedById" = c."createdById"
  AND c."submittedAt" IS NOT NULL
  AND c."status" IN ('pendente', 'em_verificacao', 'validado')
  AND EXISTS (
    SELECT 1 FROM "case_contributions" contribution
    WHERE contribution."caseId" = c."id"
      AND contribution."grauPublicidadeInformacoes" IS NOT NULL
      AND contribution."possuiRestricaoDivulgacao" IS NOT NULL
      AND (
        contribution."possuiRestricaoDivulgacao" = false
        OR NULLIF(btrim(contribution."restricaoDivulgacao"), '') IS NOT NULL
      )
      AND contribution."grauPublicidadeInformacoes" = (
        SELECT option."codigo"
        FROM "case_facet_selections" selection
        JOIN "form_options" option ON option."id" = selection."optionId"
        WHERE selection."caseId" = c."id"
          AND option."categoria" = 'grau_publicidade'
        LIMIT 1
      )
  )
  AND EXISTS (
    SELECT 1 FROM "case_sources" source
    WHERE source."caseId" = c."id" AND NULLIF(btrim(source."titulo"), '') IS NOT NULL
  )
  AND EXISTS (
    SELECT 1 FROM "case_spatial_references" reference
    WHERE reference."caseId" = c."id" AND NULLIF(btrim(reference."valor"), '') IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "case_facet_selections" selection
    JOIN "form_options" option ON option."id" = selection."optionId"
    WHERE selection."caseId" = c."id"
      AND option."codigo" = 'outro'
      AND NULLIF(btrim(selection."valorOutro"), '') IS NULL
  )
  AND 16 = (
    SELECT count(DISTINCT option."categoria")
    FROM "case_facet_selections" selection
    JOIN "form_options" option ON option."id" = selection."optionId"
    WHERE selection."caseId" = c."id"
      AND option."ativo" = true
      AND option."categoria" IN (
        'relacao_pesquisador',
        'participacao_producao',
        'instrumento_central',
        'fonte_documento',
        'publicidade_documentos',
        'mecanismo_grilagem',
        'objeto_espolio',
        'grau_publicidade',
        'periodo_ocorrencia',
        'cancelamento_titulos',
        'retorno_patrimonio',
        'destinacao_terras',
        'situacao_imovel',
        'sujeitos_sociais',
        'escala_caso',
        'localizacao'
      )
  );

-- Casos que já eram validados ganham uma exceção explícita e continuam no mapa
-- somente pela projeção pública reduzida. Um registro pendente nunca recebe esta marca.
UPDATE "cases"
SET "formSchemaVersion" = 'legado-validado-pre-formulario-v1'
WHERE "formSchemaVersion" IS NULL
  AND "status" = 'validado';

-- Proteção também contra pods antigos: depois da migration, nenhuma nova
-- transição para validado pode ocorrer sem uma versão reconhecível no registro.
ALTER TABLE "cases"
  ADD CONSTRAINT "cases_validated_requires_form_schema_check"
  CHECK ("status" <> 'validado' OR "formSchemaVersion" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "cases_formSchemaVersion_idx" ON "cases"("formSchemaVersion");
CREATE INDEX IF NOT EXISTS "case_documents_migrationStatus_migrationClaimedAt_idx"
  ON "case_documents"("migrationStatus", "migrationClaimedAt");
CREATE INDEX IF NOT EXISTS "case_documents_migrationStatus_migrationNextAttemptAt_idx"
  ON "case_documents"("migrationStatus", "migrationNextAttemptAt");
