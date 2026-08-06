import { parse as parseCsv } from "csv-parse/sync";
import { DOMParser } from "@xmldom/xmldom";
import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import JSZip from "jszip";

// shpjs é um bundle voltado a browser (usa `self`); precisa desse polyfill pra rodar em Node.
if (typeof (globalThis as any).self === "undefined") {
  (globalThis as any).self = globalThis;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shp = require("shpjs");

export interface ParsedFeature {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

export interface ParsedResult {
  features: ParsedFeature[];
  geomType: "Point" | "Polygon" | "Line";
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
    throw new Error("CSV precisa de colunas de latitude/longitude (lat/lng, latitude/longitude, x/y)");
  }

  const features: ParsedFeature[] = rows
    .map((row): ParsedFeature | null => {
      const lat = Number(row[latKey]);
      const lng = Number(row[lngKey]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      const { [latKey]: _lat, [lngKey]: _lng, ...properties } = row;
      return {
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties,
      };
    })
    .filter((f): f is ParsedFeature => f !== null);

  return { features, geomType: "Point" };
}

function normalizeFeatureCollection(geojson: any): ParsedFeature[] {
  const raw = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  return raw
    .filter((f: any) => f && f.geometry)
    .map((f: any) => ({ geometry: f.geometry, properties: f.properties ?? {} }));
}

function parseGeoJsonBuffer(buffer: Buffer): ParsedResult {
  const geojson = JSON.parse(buffer.toString("utf-8"));
  const features = normalizeFeatureCollection(geojson);
  const geomType = features.length
    ? geomTypeFromGeoJsonType(features[0].geometry.type)
    : "Point";
  return { features, geomType };
}

function parseKmlText(xml: string): ParsedResult {
  const dom = new DOMParser().parseFromString(xml, "text/xml");
  const geojson = kmlToGeoJson(dom as unknown as Document);
  const features = normalizeFeatureCollection(geojson);
  const geomType = features.length
    ? geomTypeFromGeoJsonType(features[0].geometry.type)
    : "Point";
  return { features, geomType };
}

function parseKmlBuffer(buffer: Buffer): ParsedResult {
  return parseKmlText(buffer.toString("utf-8"));
}

async function parseKmzBuffer(buffer: Buffer): Promise<ParsedResult> {
  const zip = await JSZip.loadAsync(buffer);
  const kmlEntry = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".kml"),
  );
  if (!kmlEntry) throw new Error("KMZ não contém nenhum arquivo .kml");

  const xml = await kmlEntry.async("string");
  return parseKmlText(xml);
}

async function parseShapefileZip(buffer: Buffer): Promise<ParsedResult> {
  const result = await shp(buffer);
  const collections = Array.isArray(result) ? result : [result];
  const features = collections.flatMap((fc: any) => normalizeFeatureCollection(fc));
  const geomType = features.length
    ? geomTypeFromGeoJsonType(features[0].geometry.type)
    : "Polygon";
  return { features, geomType };
}

export async function parseSpatialFile(
  buffer: Buffer,
  formato: "Shapefile" | "GeoJSON" | "KML" | "KMZ" | "CSV" | "PDF",
): Promise<ParsedResult> {
  switch (formato) {
    case "CSV":
      return parseCsvBuffer(buffer);
    case "GeoJSON":
      return parseGeoJsonBuffer(buffer);
    case "KML":
      return parseKmlBuffer(buffer);
    case "KMZ":
      return parseKmzBuffer(buffer);
    case "Shapefile":
      return parseShapefileZip(buffer);
    case "PDF":
      throw new Error("PDF não tem geometria — não deveria entrar no pipeline de parse");
  }
}
