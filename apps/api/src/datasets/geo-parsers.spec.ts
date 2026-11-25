import JSZip from "jszip";
import proj4 from "proj4";
import { parseSpatialFile } from "./geo-parsers";

type Field = { name: string; type: string; length: number };

function dbf(
  fields: Field[],
  rows: { values: string[]; deleted?: boolean }[],
  encoding: BufferEncoding = "latin1",
) {
  const headerLength = 33 + fields.length * 32;
  const recordLength = 1 + fields.reduce((sum, field) => sum + field.length, 0);
  const buffer = Buffer.alloc(headerLength + rows.length * recordLength + 1, 0);
  buffer[0] = 3;
  buffer.writeUInt32LE(rows.length, 4);
  buffer.writeUInt16LE(headerLength, 8);
  buffer.writeUInt16LE(recordLength, 10);
  fields.forEach((field, index) => {
    const offset = 32 + index * 32;
    buffer.write(field.name, offset, 10, "ascii");
    buffer[offset + 11] = field.type.charCodeAt(0);
    buffer[offset + 16] = field.length;
  });
  buffer[headerLength - 1] = 0x0d;
  rows.forEach((row, index) => {
    let offset = headerLength + index * recordLength;
    buffer[offset++] = row.deleted ? 0x2a : 0x20;
    fields.forEach((field, fieldIndex) => {
      buffer.fill(0x20, offset, offset + field.length);
      buffer.write(row.values[fieldIndex], offset, field.length, encoding);
      offset += field.length;
    });
  });
  buffer[buffer.length - 1] = 0x1a;
  return buffer;
}

function pointShp(points: ([number, number] | null)[]) {
  const buffer = Buffer.alloc(100 + points.reduce((sum, point) => sum + (point ? 28 : 12), 0));
  buffer.writeInt32BE(9994, 0);
  buffer.writeInt32BE(buffer.length / 2, 24);
  buffer.writeInt32LE(1000, 28);
  buffer.writeInt32LE(1, 32);
  let offset = 100;
  points.forEach((point, index) => {
    buffer.writeInt32BE(index + 1, offset);
    buffer.writeInt32BE(point ? 10 : 2, offset + 4);
    buffer.writeInt32LE(point ? 1 : 0, offset + 8);
    if (point) {
      buffer.writeDoubleLE(point[0], offset + 12);
      buffer.writeDoubleLE(point[1], offset + 20);
    }
    offset += point ? 28 : 12;
  });
  return buffer;
}

async function archive(
  points: ([number, number] | null)[],
  rows: { values: string[]; deleted?: boolean }[],
  options: {
    prj?: string;
    cst?: string;
    cpg?: string;
    encoding?: BufferEncoding;
    fields?: Field[];
  } = {},
) {
  const zip = new JSZip();
  zip.file("camada.SHP", pointShp(points));
  zip.file("camada.shx", Buffer.alloc(100));
  zip.file(
    "camada.dbf",
    dbf(options.fields ?? [{ name: "NOME", type: "C", length: 50 }], rows, options.encoding),
  );
  if (options.prj) zip.file("camada.prj", options.prj);
  if (options.cst) zip.file("camada.cst", options.cst);
  if (options.cpg) zip.file("camada.cpg", options.cpg);
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

describe("importação geoespacial", () => {
  it("preserva Latin-1 do .cst, ordem longitude/latitude e associação após null shape/deletado", async () => {
    const result = await parseSpatialFile(
      await archive(
        [[-37.7860389957, -10.9412705554], null, [-45, -12], [-50, -15]],
        [
          { values: ["Carnaíba"] },
          { values: ["Sem geometria"] },
          { values: ["Deletado"], deleted: true },
          { values: ["Indígena"] },
        ],
        { cst: "ISO-8859-1" },
      ),
      "Shapefile",
    );
    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toMatchObject({
      geometry: { type: "Point", coordinates: [-37.7860389957, -10.9412705554] },
      properties: { NOME: "Carnaíba" },
    });
    expect(result.features[1]).toMatchObject({
      geometry: { coordinates: [-50, -15] },
      properties: { NOME: "Indígena" },
    });
  });

  it("detecta UTF-8 sem CPG e respeita CPG UTF-8 explícito", async () => {
    for (const cpg of [undefined, "65001"]) {
      const result = await parseSpatialFile(
        await archive([[-40, -10]], [{ values: ["São José — 日本"] }], { encoding: "utf8", cpg }),
        "Shapefile",
      );
      expect(result.features[0].properties.NOME).toBe("São José — 日本");
    }
  });

  it("reprojeta origem projetada e registra a projeção sem inverter eixos", async () => {
    const point: [number, number] = [-47.9292, -15.7801];
    const projected = proj4("EPSG:4326", "EPSG:3857", point);
    const result = await parseSpatialFile(
      await archive([projected], [{ values: ["Brasília"] }], { prj: "EPSG:3857" }),
      "Shapefile",
    );
    const coordinates = result.features[0].geometry.coordinates as number[];
    expect(coordinates[0]).toBeCloseTo(point[0], 8);
    expect(coordinates[1]).toBeCloseTo(point[1], 8);
    expect(result.sourceProjection).toBe("EPSG:3857");
  });

  it("recusa PRJ inválido e coordenadas projetadas sem PRJ", async () => {
    await expect(
      parseSpatialFile(await archive([[1_000_000, 2_000_000]], [{ values: ["A"] }]), "Shapefile"),
    ).rejects.toThrow("longitude/latitude");
    await expect(
      parseSpatialFile(
        await archive([[-40, -10]], [{ values: ["A"] }], { prj: "projecao inexistente" }),
        "Shapefile",
      ),
    ).rejects.toThrow(".prj inválido");
  });

  it("preserva números/booleanos/datas e trata numéricos ausentes como null", async () => {
    const fields = [
      { name: "AREA", type: "N", length: 20 },
      { name: "ATIVO", type: "L", length: 1 },
      { name: "DATA", type: "D", length: 8 },
      { name: "NULO", type: "N", length: 19 },
    ];
    const result = await parseSpatialFile(
      await archive(
        [[-40, -10]],
        [{ values: ["1234.50", "T", "20240229", "*******************"] }],
        { fields },
      ),
      "Shapefile",
    );
    expect(result.features[0].properties).toEqual({
      AREA: 1234.5,
      ATIVO: true,
      DATA: "2024-02-29",
      NULO: null,
    });
  });

  it("recusa SHP/DBF com contagens divergentes em vez de misturar atributos", async () => {
    await expect(
      parseSpatialFile(
        await archive(
          [
            [-40, -10],
            [-41, -11],
          ],
          [{ values: ["A"] }],
        ),
        "Shapefile",
      ),
    ).rejects.toThrow("quantidades diferentes");
  });

  it("recusa tipos binários DBF não suportados em vez de decodificá-los como texto", async () => {
    await expect(
      parseSpatialFile(
        await archive([[-40, -10]], [{ values: ["binary"] }], {
          fields: [{ name: "BINARIO", type: "B", length: 8 }],
        }),
        "Shapefile",
      ),
    ).rejects.toThrow("Tipo de campo DBF não suportado");
  });

  it("mantém MultiPolygon/linhas como geometrias originais e rejeita latitude inválida", async () => {
    const geometry = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [-40, -10],
            [-41, -10],
            [-41, -11],
            [-40, -10],
          ],
        ],
      ],
    };
    const result = await parseSpatialFile(
      Buffer.from(JSON.stringify({ type: "Feature", geometry, properties: { nome: "Área" } })),
      "GeoJSON",
    );
    expect(result.features[0].geometry).toEqual(geometry);
    await expect(parseSpatialFile(Buffer.from("lat,lng\n100,-40"), "CSV")).rejects.toThrow(
      "longitude/latitude",
    );
    await expect(
      parseSpatialFile(
        Buffer.from(
          JSON.stringify({
            type: "FeatureCollection",
            crs: { properties: { name: "EPSG:3857" } },
            features: [],
          }),
        ),
        "GeoJSON",
      ),
    ).rejects.toThrow("reprojete");
  });
});
