import {
  datasetColor,
  datasetFieldLabel,
  formatDatasetValue,
  isDatasetTileUrl,
  isEmptyDatasetValue,
} from "../../../web/src/lib/dataset-map-presentation";

describe("apresentação genérica de atributos importados", () => {
  it("oculta campos vazios sem ocultar zero e falso", () => {
    expect([null, undefined, "", "   ", []].every(isEmptyDatasetValue)).toBe(true);
    expect([0, false, "00001", [1]].some(isEmptyDatasetValue)).toBe(false);
  });

  it("formata tipos reais sem transformar códigos textuais em números", () => {
    expect(formatDatasetValue(1234.5)).toBe("1.234,5");
    expect(formatDatasetValue(false)).toBe("Não");
    expect(formatDatasetValue("00001")).toBe("00001");
    expect(formatDatasetValue("2022-12-19")).toBe("19/12/2022");
    expect(formatDatasetValue({ situação: "Indígena" })).toBe('{"situação":"Indígena"}');
  });

  it("preserva acentos e conteúdo não confiável como texto", () => {
    const unsafe = '<img src=x onerror="alert(1)"> Carnaíba';
    expect(formatDatasetValue(unsafe)).toBe(unsafe);
    expect(formatDatasetValue("Aldeia Indígena Fortaleza do Castanho")).toContain("Indígena");
    expect(datasetFieldLabel("área_total")).toBe("Área total");
    expect(datasetFieldLabel("codigoImovel")).toBe("Codigo Imovel");
  });

  it("mantém a cor estável por dataset", () => {
    expect(datasetColor("ds-imovel")).toBe(datasetColor("ds-imovel"));
    expect(datasetColor("ds-imovel")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("autenticação de tiles", () => {
  const api = "https://geoserver.example/api";
  it("envia autenticação apenas aos tiles da própria API", () => {
    expect(isDatasetTileUrl(`${api}/datasets/abc/tiles/5/12/14.mvt`, api)).toBe(true);
    expect(isDatasetTileUrl(`${api}/datasets/abc/tiles/5/12/14.mvt?v=1`, api)).toBe(true);
    expect(isDatasetTileUrl("https://tile.openstreetmap.org/5/12/14.png", api)).toBe(false);
    expect(
      isDatasetTileUrl("https://geoserver.example.evil/api/datasets/abc/tiles/5/12/14.mvt", api),
    ).toBe(false);
    expect(
      isDatasetTileUrl("https://geoserver.example/api-other/datasets/abc/tiles/5/12/14.mvt", api),
    ).toBe(false);
    expect(isDatasetTileUrl(`${api}/datasets/abc/export`, api)).toBe(false);
  });
});
