-- Configuração cartográfica aditiva: datasets existentes permanecem restritos/inalterados.
ALTER TABLE "datasets" ADD COLUMN "mapConfig" JSONB;
CREATE INDEX IF NOT EXISTS "features_geom_gist_idx" ON "features" USING GIST ("geom");
