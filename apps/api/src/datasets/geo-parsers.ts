import { parse as parseCsv } from "csv-parse/sync";
import { DOMParser } from "@xmldom/xmldom";
import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import proj4 from "proj4";
import { DATASET_ZIP_MAX_UNCOMPRESSED_BYTES, inspectZipArchive } from "../common/zip-safety";
import { readDbfRows } from "./dbf-reader";

export interface ParsedFeature {
  geometry: { type: string; coordinates?: unknown; geometries?: ParsedFeature["geometry"][] };
  properties: Record<string, unknown>;
}

export interface ParsedResult {
  features: ParsedFeature[];
  geomType: "Point" | "Polygon" | "Line";
  sourceProjection?: string;
}

const LAT_KEYS = ["lat", "latitude", "y"];
const LNG_KEYS = ["lng", "lon", "longitude", "x"];

function findKey(row: Record<string, unknown>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  return keys.find((k) => candidates.includes(k.trim().toLowerCase()));
}

function geomTypeFromGeoJsonType(type: string): "Point" | "Polygon" | "Line" {
  if (type.includes("Point")) return "Point";
  if (type.includes("Polygon")) return "Polygon";
  return "Line";
}

function parseCsvBuffer(buffer: Buffer): ParsedResult {
  const rows: Record<string, unknown>[] = parseCsv(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (rows.length === 0) return { features: [], geomType: "Point" };

  const latKey = findKey(rows[0], LAT_KEYS);
  const lngKey = findKey(rows[0], LNG_KEYS);
  if (!latKey || !lngKey) {
    throw new Error(
      "CSV precisa de colunas de latitude/longitude (lat/lng, latitude/longitude, x/y)",
    );
  }

  const features: ParsedFeature[] = rows
    .map((row): ParsedFeature | null => {
      const lat = Number(row[latKey]);
      const lng = Number(row[lngKey]);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !String(row[latKey]).trim() ||
        !String(row[lngKey]).trim()
      )
        return null;
      const properties = { ...row };
      delete properties[latKey];
      delete properties[lngKey];
      return {
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties,
      };
    })
    .filter((f): f is ParsedFeature => f !== null);

  return { features, geomType: "Point" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFeatureCollection(geojson: unknown): ParsedFeature[] {
  if (!isRecord(geojson)) throw new Error("GeoJSON inválido");
  const raw: unknown[] =
    geojson.type === "FeatureCollection" && Array.isArray(geojson.features)
      ? (geojson.features as unknown[])
      : [geojson];
  const features: ParsedFeature[] = [];
  for (const feature of raw) {
    if (!isRecord(feature) || !feature.geometry) continue;
    if (!isRecord(feature.geometry) || typeof feature.geometry.type !== "string")
      throw new Error("Geometria GeoJSON inválida");
    features.push({
      geometry: feature.geometry as ParsedFeature["geometry"],
      properties: isRecord(feature.properties) ? feature.properties : {},
    });
  }
  return features;
}

function parseGeoJsonBuffer(buffer: Buffer): ParsedResult {
  const geojson: unknown = JSON.parse(buffer.toString("utf-8"));
  if (!isRecord(geojson)) throw new Error("GeoJSON inválido");
  const crsProperties = isRecord(geojson.crs) ? geojson.crs.properties : undefined;
  const declaredCrs = isRecord(crsProperties) ? crsProperties.name : undefined;
  if (
    geojson.crs &&
    (typeof declaredCrs !== "string" || !/(?:EPSG(?::|::|\/0\/)?4326|CRS:?84)$/i.test(declaredCrs))
  ) {
    throw new Error(
      "GeoJSON deve usar longitude/latitude WGS84 (EPSG:4326); reprojete o arquivo antes de importar",
    );
  }
  const features = normalizeFeatureCollection(geojson);
  const geomType = features.length ? geomTypeFromGeoJsonType(features[0].geometry.type) : "Point";
  return { features, geomType };
}

function parseKmlText(xml: string): ParsedResult {
  const dom = new DOMParser().parseFromString(xml, "text/xml");
  const geojson = kmlToGeoJson(dom);
  const features = normalizeFeatureCollection(geojson);
  const geomType = features.length ? geomTypeFromGeoJsonType(features[0].geometry.type) : "Point";
  return { features, geomType };
}

function parseKmlBuffer(buffer: Buffer): ParsedResult {
  return parseKmlText(buffer.toString("utf-8"));
}

async function parseKmzBuffer(buffer: Buffer): Promise<ParsedResult> {
  const zip = await inspectZipArchive(buffer);
  const kmlEntry = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".kml"),
  );
  if (!kmlEntry) throw new Error("KMZ não contém nenhum arquivo .kml");

  const xml = await kmlEntry.async("string");
  return parseKmlText(xml);
}

async function parseShapefileZip(buffer: Buffer): Promise<ParsedResult> {
  // Usar a entrada ESM: o bundle UMD de `require("shpjs")` não exporta a API em Node moderno.
  const shp = (await import("shpjs")) as {
    parseShp: (buffer: Buffer, projection?: string) => (ParsedFeature["geometry"] | null)[];
  };
  const zip = await inspectZipArchive(buffer, DATASET_ZIP_MAX_UNCOMPRESSED_BYTES);
  const entries = new Map(
    Object.values(zip.files)
      .filter((entry) => !entry.dir && !entry.name.includes("__MACOSX"))
      .map((entry) => [entry.name.toLowerCase(), entry]),
  );
  const shapes = [...entries.keys()].filter((name) => name.endsWith(".shp"));
  if (!shapes.length) throw new Error("ZIP não contém Shapefile");
  const features: ParsedFeature[] = [];
  const projections = new Set<string>();
  // Uma camada por vez: não descompactar todos os componentes/camadas em paralelo.
  for (const name of shapes) {
    const base = name.slice(0, -4);
    const dbfEntry = entries.get(`${base}.dbf`);
    if (!dbfEntry || !entries.has(`${base}.shx`))
      throw new Error(`Shapefile ${base} precisa de .shp, .shx e .dbf com o mesmo nome`);
    const prj = (await entries.get(`${base}.prj`)?.async("string"))?.trim();
    if (prj) {
      try {
        // Não usar um ponto de prova fora da área de validade da projeção.
        // Os pontos efetivos são conferidos após a transformação abaixo.
        proj4(prj);
      } catch {
        throw new Error(`Sistema de referência .prj inválido ou não suportado: ${base}`);
      }
      projections.add(prj);
    } else {
      projections.add("EPSG:4326 (assumido; origem sem .prj)");
    }
    const encodingEntry = entries.get(`${base}.cpg`) ?? entries.get(`${base}.cst`);
    const encoding = (await encodingEntry?.async("string"))?.trim();
    const geometries = shp.parseShp(await entries.get(name)!.async("nodebuffer"), prj);
    const rows = readDbfRows(await dbfEntry.async("nodebuffer"), encoding);
    if (geometries.length !== rows.length)
      throw new Error(`SHP e DBF de ${base} têm quantidades diferentes de registros`);
    for (let index = 0; index < geometries.length; index++) {
      const geometry = geometries[index];
      // Nunca filtrar SHP e DBF independentemente: inclusive null shapes e deletados.
      if (geometry && !rows[index].deleted)
        features.push({ geometry, properties: rows[index].properties });
    }
  }
  const geomType = features.length ? geomTypeFromGeoJsonType(features[0].geometry.type) : "Polygon";
  return { features, geomType, sourceProjection: [...projections].join("\n") };
}

function validateGeometry(geometry: ParsedFeature["geometry"]) {
  if (geometry.type === "GeometryCollection") {
    if (!Array.isArray(geometry.geometries)) throw new Error("GeometryCollection inválida");
    geometry.geometries.forEach(validateGeometry);
    return;
  }
  if (
    !["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(
      geometry.type,
    )
  )
    throw new Error(`Tipo geométrico não suportado: ${geometry.type}`);
  const walk = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates) || !coordinates.length)
      throw new Error("Geometria contém coordenadas vazias ou inválidas");
    if (typeof coordinates[0] === "number") {
      const [longitude, latitude] = coordinates as unknown[];
      if (
        !coordinates.every((value) => typeof value === "number" && Number.isFinite(value)) ||
        typeof longitude !== "number" ||
        longitude < -180 ||
        longitude > 180 ||
        typeof latitude !== "number" ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error(
          "Coordenadas fora de longitude/latitude WGS84; confira o .prj do Shapefile e o sistema de referência do arquivo",
        );
      }
    } else coordinates.forEach(walk);
  };
  walk(geometry.coordinates);
}

export async function parseSpatialFile(
  buffer: Buffer,
  formato: "Shapefile" | "GeoJSON" | "KML" | "KMZ" | "CSV" | "PDF",
): Promise<ParsedResult> {
  let result: ParsedResult;
  switch (formato) {
    case "CSV":
      result = parseCsvBuffer(buffer);
      break;
    case "GeoJSON":
      result = parseGeoJsonBuffer(buffer);
      break;
    case "KML":
      result = parseKmlBuffer(buffer);
      break;
    case "KMZ":
      result = await parseKmzBuffer(buffer);
      break;
    case "Shapefile":
      result = await parseShapefileZip(buffer);
      break;
    case "PDF":
      throw new Error("PDF não tem geometria — não deveria entrar no pipeline de parse");
  }
  result.features.forEach((feature) => validateGeometry(feature.geometry));
  return { ...result, sourceProjection: result.sourceProjection ?? "EPSG:4326" };
}
