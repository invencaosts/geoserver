-- Auditoria do formulário: autoria do aceite, opções "Outro" e publicação auditável.
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "declarationAcceptedById" TEXT;
ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "perfilUsuarioOutro" TEXT;
ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "tipoVinculoOutro" TEXT;
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "requestedPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "publicationApprovedAt" TIMESTAMP(3);
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "publicationApprovedById" TEXT;
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "migrationStatus" TEXT NOT NULL DEFAULT 'native';
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "migrationError" TEXT;

UPDATE "cases"
SET "declarationAcceptedById" = "createdById"
WHERE "declarationAccepted" = true AND "declarationAcceptedById" IS NULL;

UPDATE "case_documents"
SET "migrationStatus" = 'pending'
WHERE "storageKey" LIKE 'cases/%'
  AND "mimeType" = 'application/octet-stream'
  AND "tamanho" = 0;

DO $$ BEGIN
  ALTER TABLE "cases" ADD CONSTRAINT "cases_declarationAcceptedById_fkey"
    FOREIGN KEY ("declarationAcceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "datasets" ADD CONSTRAINT "datasets_publicationApprovedById_fkey"
    FOREIGN KEY ("publicationApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "datasets_publicationApprovedById_idx" ON "datasets"("publicationApprovedById");
CREATE INDEX IF NOT EXISTS "case_documents_migrationStatus_idx" ON "case_documents"("migrationStatus");

-- Catálogos transcritos das abas Pesquisador 1 e 2. O upsert preserva ids já referenciados.
-- Opções provisórias da migration inicial que não existem na planilha deixam de ser oferecidas,
-- sem apagar seleções históricas eventualmente associadas a elas.
UPDATE "form_options"
SET "ativo" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE ("categoria" = 'mecanismo_grilagem' AND "codigo" IN ('uso_fraudulento_car', 'fraude_judicial'))
   OR ("categoria" = 'objeto_espolio' AND "codigo" IN ('terra_publica', 'territorio_tradicional', 'assentamento', 'outro'))
   OR "categoria" = 'sujeito_social';

INSERT INTO "form_options" ("id", "categoria", "codigo", "label", "ordem", "ativo", "createdAt", "updatedAt") VALUES
('fo_rel_01','relacao_pesquisador','pesquisou_diretamente','Pesquisou diretamente o caso',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_02','relacao_pesquisador','participou_pesquisa','Participou de pesquisa sobre o caso',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_03','relacao_pesquisador','investigacao_institucional','Participou de investigação institucional',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_04','relacao_pesquisador','atuacao_juridica','Atua ou atuou juridicamente no caso',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_05','relacao_pesquisador','representa_comunidade','Atua como representante de comunidade afetada',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_06','relacao_pesquisador','documentos_oficiais','Teve acesso a documentos oficiais do caso',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_07','relacao_pesquisador','recebeu_terceiros','Recebeu as informações de outra instituição/pesquisador',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_08','relacao_pesquisador','compilou_fontes_publicas','Compilou informações provenientes de fontes públicas',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_rel_09','relacao_pesquisador','outro','Outro',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_part_01','participacao_producao','diretamente','Sim, participei diretamente',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_part_02','participacao_producao','parcialmente','Sim, parcialmente',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_part_03','participacao_producao','terceiros','Não, apenas encaminho informações produzidas por terceiros',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_01','instrumento_central','processo_judicial','Processo judicial',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_02','instrumento_central','processo_administrativo','Processo administrativo',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_03','instrumento_central','relatorio_orgao_publico','Relatório técnico de órgão público',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_04','instrumento_central','pesquisa_academica','Pesquisa acadêmica',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_05','instrumento_central','relatorio_privado','Relatório técnico privado',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_06','instrumento_central','relatorio_movimento_social','Relatório de movimento social',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_inst_07','instrumento_central','outro','Outro',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_01','fonte_documento','processo_judicial','Processo judicial',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_02','fonte_documento','processo_administrativo','Processo administrativo',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_03','fonte_documento','matricula_imobiliaria','Matrícula imobiliária',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_04','fonte_documento','titulo_propriedade','Título de propriedade',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_05','fonte_documento','certidao','Certidão',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_06','fonte_documento','incra','Documento do INCRA',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_07','fonte_documento','orgao_estadual','Documento do órgão estadual',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_08','fonte_documento','orgao_ambiental','Documento do órgão ambiental',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_09','fonte_documento','car','CAR',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_10','fonte_documento','sncr','SNCR',10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_11','fonte_documento','sigef','SIGEF',11,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_12','fonte_documento','ccir','CCIR',12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_13','fonte_documento','relatorio_tecnico','Relatório técnico',13,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_14','fonte_documento','pesquisa_academica','Pesquisa acadêmica',14,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_fonte_15','fonte_documento','outro','Outro',15,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_01','publicidade_documentos','oficial_disponivel','Documentação oficial disponível',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_02','publicidade_documentos','oficial_parcial','Documentação oficial parcialmente disponível',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_03','publicidade_documentos','pesquisa_academica','Caso documentado por pesquisa acadêmica',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_04','publicidade_documentos','organizacao_social','Caso documentado por organização/movimento social',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_05','publicidade_documentos','multiplas_fontes','Caso documentado por múltiplas fontes independentes',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_06','publicidade_documentos','nao_publica','Documentação não disponível para consulta pública',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_pubdoc_07','publicidade_documentos','outro','Outro',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_01','mecanismo_grilagem','titulo_falso','Produção de título falso/fraudulento',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_02','mecanismo_grilagem','sem_titulo','Sem apresentação de títulos de propriedade',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_03','mecanismo_grilagem','institucionalizada','Grilagem institucionalizada',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_04','mecanismo_grilagem','anistia_regularizacao','Anistia/regularização posterior de ocupação',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_05','mecanismo_grilagem','car_irregular','Utilização irregular do CAR',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_06','mecanismo_grilagem','sncr_irregular','Utilização irregular do SNCR',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_07','mecanismo_grilagem','sigef_irregular','Utilização irregular do SIGEF',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_08','mecanismo_grilagem','sobreposicao_registros','Sobreposição/alteração de registros fundiários',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_09','mecanismo_grilagem','fraude_documentacao','Fraude em documentação fundiária',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_10','mecanismo_grilagem','falsificacao_documental','Apropriação mediante falsificação documental',10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_mec_11','mecanismo_grilagem','outro','Outro',11,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_obj_01','objeto_espolio','terras_publicas','Apropriação de terras públicas não destinadas',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_obj_02','objeto_espolio','pequenos_posseiros','Apossamento/tomada de terras de pequenos posseiros',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_obj_03','objeto_espolio','unidade_conservacao','Invasão de unidades de conservação',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_obj_04','objeto_espolio','terra_indigena','Invasão de terra indígena',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_01','grau_publicidade','publico','Público',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_02','grau_publicidade','publico_restricoes','Público com restrições de determinados dados',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_03','grau_publicidade','publico_dados_pessoais','Processo/documento público, mas com dados pessoais protegidos',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_04','grau_publicidade','segredo_justica','Segredo de Justiça',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_05','grau_publicidade','acesso_restrito','Acesso restrito',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_06','grau_publicidade','confidencial','Confidencial',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_grau_07','grau_publicidade','outro','Outro',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_01','periodo_ocorrencia','antes_1960','Antes de 1960',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_02','periodo_ocorrencia','1960_1969','1960–1969',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_03','periodo_ocorrencia','1970_1979','1970–1979',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_04','periodo_ocorrencia','1980_1989','1980–1989',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_05','periodo_ocorrencia','1990_1999','1990–1999',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_06','periodo_ocorrencia','2000_2009','2000–2009',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_07','periodo_ocorrencia','2010_2019','2010–2019',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_08','periodo_ocorrencia','2020_2029','2020–2029',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_per_09','periodo_ocorrencia','mais_de_um','Mais de um período',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_can_01','cancelamento_titulos','sim','Sim',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_can_02','cancelamento_titulos','nao','Não',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_can_03','cancelamento_titulos','parcialmente','Parcialmente',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_can_04','cancelamento_titulos','nao_informado','Não informado',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_can_05','cancelamento_titulos','em_processo','Em processo de cancelamento',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_ret_01','retorno_patrimonio','sim','Sim',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_ret_02','retorno_patrimonio','nao','Não',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_ret_03','retorno_patrimonio','parcialmente','Parcialmente',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_ret_04','retorno_patrimonio','nao_informado','Não informado',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_ret_05','retorno_patrimonio','em_processo','Em processo',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_01','destinacao_terras','patrimonio_estadual','Patrimônio estadual',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_02','destinacao_terras','patrimonio_uniao','Patrimônio da União',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_03','destinacao_terras','territorio_indigena','Território indígena',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_04','destinacao_terras','territorio_quilombola','Território quilombola',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_05','destinacao_terras','assentamento','Assentamento de reforma agrária',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_06','destinacao_terras','unidade_conservacao','Unidade de conservação',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_07','destinacao_terras','outra_publica','Outra destinação pública',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_08','destinacao_terras','sem_destinacao','Permanecem sem destinação definida',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_dest_09','destinacao_terras','nao_informado','Não informado',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_sit_01','situacao_imovel','regularizada','Regularizada',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_sit_02','situacao_imovel','irregular','Irregular',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_sit_03','situacao_imovel','em_disputa','Em disputa',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_sit_04','situacao_imovel','regularizacao','Em processo de regularização',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_sit_05','situacao_imovel','processo_judicial','Em processo judicial',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_sit_06','situacao_imovel','sem_informacao','Sem informação atualizada',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_01','sujeitos_sociais','povos_indigenas','Povos indígenas',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_02','sujeitos_sociais','quilombolas','Comunidades quilombolas',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_03','sujeitos_sociais','agricultores_familiares','Camponeses/agricultores familiares',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_04','sujeitos_sociais','trabalhadores_rurais','Trabalhadores rurais',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_05','sujeitos_sociais','assentados','Assentados',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_06','sujeitos_sociais','comunidades_tradicionais','Comunidades tradicionais',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_07','sujeitos_sociais','posseiros','Posseiros',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_08','sujeitos_sociais','movimentos_sociais','Movimentos sociais',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_09','sujeitos_sociais','proprietarios','Proprietários particulares',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_10','sujeitos_sociais','empresas','Empresas',10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_11','sujeitos_sociais','poder_publico','Poder Público',11,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_suj_12','sujeitos_sociais','outro','Outros',12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_01','escala_caso','estado','Estado',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_02','escala_caso','regiao','Região',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_03','escala_caso','municipio','Município',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_04','escala_caso','comarca','Comarca',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_05','escala_caso','distrito_localidade','Distrito/localidade',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_06','escala_caso','propriedade_imovel','Propriedade/imóvel',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_07','escala_caso','parcela','Parcela',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_esc_08','escala_caso','outro','Outro',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_01','localizacao','coordenadas_geograficas','Coordenadas geográficas',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_02','localizacao','utm','Coordenadas UTM',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_03','localizacao','car','CAR (código)',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_04','localizacao','shapefile','Shapefile',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_05','localizacao','kml_kmz','KML/KMZ',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_06','localizacao','mapa','Link de serviços de navegação online',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_07','localizacao','sigef','SIGEF',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('fo_loc_08','localizacao','outro','Outra referência espacial',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("categoria", "codigo") DO UPDATE
SET "label" = EXCLUDED."label", "ordem" = EXCLUDED."ordem", "ativo" = true, "updatedAt" = CURRENT_TIMESTAMP;
-- O aceite da declaração fica vinculado à revisão e ao conteúdo exatos do rascunho.
ALTER TABLE "cases"
  ADD COLUMN IF NOT EXISTS "declarationContentHash" TEXT,
  ADD COLUMN IF NOT EXISTS "declarationAcceptedRevision" INTEGER;

UPDATE "case_documents" d
SET "migrationStatus" = 'pending', "migrationError" = NULL
FROM "cases" c
WHERE c."anexoKey" IS NOT NULL
  AND d."storageKey" = c."anexoKey"
  AND d."migrationStatus" = 'native';
