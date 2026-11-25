-- Retira somente o typmod 2D para aceitar Shapefiles PolygonZ/MultiPointZ.
-- Coordenadas e geometrias existentes são preservadas; o SRID continua obrigatório.
ALTER TABLE "features" ALTER COLUMN "geom" TYPE geometry USING "geom";
ALTER TABLE "features" ADD CONSTRAINT "features_geom_srid_check" CHECK (ST_SRID("geom") = 4326);
