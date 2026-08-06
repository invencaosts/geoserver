-- AlterEnum (com remapeamento de dados existentes)
BEGIN;
CREATE TYPE "CaseTipo_new" AS ENUM ('institucional', 'titulo_falso', 'car');

ALTER TABLE "cases" ALTER COLUMN "tipo" TYPE text USING "tipo"::text;

UPDATE "cases" SET "tipo" = CASE "tipo"
  WHEN 'invasao_propriedade' THEN 'institucional'
  WHEN 'conflito_agrario' THEN 'institucional'
  WHEN 'ocupacao_irregular' THEN 'car'
  WHEN 'desmatamento_ilegal' THEN 'titulo_falso'
  ELSE 'institucional'
END;

ALTER TABLE "cases" ALTER COLUMN "tipo" TYPE "CaseTipo_new" USING ("tipo"::"CaseTipo_new");
ALTER TYPE "CaseTipo" RENAME TO "CaseTipo_old";
ALTER TYPE "CaseTipo_new" RENAME TO "CaseTipo";
DROP TYPE "public"."CaseTipo_old";
COMMIT;
