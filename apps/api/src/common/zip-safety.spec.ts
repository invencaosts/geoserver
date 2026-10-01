import JSZip from "jszip";
import {
  inspectZipArchive,
  ZIP_MAX_ENTRIES,
  ZIP_MAX_UNCOMPRESSED_BYTES,
} from "./zip-safety";

async function makeZip(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("segurança de ZIP", () => {
  it("aceita um arquivo normal dentro das cotas", async () => {
    const buffer = await makeZip({ "doc.kml": "<kml></kml>" });
    const zip = await inspectZipArchive(buffer);
    expect(Object.keys(zip.files)).toEqual(["doc.kml"]);
  });

  it("rejeita tamanho descompactado malicioso informado no diretório central", async () => {
    const buffer = await makeZip({ "doc.kml": "<kml></kml>" });
    const centralDirectory = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(centralDirectory).toBeGreaterThanOrEqual(0);
    buffer.writeUInt32LE(ZIP_MAX_UNCOMPRESSED_BYTES + 1, centralDirectory + 24);

    await expect(inspectZipArchive(buffer)).rejects.toMatchObject({ status: 413 });
  });

  it("rejeita quantidade excessiva de entradas", async () => {
    const files = Object.fromEntries(
      Array.from({ length: ZIP_MAX_ENTRIES + 1 }, (_, index) => [`${index}.txt`, ""]),
    );
    await expect(inspectZipArchive(await makeZip(files))).rejects.toMatchObject({ status: 413 });
  });

  it("rejeita razão de compressão característica de zip bomb", async () => {
    const buffer = await makeZip({ "zeros.bin": "0".repeat(1024 * 1024) });
    await expect(inspectZipArchive(buffer)).rejects.toMatchObject({ status: 413 });
  });
});

