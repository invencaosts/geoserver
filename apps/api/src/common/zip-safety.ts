import { PayloadTooLargeException, UnprocessableEntityException } from "@nestjs/common";
import JSZip from "jszip";

export const ZIP_MAX_ENTRIES = 256;
export const ZIP_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
/** Dataset Shapefile pode ter DBF grande; anexos mantêm a cota original. */
export const DATASET_ZIP_MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
export const ZIP_MAX_COMPRESSION_RATIO = 200;

interface CompressedEntryData {
  compressedSize?: number;
  uncompressedSize?: number;
}

export async function inspectZipArchive(
  buffer: Buffer,
  maxUncompressedBytes = ZIP_MAX_UNCOMPRESSED_BYTES,
): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new UnprocessableEntityException("O conteúdo do arquivo não é um ZIP válido");
  }

  const entries = Object.values(zip.files);
  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new PayloadTooLargeException(`O ZIP excede o limite de ${ZIP_MAX_ENTRIES} entradas`);
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.dir) continue;

    const data = (entry as unknown as { _data?: CompressedEntryData })._data;
    const compressedSize = data?.compressedSize;
    const uncompressedSize = data?.uncompressedSize;
    if (
      typeof compressedSize !== "number" ||
      typeof uncompressedSize !== "number" ||
      !Number.isSafeInteger(compressedSize) ||
      !Number.isSafeInteger(uncompressedSize) ||
      compressedSize < 0 ||
      uncompressedSize < 0
    ) {
      throw new UnprocessableEntityException("O ZIP contém metadados de tamanho inválidos");
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxUncompressedBytes) {
      throw new PayloadTooLargeException(
        `O ZIP excede o limite de ${maxUncompressedBytes / 1024 / 1024} MB descompactados`,
      );
    }

    if (
      uncompressedSize > 0 &&
      uncompressedSize / Math.max(compressedSize, 1) > ZIP_MAX_COMPRESSION_RATIO
    ) {
      throw new PayloadTooLargeException(
        `O ZIP excede a razão máxima de compressão de ${ZIP_MAX_COMPRESSION_RATIO}:1`,
      );
    }
  }

  return zip;
}
