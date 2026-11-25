import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DatasetMap, filterMapProperties, readMapConfig, safeMapField } from "./dataset-map";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "@geo/shared";

const admin: AuthUser = {
  id: "admin",
  nome: "Admin",
  email: "a@local.test",
  role: "admin",
  status: "ativo",
};
const owner: AuthUser = { ...admin, id: "owner", role: "pesquisador_envio" };
const ds = { id: "dataset-1", nome: "Território", createdById: "owner", mapConfig: null };

describe("atributos seguros do mapa", () => {
  it("preserva acentos, tipos JSON e evita campos sensíveis/internos recursivos", () => {
    expect(
      filterMapProperties(
        {
          nome: "Carnaíba",
          n: 12.5,
          ativo: false,
          CPF: "123",
          _secret: "x",
          extra: { email: "x", local: "Aldeia Indígena", lista: [{ token: "secret", value: 1 }] },
        },
        readMapConfig(null),
        true,
      ),
    ).toEqual({
      nome: "Carnaíba",
      n: 12.5,
      ativo: false,
      extra: { local: "Aldeia Indígena", lista: [{ value: 1 }] },
    });
    expect(safeMapField("proprietário")).toBe(false);
    for (const key of [
      "storage_key",
      "created_by_id",
      "nomePessoa",
      "nome_completo",
      "e-mail",
      "_internal",
      "senhaHash",
    ])
      expect(safeMapField(key)).toBe(false);
    expect(safeMapField("cod_imovel")).toBe(true);
  });
  it("público recebe apenas allowlist e respeita campos visíveis", () => {
    const config = readMapConfig({
      publicFields: ["nome", "n"],
      visibleFields: ["nome"],
      titleField: "nome",
    });
    expect(
      filterMapProperties({ nome: "Carnaíba", n: 10, outro: "privado" }, config, false),
    ).toEqual({ nome: "Carnaíba" });
    expect(filterMapProperties({ nome: "Carnaíba" }, readMapConfig(null), false)).toEqual({});
  });
});

describe("configuração e associação de feição", () => {
  it("autor não pode aprovar atributos públicos", async () => {
    const prisma = { $queryRaw: vi.fn(), dataset: { update: vi.fn() } };
    const map = new DatasetMap(prisma as unknown as PrismaService, ds, owner);
    await expect(map.configure({ publicFields: ["nome"] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it("revisor não pode configurar campo sensível nem inexistente", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { name: "nome", type: "string" },
        { name: "cpf", type: "string" },
      ]),
      dataset: { update: vi.fn() },
    };
    const map = new DatasetMap(prisma as unknown as PrismaService, ds, admin);
    await expect(map.configure({ publicFields: ["cpf"] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(map.configure({ titleField: "ausente" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.dataset.update).not.toHaveBeenCalled();
  });
  it("PATCH de apresentação usa somente chaves fornecidas, preservando revogação concorrente", async () => {
    const schema = [{ name: "nome", type: "string" }];
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(schema)
        .mockResolvedValueOnce([{ mapConfig: { publicFields: [], color: "#123456" } }])
        .mockResolvedValueOnce(schema)
        .mockResolvedValueOnce([{ west: null, south: null, east: null, north: null, types: [] }]),
    };
    const map = new DatasetMap(
      prisma as unknown as PrismaService,
      { ...ds, mapConfig: { publicFields: ["nome"] } },
      owner,
    );
    // DTOs transformados pelo Nest podem manter as propriedades opcionais como
    // chaves próprias com valor undefined; elas não devem apagar a configuração atual.
    const result = await map.configure({
      color: "#123456",
      publicFields: undefined,
      visibleFields: undefined,
    });
    const [query, serializedPatch, id] = prisma.$queryRaw.mock.calls[1] as [
      TemplateStringsArray,
      string,
      string,
    ];
    expect(query.join("?")).toContain('COALESCE("mapConfig",');
    expect(JSON.parse(serializedPatch) as unknown).toEqual({ color: "#123456" });
    expect(id).toBe(ds.id);
    expect(result.config.publicFields).toEqual([]);
  });
  it("detalhe consulta por dataset e feição, retorna título e atributos correspondentes", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "feature-2",
          properties: { nome: "Indígena", area: 12.5, cpf: "x" },
          geometryType: "POLYGON",
        },
      ]),
    };
    const map = new DatasetMap(
      prisma as unknown as PrismaService,
      { ...ds, mapConfig: { titleField: "nome", labels: { area: "Área (ha)" } } },
      owner,
    );
    const result = await map.detail("feature-2");
    expect(result).toMatchObject({
      id: "feature-2",
      datasetId: ds.id,
      title: "Indígena",
      properties: { nome: "Indígena", area: 12.5 },
      labels: { area: "Área (ha)" },
    });
    const query = prisma.$queryRaw.mock.calls[0][0] as TemplateStringsArray;
    expect(query.join("?")).toContain('WHERE "datasetId" = ');
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([ds.id, "feature-2"]);
  });
  it("feição inexistente não recupera registro de outro dataset", async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(
      new DatasetMap(prisma as unknown as PrismaService, ds, admin).detail("other-dataset-feature"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it("valida coordenadas de tile e paginação", async () => {
    const prisma = { $queryRaw: vi.fn() };
    const map = new DatasetMap(prisma as unknown as PrismaService, ds, admin);
    await expect(map.tile(23, 0, 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(map.tile(0, 1, 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(map.features({ pageSize: 201 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      map.clusterMembers({ z: 0, cellX: 8, cellY: 0, pageSize: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
