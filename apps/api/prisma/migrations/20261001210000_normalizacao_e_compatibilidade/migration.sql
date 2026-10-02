-- Compatibilidade para bancos onde a migration anterior já tenha sido aplicada.
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0;

UPDATE "datasets" SET "visibility" = 'publico' WHERE "createdById" IS NULL;

-- Falha de forma explícita antes do backfill caso existam duplicatas que só diferem
-- por caixa/espaçamento ou pontuação do CPF. Isso evita escolher uma conta arbitrariamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem e-mails duplicados após normalização';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "users"
    WHERE "cpf" IS NOT NULL
    GROUP BY regexp_replace("cpf", '[^0-9]', '', 'g')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem CPFs duplicados após normalização';
  END IF;
END $$;

UPDATE "users"
SET "email" = lower(btrim("email")),
    "cpf" = CASE
      WHEN "cpf" IS NULL THEN NULL
      ELSE regexp_replace("cpf", '[^0-9]', '', 'g')
    END;

UPDATE "user_onboarding_profiles"
SET "instituicaoEmail" = lower(btrim("instituicaoEmail")),
    "instituicaoCnpj" = regexp_replace("instituicaoCnpj", '[^0-9]', '', 'g')
WHERE "instituicaoEmail" IS NOT NULL OR "instituicaoCnpj" IS NOT NULL;

UPDATE "researcher_profiles"
SET "emailProfissional" = lower(btrim("emailProfissional")),
    "instituicaoEmail" = lower(btrim("instituicaoEmail")),
    "instituicaoCnpj" = regexp_replace("instituicaoCnpj", '[^0-9]', '', 'g')
WHERE "emailProfissional" IS NOT NULL
   OR "instituicaoEmail" IS NOT NULL
   OR "instituicaoCnpj" IS NOT NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check"
    CHECK ("email" = lower(btrim("email"))),
  ADD CONSTRAINT "users_cpf_normalized_check"
    CHECK ("cpf" IS NULL OR "cpf" = regexp_replace("cpf", '[^0-9]', '', 'g'));
