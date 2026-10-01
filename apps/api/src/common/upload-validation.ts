import { UnsupportedMediaTypeException } from "@nestjs/common";
import { inspectZipArchive } from "./zip-safety";

export const DATASET_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export interface ValidatedUpload {
  contentType: string;
  extension: string;
}

function rejected(message: string): never {
  throw new UnsupportedMediaTypeException(message);
}

function hasPrefix(buffer: Buffer, prefix: number[]) {
  return prefix.every((byte, index) => buffer[index] === byte);
}

function isZip(buffer: Buffer) {
  return hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]);
}

async function zipEntryNames(buffer: Buffer): Promise<string[]> {
  if (!isZip(buffer)) rejected("O conteúdo do arquivo não é um ZIP válido");
  const zip = await inspectZipArchive(buffer);
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name.toLowerCase());
}

function safeText(buffer: Buffer): string {
  if (buffer.includes(0)) rejected("O arquivo deveria conter texto, mas contém dados binários");
  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) rejected("O arquivo não contém texto UTF-8 válido");
  return text;
}

export function validateAvatarUpload(file: Express.Multer.File): ValidatedUpload {
  const { buffer } = file;
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return rejected("Formato inválido. Use uma imagem JPEG, PNG ou WebP válida");
}

export async function validateCaseAttachment(
  file: Express.Multer.File,
): Promise<ValidatedUpload> {
  const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf" && file.buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { contentType: "application/pdf", extension };
  }
  if (extension === "kmz") {
    const names = await zipEntryNames(file.buffer);
    if (names.some((name) => name.endsWith(".kml"))) {
      return { contentType: "application/vnd.google-earth.kmz", extension };
    }
  }

  return rejected("Anexo inválido. Envie um PDF válido ou um KMZ que contenha um arquivo KML");
}

export async function validateDatasetUpload(
  file: Express.Multer.File,
): Promise<ValidatedUpload> {
  const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") return validateCaseAttachment(file);

  if (extension === "zip") {
    const names = await zipEntryNames(file.buffer);
    const hasRequiredShapefileParts = [".shp", ".shx", ".dbf"].every((suffix) =>
      names.some((name) => name.endsWith(suffix)),
    );
    if (!hasRequiredShapefileParts) {
      return rejected("O ZIP deve conter os arquivos .shp, .shx e .dbf do shapefile");
    }
    return { contentType: "application/zip", extension };
  }

  if (extension === "kmz") return validateCaseAttachment(file);

  if (extension === "geojson" || extension === "json") {
    try {
      const json = JSON.parse(safeText(file.buffer));
      if (json && (json.type === "Feature" || json.type === "FeatureCollection")) {
        return { contentType: "application/geo+json", extension };
      }
    } catch (error) {
      if (error instanceof UnsupportedMediaTypeException) throw error;
    }
    return rejected("O arquivo não contém GeoJSON válido");
  }

  if (extension === "kml") {
    const text = safeText(file.buffer).trimStart();
    if (
      (text.startsWith("<?xml") || /^<kml(?:\s|>)/i.test(text)) &&
      /<kml(?:\s|>)/i.test(text)
    ) {
      return { contentType: "application/vnd.google-earth.kml+xml", extension };
    }
    return rejected("O arquivo não contém KML válido");
  }

  if (extension === "csv") {
    const text = safeText(file.buffer).trimStart();
    if (text && !text.startsWith("<") && text.split(/\r?\n/, 1)[0].includes(",")) {
      return { contentType: "text/csv; charset=utf-8", extension };
    }
    return rejected("O arquivo não contém CSV válido com cabeçalho separado por vírgulas");
  }

  return rejected(
    `Extensão .${extension} não suportada. Use .zip, .geojson, .kml, .kmz, .csv ou .pdf`,
  );
}
