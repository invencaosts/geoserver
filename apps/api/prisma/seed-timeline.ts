// Carrega as planilhas de timeline (formato TimelineJS3) e os PDFs de leis/decretos/
// constituições relacionados, publicando os PDFs no Minio e populando `timeline_events`.
// Rodar: pnpm --filter api run seed:timeline
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";
import { PrismaClient, TimelineEscopo } from "@prisma/client";
import { Client as MinioClient } from "minio";

const SEED_DIR = join(__dirname, "seed-data");
const LEIS_BRASIL_DIR = join(SEED_DIR, "leis-brasil");
const TITLE_ILLUSTRATION_PATH = join(SEED_DIR, "assets/title-illustration.svg");
const TIMELINE_BUCKET = "timeline-leis";

// Casa cada evento com seu PDF pelo número da lei/decreto/ano citado no headline —
// não dá pra usar só o "Year" da planilha porque vários eventos compartilham ano
// (ex: 1822 tem "Regime das Posses" e "Constituição Portuguesa" na mesma linha do tempo).
const BRASIL_PDF_BY_HEADLINE_HINT: [string, string][] = [
  ["constituição portuguesa", "Constituição_Portuguesa_1822.pdf"],
  ["constituição imperial", "Constituição_Imperial_1824.pdf"],
  ["lei de terras", "lei_601_18_setembro_1850.pdf"],
  ["1.318", "Decreto_1318_30_janeiro_1854.pdf"],
  ["1.237", "lei_1237_24_setembro_1864.pdf"],
  ["3.453", "Decreto_3453_26_abril_1865.pdf"],
  ["451-b", "Decreto_451B_31_maio_1890.pdf"],
  ["nº 720", "Decreto_720_5_setembro_1890.pdf"],
  ["1891", "Constituição_Federal_1891.pdf"],
  ["3.071", "Lei_3071_01_janeiro_1916.pdf"],
  ["19.924", "Decreto_19924_27_abril_1931.pdf"],
  ["22.785", "Decreto_22785_31_maio_1933.pdf"],
  ["1946", "Constituição_Federal_1946.pdf"],
  ["1.164", "DecretoLei_1164_01_abril_1971.pdf"],
  ["10.406", "Lei_10406_10_janeiro_2002.pdf"],
  ["11.952", "Lei_11952_25_junho_2009.pdf"],
  ["13.465", "Lei_13465_11_julho_2017.pdf"],
  ["instrução normativa", "Instrução_normativa_n9__21_maio_2019.pdf"],
];

interface SheetRow {
  Year: number | string | null;
  Month?: number | null;
  Day?: number | null;
  "End Year"?: number | string | null;
  "End Month"?: number | null;
  "End Day"?: number | null;
  "Display Date"?: string | null;
  Headline?: string | null;
  Text?: string | null;
  Media?: string | null;
  "Media Credit"?: string | null;
  "Media Caption"?: string | null;
  "Media Thumbnail"?: string | null;
  Type?: string | null;
  Group?: string | null;
  Background?: string | null;
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function readSheet(path: string): SheetRow[] {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<SheetRow>(ws, { defval: null });
}

async function setupMinio() {
  const endPoint = process.env.MINIO_ENDPOINT ?? "localhost";
  const port = Number(process.env.MINIO_PORT ?? 9004);
  const client = new MinioClient({
    endPoint,
    port,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY ?? "geo_admin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "geo_dev_pw_123",
  });
  const publicUrl = process.env.MINIO_PUBLIC_URL ?? `http://${endPoint}:${port}`;

  const exists = await client.bucketExists(TIMELINE_BUCKET).catch(() => false);
  if (!exists) await client.makeBucket(TIMELINE_BUCKET);
  await client.setBucketPolicy(
    TIMELINE_BUCKET,
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${TIMELINE_BUCKET}/*`],
        },
      ],
    }),
  );

  return { client, publicUrl };
}

async function uploadLeisBrasil(client: MinioClient, publicUrl: string) {
  const urlByFilename = new Map<string, string>();
  for (const filename of readdirSync(LEIS_BRASIL_DIR)) {
    const key = `brasil/${filename}`;
    const buffer = readFileSync(join(LEIS_BRASIL_DIR, filename));
    await client.putObject(TIMELINE_BUCKET, key, buffer, buffer.length, {
      "Content-Type": "application/pdf",
    });
    urlByFilename.set(filename, `${publicUrl}/${TIMELINE_BUCKET}/${key}`);
  }
  return urlByFilename;
}

async function uploadTitleIllustration(client: MinioClient, publicUrl: string) {
  const key = "assets/title-illustration.svg";
  const buffer = readFileSync(TITLE_ILLUSTRATION_PATH);
  await client.putObject(TIMELINE_BUCKET, key, buffer, buffer.length, {
    "Content-Type": "image/svg+xml",
  });
  return `${publicUrl}/${TIMELINE_BUCKET}/${key}`;
}

function resolveBrasilMedia(
  row: SheetRow,
  urlByFilename: Map<string, string>,
  titleIllustrationUrl: string,
): string | null {
  if (row.Type === "title") return titleIllustrationUrl;
  const headline = (row.Headline ?? "").toLowerCase();
  const hint = BRASIL_PDF_BY_HEADLINE_HINT.find(([needle]) => headline.includes(needle));
  if (hint) return urlByFilename.get(hint[1]) ?? null;
  return row.Media || null;
}

function isEmptyRow(row: SheetRow): boolean {
  return !row.Headline && !row.Text && toInt(row.Year) === null;
}

async function main() {
  const prisma = new PrismaClient();
  const existing = await prisma.timelineEvent.count();
  if (existing > 0) {
    console.log(`timeline_events já tem ${existing} registros, pulando seed.`);
    await prisma.$disconnect();
    return;
  }

  const { client, publicUrl } = await setupMinio();
  const urlByFilename = await uploadLeisBrasil(client, publicUrl);
  const titleIllustrationUrl = await uploadTitleIllustration(client, publicUrl);
  console.log(`${urlByFilename.size} PDFs de leis do Brasil publicados no Minio.`);

  const events: {
    escopo: TimelineEscopo;
    estado: string | null;
    startYear: number | null;
    startMonth: number | null;
    startDay: number | null;
    endYear: number | null;
    endMonth: number | null;
    endDay: number | null;
    displayDate: string | null;
    headline: string;
    text: string;
    mediaUrl: string | null;
    mediaCredit: string | null;
    mediaCaption: string | null;
    mediaThumb: string | null;
    type: string | null;
    background: string | null;
  }[] = [];

  const brasilRows = readSheet(join(SEED_DIR, "timeline-brasil.xlsx")).filter(
    (r) => !isEmptyRow(r),
  );
  for (const row of brasilRows) {
    events.push({
      escopo: TimelineEscopo.nacional,
      estado: null,
      startYear: toInt(row.Year),
      startMonth: toInt(row.Month),
      startDay: toInt(row.Day),
      endYear: toInt(row["End Year"]),
      endMonth: toInt(row["End Month"]),
      endDay: toInt(row["End Day"]),
      displayDate: row["Display Date"] || null,
      headline: row.Headline ?? "",
      text: row.Text ?? "",
      mediaUrl: resolveBrasilMedia(row, urlByFilename, titleIllustrationUrl),
      mediaCredit: row["Media Credit"] || null,
      mediaCaption: row["Media Caption"] || null,
      mediaThumb: row["Media Thumbnail"] || null,
      type: row.Type || null,
      background: row.Background || null,
    });
  }

  const mgRows = readSheet(join(SEED_DIR, "timeline-mg.xlsx")).filter((r) => !isEmptyRow(r));
  for (const row of mgRows) {
    events.push({
      escopo: TimelineEscopo.estadual,
      estado: "MG",
      startYear: toInt(row.Year),
      startMonth: toInt(row.Month),
      startDay: toInt(row.Day),
      endYear: toInt(row["End Year"]),
      endMonth: toInt(row["End Month"]),
      endDay: toInt(row["End Day"]),
      displayDate: row["Display Date"] || null,
      headline: row.Headline ?? "",
      text: row.Text ?? "",
      mediaUrl: row.Type === "title" ? titleIllustrationUrl : row.Media || null,
      mediaCredit: row["Media Credit"] || null,
      mediaCaption: row["Media Caption"] || null,
      mediaThumb: row["Media Thumbnail"] || null,
      type: row.Type || null,
      background: row.Background || null,
    });
  }

  await prisma.timelineEvent.createMany({ data: events });
  console.log(
    `Concluído: ${events.length} eventos de timeline carregados (${brasilRows.length} nacionais, ${mgRows.length} MG).`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
