import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Queue } from "bullmq";
import type { AuthUser } from "@geo/shared";
import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { DatasetsService } from "./datasets.service";
import { DatasetMap } from "./dataset-map";

const connectionString = process.env.MAP_TEST_DATABASE_URL;
const admin: AuthUser = {
  id: "map-test-admin",
  nome: "Admin",
  email: "map@local.test",
  role: "admin",
  status: "ativo",
};

describe.skipIf(!connectionString)("mapa datasets — PostGIS real isolado", () => {
  let prisma: PrismaClient;
  let service: DatasetsService;
  let datasetId: string;
  let otherId: string;
  const decode = (tile: Buffer) => {
    const layer = new VectorTile(new PbfReader(tile)).layers.features;
    return layer ? Array.from({ length: layer.length }, (_, index) => layer.feature(index)) : [];
  };
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    service = new DatasetsService(prisma as PrismaService, {} as MinioService, {} as Queue);
    datasetId = `map-validation-${randomUUID()}`;
    otherId = `map-validation-${randomUUID()}`;
    await prisma.dataset.createMany({
      data: [datasetId, otherId].map((id) => ({
        id,
        nome: "Teste cartográfico",
        formato: "GeoJSON",
        tipoGeometria: "Point",
        status: "active",
        visibility: "restrito",
      })),
    });
    await prisma.$executeRaw`
      INSERT INTO features(id,"datasetId",geom,properties,"createdAt")
      SELECT ${datasetId}||'-'||lpad(n::text,5,'0'),${datasetId},ST_SetSRID(ST_MakePoint(-37.7860389957,-10.9412705554),4326),jsonb_build_object('nome','Feição '||n,'ordem',n,'cpf','protegido'),now()
      FROM generate_series(1,1205) n
    `;
    await prisma.$executeRaw`
      INSERT INTO features(id,"datasetId",geom,properties,"createdAt") VALUES
      (${otherId}||'-polygon',${otherId},ST_GeomFromText('POLYGON Z((-50 -15 30,-49 -15 31,-49 -14 32,-50 -14 33,-50 -15 30))',4326),'{"nome":"Área"}'::jsonb,now()),
      (${otherId}||'-line',${otherId},ST_GeomFromText('LINESTRING(-50 -15,-49 -14)',4326),'{"nome":"Linha"}'::jsonb,now()),
      (${otherId}||'-multipoint',${otherId},ST_GeomFromText('MULTIPOINT((-51 -16),(-52 -17))',4326),'{"nome":"Pontos"}'::jsonb,now())
    `;
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.dataset.deleteMany({ where: { id: { in: [datasetId, otherId] } } });
      await prisma.$disconnect();
    }
  });
  it("percorre 1.205 feições mantendo atributos e coordenadas associados", async () => {
    const ids = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await service.getMapFeatures(datasetId, admin, { pageSize: 200, cursor });
      for (const feature of page.features) {
        expect(feature.geometry).toEqual({
          type: "Point",
          coordinates: [-37.7860389957, -10.9412705554],
        });
        const number = Number(feature.id.slice(-5));
        expect(feature.properties).toEqual({ nome: `Feição ${number}`, ordem: number });
        ids.add(feature.id);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(ids.size).toBe(1205);
    expect(
      (await service.getMapFeature(datasetId, `${datasetId}-01001`, admin)).properties,
    ).toEqual({ nome: "Feição 1001", ordem: 1001 });
  });
  it("geometrias originais persistem e MVT renderiza áreas, linhas e multipontos", async () => {
    const page = await service.getMapFeatures(otherId, admin, { pageSize: 100 });
    expect(page.features.map((f) => (f.geometry as { type: string }).type).sort()).toEqual([
      "LineString",
      "MultiPoint",
      "Polygon",
    ]);
    const polygon = page.features.find((f) => f.id.endsWith("-polygon"))!.geometry as {
      coordinates: number[][][];
    };
    expect(polygon.coordinates[0][0]).toEqual([-50, -15, 30]);
    const tile = await service.getMapTile(otherId, 0, 0, 0, admin);
    const decoded = decode(tile);
    expect(decoded.find((f) => f.properties.featureId === `${otherId}-polygon`)?.type).toBe(3);
    expect(decoded.find((f) => f.properties.featureId === `${otherId}-line`)?.type).toBe(2);
    expect(decoded.some((f) => f.type === 1)).toBe(true);
    for (const feature of decoded) expect(Object.keys(feature.properties)).not.toContain("nome");
  });
  it("cluster e membros coincidentes são acessíveis além de mil, até zoom máximo", async () => {
    const half = 20037508.342789244;
    const rows = await prisma.$queryRaw<
      { x: number; y: number }[]
    >`SELECT ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(-37.7860389957,-10.9412705554),4326),3857)) as x,ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(-37.7860389957,-10.9412705554),4326),3857)) as y`;
    for (const z of [0, 22]) {
      const size = 40075016.68557849 / (8 * 2 ** z);
      const cellX = Math.floor((rows[0].x + half) / size),
        cellY = Math.floor((half - rows[0].y) / size);
      let cursor: string | undefined;
      const ids = new Set<string>();
      do {
        const page = await service.getMapClusterFeatures(
          datasetId,
          { z, cellX, cellY, pageSize: 200, cursor },
          admin,
        );
        page.features.forEach((f) => ids.add(f.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(ids.size).toBe(1205);
      const tile = await service.getMapTile(
        datasetId,
        z,
        Math.floor(cellX / 8),
        Math.floor(cellY / 8),
        admin,
      );
      expect(tile.length).toBeGreaterThan(0);
      expect(tile.toString("utf8")).not.toContain("protegido");
      expect(tile.toString("utf8")).toContain("point_count");
      const clusters = decode(tile).filter((f) => f.properties.cluster);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].type).toBe(1);
      expect(clusters[0].properties).toMatchObject({
        datasetId,
        point_count: 1205,
        clusterCellX: cellX,
        clusterCellY: cellY,
        z,
      });
      expect(clusters[0].properties).not.toHaveProperty("nome");
    }
  });
  it("restritos bloqueiam geometrias, detalhes, metadados e clusters", async () => {
    const other: AuthUser = { ...admin, id: "other", role: "pesquisador_envio_download" };
    for (const user of [undefined, other]) {
      await expect(service.getMapFeatures(datasetId, user)).rejects.toThrow(
        user ? "Dataset não encontrado" : "Seu perfil não possui permissão para exportar dados",
      );
      await expect(service.getMapFeature(datasetId, `${datasetId}-00001`, user)).rejects.toThrow(
        "Dataset não encontrado",
      );
      await expect(service.getMapTile(datasetId, 0, 0, 0, user)).rejects.toThrow(
        "Dataset não encontrado",
      );
      await expect(service.getMapMetadata(datasetId, user)).rejects.toThrow(
        "Dataset não encontrado",
      );
      await expect(
        service.getMapClusterFeatures(datasetId, { z: 0, cellX: 3, cellY: 4, pageSize: 100 }, user),
      ).rejects.toThrow("Dataset não encontrado");
    }
    await expect(service.getMapFeature(datasetId, `${otherId}-polygon`, admin)).rejects.toThrow(
      "Feição não encontrada",
    );
  });
  it("não duplica clusters parciais na borda entre tiles", async () => {
    const borderId = `map-validation-${randomUUID()}`;
    await prisma.dataset.create({
      data: {
        id: borderId,
        nome: "Borda",
        formato: "GeoJSON",
        tipoGeometria: "Point",
        status: "active",
        visibility: "restrito",
      },
    });
    try {
      await prisma.$executeRaw`
        INSERT INTO features(id,"datasetId",geom,properties,"createdAt") VALUES
        (${borderId}||'-a',${borderId},ST_SetSRID(ST_MakePoint(-0.01,-1),4326),'{}'::jsonb,now()),
        (${borderId}||'-b',${borderId},ST_SetSRID(ST_MakePoint(-1,-1),4326),'{}'::jsonb,now()),
        (${borderId}||'-c',${borderId},ST_SetSRID(ST_MakePoint(0.01,-1),4326),'{}'::jsonb,now())
      `;
      const left = decode(await service.getMapTile(borderId, 2, 1, 2, admin));
      const right = decode(await service.getMapTile(borderId, 2, 2, 2, admin));
      expect(left).toHaveLength(1);
      expect(left[0].properties).toMatchObject({
        cluster: true,
        point_count: 2,
        clusterCellX: 15,
        clusterCellY: 16,
      });
      expect(right).toHaveLength(1);
      expect(right[0].properties).toMatchObject({
        cluster: false,
        point_count: 1,
        featureId: `${borderId}-c`,
      });
      expect(
        (
          await service.getMapClusterFeatures(
            borderId,
            { z: 2, cellX: 15, cellY: 16, pageSize: 100 },
            admin,
          )
        ).features.map((f) => f.id),
      ).toEqual([`${borderId}-a`, `${borderId}-b`]);
    } finally {
      await prisma.dataset.delete({ where: { id: borderId } });
    }
  });
  it("bbox cruza o antimeridiano sem inverter coordenadas", async () => {
    const result = await service.getMapFeatures(datasetId, admin, {
      pageSize: 100,
      bbox: "170,-20,-170,20",
    });
    expect(result.features).toHaveLength(0);
    const visible = await service.getMapFeatures(datasetId, admin, {
      pageSize: 1,
      bbox: "-38,-11,-37,-10",
    });
    expect(visible.features).toHaveLength(1);
  });
  it("publicação não expõe atributos até aprovação específica da allowlist", async () => {
    await prisma.dataset.update({ where: { id: datasetId }, data: { visibility: "publico" } });
    const featureId = `${datasetId}-00001`;
    expect((await service.getMapFeature(datasetId, featureId)).properties).toEqual({});
    await service.configureMap(
      datasetId,
      { publicFields: ["nome"], titleField: "nome", labels: { nome: "Nome" } },
      admin,
    );
    expect((await service.getMapFeature(datasetId, featureId)).properties).toEqual({
      nome: "Feição 1",
    });
    expect((await service.getMapMetadata(datasetId)).fields.map((f) => f.name)).toEqual(["nome"]);
  });
  it("snapshot antigo do autor não restaura atributos públicos revogados pela verificação", async () => {
    const ownerId = `map-owner-${randomUUID()}`;
    const owner: AuthUser = { ...admin, id: ownerId, role: "pesquisador_envio" };
    await prisma.user.create({
      data: {
        id: ownerId,
        nome: "Autor",
        email: `${ownerId}@local.test`,
        senhaHash: "not-used",
        role: "pesquisador_envio",
      },
    });
    try {
      await prisma.dataset.update({
        where: { id: datasetId },
        data: {
          createdById: ownerId,
          visibility: "publico",
          mapConfig: { publicFields: ["nome"], color: "#654321" },
        },
      });
      const snapshot = await prisma.dataset.findUniqueOrThrow({ where: { id: datasetId } });
      await service.configureMap(datasetId, { publicFields: [] }, admin);
      // This request passed authorization before the reviewer revoked fields.
      await new DatasetMap(prisma as PrismaService, snapshot, owner).configure({
        color: "#123456",
      });
      const current = await service.getMapMetadata(datasetId, admin);
      await expect(service.getMapFeatures(datasetId, owner)).rejects.toThrow(
        "Seu perfil não possui permissão para exportar dados",
      );
      expect((await service.getMapTile(datasetId, 0, 0, 0, owner)).length).toBeGreaterThan(0);
      expect(current.config.color).toBe("#123456");
      expect(current.config.publicFields).toEqual([]);
      expect((await service.getMapFeature(datasetId, `${datasetId}-00001`)).properties).toEqual({});
      expect(
        (await service.getMapFeature(datasetId, `${datasetId}-00001`, owner)).properties,
      ).toEqual({ nome: "Feição 1", ordem: 1 });
    } finally {
      await prisma.dataset.update({ where: { id: datasetId }, data: { createdById: null } });
      await prisma.user.delete({ where: { id: ownerId } });
    }
  });
});
