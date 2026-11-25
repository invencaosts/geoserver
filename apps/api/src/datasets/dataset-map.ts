import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hasPermission, type AuthUser, type DatasetMapConfig } from "@geo/shared";
import type { PrismaService } from "../prisma/prisma.service";
import { isDatasetReviewer } from "./dataset-access.policy";
import type {
  DatasetMapConfigDto,
  DatasetMapFeaturesQueryDto,
  DatasetClusterQueryDto,
} from "./dto/dataset-map-query.dto";

const WORLD = 40075016.68557849;
const HALF = WORLD / 2;
export const CLUSTER_CELL_PIXELS = 64;
export const MAP_TILE_PIXELS = 512;
const emptyConfig: DatasetMapConfig = {
  titleField: null,
  visibleFields: null,
  labels: {},
  publicFields: [],
  color: null,
};
const sensitive =
  /(^_|password|passwd|senha|secret|segredo|token|authorization|storagekey|createdby|updatedby|deletedat|cpf|cnpj|rg$|email|telefone|celular|whatsapp|denunciante|denouncer|proprietario|owner|titular|responsavel|endereco|address|contact|contato|nomepessoa|personname|nomecompleto|documentopessoal|birth|nascimento)/i;
export function safeMapField(key: string) {
  return (
    key.length > 0 &&
    key.length <= 200 &&
    !key.startsWith("_") &&
    !sensitive.test(
      key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, ""),
    ) &&
    !["__proto__", "constructor", "prototype"].includes(key)
  );
}
export function readableMapLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toLocaleUpperCase("pt-BR"));
}
export function readMapConfig(value: unknown): DatasetMapConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ...emptyConfig, labels: {}, publicFields: [] };
  const raw = value as Partial<DatasetMapConfig>;
  return {
    titleField:
      typeof raw.titleField === "string" && safeMapField(raw.titleField) ? raw.titleField : null,
    visibleFields: Array.isArray(raw.visibleFields)
      ? raw.visibleFields.filter((v) => typeof v === "string" && safeMapField(v))
      : null,
    labels: Object.fromEntries(
      Object.entries(raw.labels ?? {}).filter(([k, v]) => safeMapField(k) && typeof v === "string"),
    ),
    publicFields: Array.isArray(raw.publicFields)
      ? raw.publicFields.filter((v) => typeof v === "string" && safeMapField(v))
      : [],
    color: typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : null,
  };
}
function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 16) return null;
  if (Array.isArray(value)) return value.map((item) => safeValue(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => safeMapField(key))
        .map(([key, item]) => [key, safeValue(item, depth + 1)]),
    );
  return value;
}
export function filterMapProperties(raw: unknown, config: DatasetMapConfig, privileged: boolean) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const visible = config.visibleFields === null ? null : new Set(config.visibleFields);
  const approved = new Set(config.publicFields);
  return Object.fromEntries(
    Object.entries(raw)
      .filter(
        ([key]) =>
          safeMapField(key) && (!visible || visible.has(key)) && (privileged || approved.has(key)),
      )
      .map(([key, value]) => [key, safeValue(value)]),
  );
}
function mapTitle(
  properties: Record<string, unknown>,
  config: DatasetMapConfig,
  name: string,
  id: string,
) {
  const value = config.titleField ? properties[config.titleField] : null;
  const title =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : value && typeof value === "object"
          ? JSON.stringify(value)
          : "";
  return title.trim() ? title : `${name} · ${id}`;
}
function pageSize(query: DatasetMapFeaturesQueryDto) {
  const size = Number(query.pageSize ?? 100);
  if (!Number.isInteger(size) || size < 1 || size > 200)
    throw new BadRequestException("pageSize deve estar entre 1 e 200");
  return size;
}
function parseBbox(raw?: string) {
  if (!raw) return null;
  const values = raw.split(",").map(Number);
  if (
    values.length !== 4 ||
    !values.every(Number.isFinite) ||
    values[0] < -180 ||
    values[0] > 180 ||
    values[2] < -180 ||
    values[2] > 180 ||
    values[1] < -90 ||
    values[1] > 90 ||
    values[3] < -90 ||
    values[3] > 90 ||
    values[0] === values[2] ||
    values[1] >= values[3]
  )
    throw new BadRequestException("bbox deve ser oeste,sul,leste,norte em longitude/latitude");
  return values;
}
function validateZoom(z: number) {
  if (!Number.isInteger(z) || z < 0 || z > 22)
    throw new BadRequestException("Zoom deve estar entre 0 e 22");
}
export function clusterCellSize(z: number) {
  return (WORLD * CLUSTER_CELL_PIXELS) / (MAP_TILE_PIXELS * 2 ** z);
}

type ReadableDataset = {
  id: string;
  nome: string;
  mapConfig?: unknown;
  createdById?: string | null;
  status?: string;
};
/** Access is checked by DatasetsService before constructing this helper. No route may bypass it. */
export class DatasetMap {
  constructor(
    private prisma: PrismaService,
    private dataset: ReadableDataset,
    private user?: AuthUser,
  ) {}
  private privileged() {
    return (
      isDatasetReviewer(this.user) ||
      Boolean(this.user && this.user.id === this.dataset.createdById)
    );
  }
  private config() {
    return readMapConfig(this.dataset.mapConfig);
  }
  private props(raw: unknown) {
    return filterMapProperties(raw, this.config(), this.privileged());
  }
  private canConfigure() {
    return (
      isDatasetReviewer(this.user) ||
      Boolean(
        this.user &&
        this.user.id === this.dataset.createdById &&
        hasPermission(this.user.role, "dataset:write"),
      )
    );
  }

  private async schema() {
    return this.prisma.$queryRaw<{ name: string; type: string }[]>`
      SELECT key as name, CASE WHEN count(DISTINCT jsonb_typeof(value)) > 1 THEN 'mixed' ELSE min(jsonb_typeof(value)) END as type
      FROM features f CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(f.properties) = 'object' THEN f.properties ELSE '{}'::jsonb END)
      WHERE f."datasetId" = ${this.dataset.id}
      GROUP BY key ORDER BY key
    `;
  }
  async metadata() {
    const config = this.config();
    const [schema, extents] = await Promise.all([
      this.schema(),
      this.prisma.$queryRaw<
        {
          west: number | null;
          south: number | null;
          east: number | null;
          north: number | null;
          types: string[] | null;
        }[]
      >`
        SELECT ST_XMin(ST_Extent(geom)) as west, ST_YMin(ST_Extent(geom)) as south,
          ST_XMax(ST_Extent(geom)) as east, ST_YMax(ST_Extent(geom)) as north,
          array_agg(DISTINCT GeometryType(geom)) as types
        FROM features WHERE "datasetId" = ${this.dataset.id} AND NOT ST_IsEmpty(geom)
      `,
    ]);
    const allowedSchema = schema.filter(
      (f) => safeMapField(f.name) && (this.privileged() || config.publicFields.includes(f.name)),
    );
    const allowed = new Set(allowedSchema.map((f) => f.name));
    const extent = extents[0];
    return {
      datasetId: this.dataset.id,
      name: this.dataset.nome,
      bounds: extent?.west != null ? [extent.west, extent.south, extent.east, extent.north] : null,
      geometryTypes: extent?.types ?? [],
      fields: allowedSchema.map((f) => ({
        ...f,
        label: config.labels[f.name] ?? readableMapLabel(f.name),
      })),
      config: {
        ...config,
        titleField: config.titleField && allowed.has(config.titleField) ? config.titleField : null,
        visibleFields: config.visibleFields?.filter((f) => allowed.has(f)) ?? null,
        labels: Object.fromEntries(Object.entries(config.labels).filter(([k]) => allowed.has(k))),
        publicFields: config.publicFields.filter((f) => allowed.has(f)),
      },
      canConfigure: this.canConfigure(),
      canApproveFields: isDatasetReviewer(this.user),
    };
  }
  async configure(patch: DatasetMapConfigDto) {
    if (!this.canConfigure())
      throw new ForbiddenException("Somente o autor ou a verificação pode configurar a camada");
    if (patch.publicFields !== undefined && !isDatasetReviewer(this.user))
      throw new ForbiddenException("Somente a verificação pode aprovar atributos públicos");
    const previous = this.config();
    const supplied = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<DatasetMapConfig>;
    const merged = { ...previous, ...supplied };
    const fields = new Set((await this.schema()).map((f) => f.name).filter(safeMapField));
    const selected = [
      ...(merged.visibleFields ?? []),
      ...merged.publicFields,
      ...(merged.titleField ? [merged.titleField] : []),
      ...Object.keys(merged.labels ?? {}),
    ];
    if (selected.some((key) => !fields.has(key)))
      throw new BadRequestException("A configuração contém campo inexistente, interno ou sensível");
    if (
      merged.titleField &&
      merged.visibleFields &&
      !merged.visibleFields.includes(merged.titleField)
    )
      throw new BadRequestException("O campo de título precisa estar visível");
    if (
      Object.values(merged.labels).some(
        (value) => typeof value !== "string" || value.length > 120 || !value.trim(),
      )
    )
      throw new BadRequestException("Rótulos devem conter entre 1 e 120 caracteres");
    if (Object.keys(merged.labels).length > 200)
      throw new BadRequestException("Máximo de 200 rótulos");
    // Apply only keys supplied in this PATCH, atomically against the current JSONB.
    // In particular, an author's stale snapshot must never restore publicFields
    // after a reviewer has revoked them while this request was in flight.
    const config = readMapConfig(merged);
    const changes: Partial<DatasetMapConfig> = {};
    for (const key of ["titleField", "visibleFields", "labels", "publicFields", "color"] as const) {
      if (patch[key] !== undefined) Object.assign(changes, { [key]: config[key] });
    }
    const updated = await this.prisma.$queryRaw<{ mapConfig: unknown }[]>`
      UPDATE datasets
      SET "mapConfig" = COALESCE("mapConfig", '{}'::jsonb) || ${JSON.stringify(changes)}::jsonb,
          "updatedAt" = now()
      WHERE id = ${this.dataset.id}
      RETURNING "mapConfig"
    `;
    if (!updated[0]) throw new NotFoundException("Dataset não encontrado");
    this.dataset.mapConfig = updated[0].mapConfig;
    return this.metadata();
  }
  async detail(featureId: string) {
    const rows = await this.prisma.$queryRaw<
      { id: string; properties: unknown; geometryType: string }[]
    >`
      SELECT id, properties, GeometryType(geom) as "geometryType" FROM features
      WHERE "datasetId" = ${this.dataset.id} AND id = ${featureId}
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException("Feição não encontrada");
    const config = this.config();
    const properties = this.props(row.properties);
    return {
      id: row.id,
      datasetId: this.dataset.id,
      layerName: this.dataset.nome,
      geometryType: row.geometryType,
      title: mapTitle(properties, config, this.dataset.nome, row.id),
      properties,
      labels: Object.fromEntries(
        Object.keys(properties).map((key) => [key, config.labels[key] ?? readableMapLabel(key)]),
      ),
    };
  }
  async features(query: DatasetMapFeaturesQueryDto) {
    const limit = pageSize(query);
    const bbox = parseBbox(query.bbox);
    const envelopeFilter = (west: number, south: number, east: number, north: number) =>
      Prisma.sql`(geom && ST_MakeEnvelope(${west},${south},${east},${north},4326) AND ST_Intersects(geom,ST_MakeEnvelope(${west},${south},${east},${north},4326)))`;
    const area = !bbox
      ? Prisma.empty
      : bbox[0] < bbox[2]
        ? Prisma.sql`AND ${envelopeFilter(bbox[0], bbox[1], bbox[2], bbox[3])}`
        : Prisma.sql`AND (${envelopeFilter(bbox[0], bbox[1], 180, bbox[3])} OR ${envelopeFilter(-180, bbox[1], bbox[2], bbox[3])})`;
    const cursor = query.cursor ? Prisma.sql`AND id > ${query.cursor}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { id: string; properties: unknown; geometry: string }[]
    >(Prisma.sql`
      SELECT id, properties, ST_AsGeoJSON(geom,15) as geometry FROM features
      WHERE "datasetId" = ${this.dataset.id} AND NOT ST_IsEmpty(geom) ${area} ${cursor}
      ORDER BY id LIMIT ${limit + 1}
    `);
    const more = rows.length > limit;
    const selected = rows.slice(0, limit);
    return {
      type: "FeatureCollection",
      datasetId: this.dataset.id,
      features: selected.map((row) => ({
        type: "Feature",
        id: row.id,
        datasetId: this.dataset.id,
        geometry: JSON.parse(row.geometry) as unknown,
        properties: this.props(row.properties),
      })),
      nextCursor: more ? selected[selected.length - 1].id : null,
    };
  }
  async clusterMembers(query: DatasetClusterQueryDto) {
    validateZoom(query.z);
    const cells = (MAP_TILE_PIXELS / CLUSTER_CELL_PIXELS) * 2 ** query.z;
    if (![query.cellX, query.cellY].every((n) => Number.isInteger(n) && n >= 0 && n < cells))
      throw new BadRequestException("Célula inválida");
    const size = clusterCellSize(query.z);
    const xmin = -HALF + query.cellX * size,
      xmax = xmin + size;
    const ymax = HALF - query.cellY * size,
      ymin = ymax - size;
    const limit = pageSize(query);
    const cursor = query.cursor ? Prisma.sql`AND f.id > ${query.cursor}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ id: string; properties: unknown }[]>(Prisma.sql`
      SELECT f.id, f.properties FROM features f
      WHERE f."datasetId" = ${this.dataset.id}
        AND GeometryType(f.geom) IN ('POINT','MULTIPOINT')
        AND f.geom && ST_Transform(ST_MakeEnvelope(${xmin},${ymin},${xmax},${ymax},3857),4326)
        ${cursor}
        AND EXISTS (SELECT 1 FROM ST_DumpPoints(ST_Transform(ST_Force2D(f.geom),3857)) p
          WHERE floor((ST_X(p.geom)+${HALF})/${size}) = ${query.cellX}
          AND floor((${HALF}-ST_Y(p.geom))/${size}) = ${query.cellY})
      ORDER BY f.id LIMIT ${limit + 1}
    `);
    const selected = rows.slice(0, limit),
      config = this.config();
    return {
      features: selected.map((row) => ({
        id: row.id,
        datasetId: this.dataset.id,
        title: mapTitle(this.props(row.properties), config, this.dataset.nome, row.id),
      })),
      nextCursor: rows.length > limit ? selected[selected.length - 1].id : null,
    };
  }
  async tile(z: number, x: number, y: number) {
    validateZoom(z);
    if (![x, y].every((n) => Number.isInteger(n) && n >= 0 && n < 2 ** z))
      throw new BadRequestException("Coordenadas de tile inválidas");
    const size = clusterCellSize(z);
    const rows = await this.prisma.$queryRaw<{ tile: Uint8Array }[]>`
      WITH bounds AS (SELECT ST_TileEnvelope(${z},${x},${y}) AS box),
      candidates AS MATERIALIZED (
        SELECT id, geom FROM features, bounds
        WHERE "datasetId" = ${this.dataset.id} AND NOT ST_IsEmpty(geom)
        AND geom && ST_Transform(ST_Expand(box,${size / 8}),4326)
      ),
      points AS (
        SELECT id, p.geom, floor((ST_X(p.geom)+${HALF})/${size})::bigint AS cx,
          floor((${HALF}-ST_Y(p.geom))/${size})::bigint AS cy
        FROM candidates c CROSS JOIN LATERAL ST_DumpPoints(ST_Transform(ST_Force2D(c.geom),3857)) p
        WHERE GeometryType(c.geom) IN ('POINT','MULTIPOINT')
      ),
      groups AS (
        SELECT min(id) AS id, cx, cy, count(DISTINCT id)::integer AS n, count(*)::integer AS parts,
          ST_SetSRID(ST_MakePoint(avg(ST_X(geom)),avg(ST_Y(geom))),3857) AS geom
        FROM points GROUP BY cx,cy
      ),
      tile_rows AS (
        SELECT ${this.dataset.id}::text AS "datasetId", CASE WHEN n=1 THEN id ELSE NULL END AS "featureId",
          (parts>1) AS cluster, n AS point_count, cx AS "clusterCellX", cy AS "clusterCellY", ${z}::integer AS z,
          ST_AsMVTGeom(g.geom,b.box,4096,64,true) AS geom
        FROM groups g CROSS JOIN bounds b
        WHERE cx >= ${x * 8} AND cx < ${(x + 1) * 8} AND cy >= ${y * 8} AND cy < ${(y + 1) * 8}
        UNION ALL
        SELECT ${this.dataset.id}::text AS "datasetId", id AS "featureId", false AS cluster,
          1::integer AS point_count, NULL::bigint AS "clusterCellX",NULL::bigint AS "clusterCellY",${z}::integer AS z,
          ST_AsMVTGeom(ST_Transform(ST_Force2D(c.geom),3857),b.box,4096,64,true) AS geom
        FROM candidates c CROSS JOIN bounds b WHERE GeometryType(c.geom) NOT IN ('POINT','MULTIPOINT')
      )
      SELECT ST_AsMVT(tile_rows,'features',4096,'geom') AS tile FROM tile_rows WHERE geom IS NOT NULL
    `;
    return Buffer.from(rows[0]?.tile ?? []);
  }
}
