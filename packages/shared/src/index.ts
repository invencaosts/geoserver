// Tipos compartilhados entre apps/api e apps/web

export type RoleName = "admin" | "verificador" | "contribuidor" | "leitor";

export const PERMISSIONS = [
  "layer:read",
  "layer:write",
  "layer:delete",
  "dataset:read",
  "dataset:write",
  "dataset:delete",
  "case:read",
  "case:create",
  "case:validate",
  "user:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  admin: [...PERMISSIONS],
  verificador: [
    "layer:read",
    "dataset:read",
    "dataset:write",
    "case:read",
    "case:create",
    "case:validate",
  ],
  contribuidor: ["layer:read", "dataset:read", "case:read", "case:create"],
  leitor: ["layer:read", "dataset:read", "case:read"],
};

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: RoleName;
  status: "ativo" | "inativo";
  avatarUrl?: string | null;
}

export type LayerType = "WMS" | "WFS" | "WCS" | "Vector" | "Raster";
export type LayerCategory = "base" | "overlay" | "analysis";

export interface LayerDTO {
  id: string;
  nome: string;
  tipo: LayerType;
  categoria: LayerCategory;
  url?: string | null;
  fonte: string;
  descricao?: string | null;
  projecao: string;
  visivel: boolean;
  opacidade: number;
  tileSourceId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DatasetFormat = "Shapefile" | "GeoJSON" | "KML" | "CSV";
export type DatasetGeomType = "Point" | "Polygon" | "Line";
export type DatasetStatus = "processing" | "active" | "error";

export interface DatasetDTO {
  id: string;
  nome: string;
  formato: DatasetFormat;
  tipoGeometria: DatasetGeomType;
  status: DatasetStatus;
  registros: number;
  projecaoOriginal?: string | null;
  erro?: string | null;
  createdAt: string;
}

export type CaseTipo =
  | "invasao_propriedade"
  | "ocupacao_irregular"
  | "desmatamento_ilegal"
  | "conflito_agrario";

export type CasePrioridade = "baixa" | "media" | "alta" | "critica";

export type CaseStatus =
  | "pendente"
  | "em_verificacao"
  | "validado"
  | "rejeitado";

export interface CaseDTO {
  id: string;
  nome: string;
  tipo: CaseTipo;
  municipio: string;
  estado: string;
  descricao?: string | null;
  lat?: number | null;
  lng?: number | null;
  fonteDados?: string | null;
  denunciante?: string | null;
  prioridade: CasePrioridade;
  status: CaseStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseStatusHistoryDTO {
  id: string;
  caseId: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  changedById: string;
  note?: string | null;
  createdAt: string;
}

export function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
