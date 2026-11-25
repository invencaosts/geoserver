/** Opt-in validation. Never connects to the application database or publishes data. */
import "reflect-metadata";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, parse } from "node:path";
import JSZip from "jszip";
import type { Job } from "bullmq";
import { DatasetImportProcessor } from "./dataset-import.processor";
import { parseSpatialFile, type ParsedFeature } from "./geo-parsers";
import { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { validateDatasetUpload } from "../common/upload-validation";

const expected = [
  { name: "AREA_IMOVEL_1", count: 54651, kind: "Polygon" },
  { name: "RESERVAS_GARIMPEIRAS", count: 17, kind: "Polygon" },
  { name: "cete_BR_LQs_22_ptPoint", count: 8441, kind: "Point" },
  { name: "cete_BR_LIs_CD2022_191224Point", count: 10967, kind: "Point" },
] as const;

async function locate(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (
        expected.some((dataset) => entry.name.toLowerCase() === `${dataset.name.toLowerCase()}.shp`)
      )
        result.set(parse(entry.name).name.toLowerCase(), path);
    }
  };
  await walk(root);
  return result;
}

async function makeZip(shapePath: string) {
  const { dir, name } = parse(shapePath);
  const zip = new JSZip();
  for (const file of await readdir(dir)) {
    const part = parse(file);
    if (
      part.name.toLowerCase() === name.toLowerCase() &&
      [".shp", ".shx", ".dbf", ".prj", ".cpg", ".cst"].includes(part.ext.toLowerCase())
    )
      zip.file(file, await readFile(join(dir, file)));
  }
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
  });
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalized(item)]),
    );
  return value;
}

function fingerprint(properties: ParsedFeature["properties"]) {
  return createHash("sha256")
    .update(JSON.stringify(normalized(properties)))
    .digest("hex");
}

function sameGeometry(
  expectedGeometry: ParsedFeature["geometry"],
  actualGeometry: ParsedFeature["geometry"],
) {
  const close = (expectedValue: unknown, actualValue: unknown): boolean => {
    if (typeof expectedValue === "number" && typeof actualValue === "number")
      return Math.abs(expectedValue - actualValue) <= 1e-10;
    if (Array.isArray(expectedValue) && Array.isArray(actualValue))
      return (
        expectedValue.length === actualValue.length &&
        expectedValue.every((value, index) => close(value, actualValue[index]))
      );
    return expectedValue === actualValue;
  };
  // Bbox do parser é metadado redundante e não faz parte da geometria persistida PostGIS.
  return (
    expectedGeometry.type === actualGeometry.type &&
    close(expectedGeometry.coordinates, actualGeometry.coordinates)
  );
}

function bounds(features: ParsedFeature[]) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === "number") {
      const [longitude, latitude] = coordinates as number[];
      box[0] = Math.min(box[0], longitude);
      box[1] = Math.min(box[1], latitude);
      box[2] = Math.max(box[2], longitude);
      box[3] = Math.max(box[3], latitude);
    } else coordinates.forEach(walk);
  };
  features.forEach((feature) => walk(feature.geometry.coordinates));
  return box;
}

async function verifyDatabase(prisma: PrismaService, datasetId: string, features: ParsedFeature[]) {
  const expectedHashes = new Map<string, ParsedFeature["geometry"][]>();
  for (const feature of features) {
    const hash = fingerprint(feature.properties);
    const geometries = expectedHashes.get(hash) ?? [];
    geometries.push(feature.geometry);
    expectedHashes.set(hash, geometries);
  }
  let cursor = "";
  let checked = 0;
  while (true) {
    const rows = await prisma.$queryRaw<
      { id: string; geometry: string; properties: Record<string, unknown> }[]
    >`
      SELECT id, ST_AsGeoJSON(geom, 15) AS geometry, properties FROM features
      WHERE "datasetId" = ${datasetId} AND id > ${cursor} ORDER BY id LIMIT 500
    `;
    if (!rows.length) break;
    for (const row of rows) {
      const hash = fingerprint(row.properties);
      const geometries = expectedHashes.get(hash);
      const actualGeometry = JSON.parse(row.geometry) as ParsedFeature["geometry"];
      const match =
        geometries?.findIndex((geometry) => sameGeometry(geometry, actualGeometry)) ?? -1;
      assert(
        match >= 0 && geometries,
        `Geometria/atributos inesperados após armazenamento em ${datasetId}`,
      );
      geometries.splice(match, 1);
      if (!geometries.length) expectedHashes.delete(hash);
      checked++;
    }
    cursor = rows[rows.length - 1].id;
  }
  assert.equal(checked, features.length);
  assert.equal(expectedHashes.size, 0);
  return checked;
}

async function main() {
  const root = process.argv[2];
  assert(root, "Uso: pnpm --filter api validate:real-datasets '/caminho/das/bases' [--import]");
  let prisma: PrismaService | undefined;
  if (process.argv.includes("--import")) {
    const url = new URL(process.env.REAL_DATASET_DATABASE_URL ?? "");
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        /(?:map_validation|test)/i.test(url.pathname),
      "Importação de validação exige banco LOCAL separado com nome map_validation ou test",
    );
    process.env.DATABASE_URL = url.toString();
    prisma = new PrismaService();
    await prisma.$connect();
  }
  try {
    const paths = await locate(root);
    for (const dataset of expected) {
      const path = paths.get(dataset.name.toLowerCase());
      assert(path, `Arquivo não encontrado: ${dataset.name}.shp`);
      const start = performance.now();
      const buffer = await makeZip(path);
      await validateDatasetUpload({
        originalname: `${dataset.name}.zip`,
        buffer,
      } as Express.Multer.File);
      const result = await parseSpatialFile(buffer, "Shapefile");
      assert.equal(result.features.length, dataset.count);
      assert.equal(result.geomType, dataset.kind);
      const first = result.features[0];
      if (dataset.name === "RESERVAS_GARIMPEIRAS") assert.equal(first.properties.NOME, "Carnaíba");
      if (dataset.name === "cete_BR_LQs_22_ptPoint") {
        const xy = first.geometry.coordinates as number[];
        assert(Math.abs(xy[0] - Number(first.properties.Long_d)) < 1e-10);
        assert(Math.abs(xy[1] - Number(first.properties.Lat_d)) < 1e-10);
      }
      if (dataset.name === "cete_BR_LIs_CD2022_191224Point") {
        assert.equal(first.properties.NM_LI, "Aldeia Indígena Fortaleza do Castanho");
        assert.equal(first.properties.C_CR_FUNAI, null);
      }
      let storedId: string | undefined;
      let storedChecked: number | undefined;
      if (prisma) {
        const created = await prisma.dataset.create({
          data: {
            nome: `map-validation ${dataset.name}`,
            formato: "Shapefile",
            tipoGeometria: result.geomType,
            status: "processing",
            visibility: "restrito",
            storageKey: `validation/${dataset.name}.zip`,
          },
        });
        const processor = new DatasetImportProcessor(prisma, {
          getBuffer: () => Promise.resolve(buffer),
        } as unknown as MinioService);
        await processor.process({ data: { datasetId: created.id } } as Job<{ datasetId: string }>);
        storedId = created.id;
        storedChecked = await verifyDatabase(prisma, created.id, result.features);
        assert.equal(
          (await prisma.dataset.findUniqueOrThrow({ where: { id: created.id } })).visibility,
          "restrito",
        );
      }
      console.log(
        JSON.stringify({
          name: dataset.name,
          count: result.features.length,
          geometryTypes: [...new Set(result.features.map((feature) => feature.geometry.type))],
          bounds: bounds(result.features),
          fields: Object.entries(first.properties).map(([name, value]) => ({
            name,
            type: value === null ? "null" : typeof value,
          })),
          zipBytes: buffer.length,
          sourceProjection: result.sourceProjection,
          storedId,
          storedChecked,
          seconds: Number(((performance.now() - start) / 1000).toFixed(2)),
          rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        }),
      );
    }
  } finally {
    await prisma?.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
