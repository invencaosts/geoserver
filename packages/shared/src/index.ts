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
  "timeline:manage",
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
    "timeline:manage",
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

export type RoleApprovalStatus = "pendente" | "aprovado" | "rejeitado";

export type PerfilContribuidor =
  | "pesquisador"
  | "militante_movimento_social"
  | "partido_politico"
  | "servidor_publico"
  | "lideranca_comunitaria"
  | "movimento_social_organizado"
  | "conselhos_ongs";

export const PERFIL_CONTRIBUIDOR_LABEL: Record<PerfilContribuidor, string> = {
  pesquisador: "Pesquisador",
  militante_movimento_social: "Militante de movimento social",
  partido_politico: "Partido político",
  servidor_publico: "Servidor público",
  lideranca_comunitaria: "Liderança comunitária",
  movimento_social_organizado: "Movimento social organizado",
  conselhos_ongs: "Conselhos e ONGs",
};

export interface UserDTO extends AuthUser {
  cpf?: string | null;
  requestedRole: RoleName;
  roleApprovalStatus: RoleApprovalStatus;
  perfilContribuidor?: PerfilContribuidor | null;
  localidade?: string | null;
  nomeSocial?: string | null;
  quemRepresenta?: string | null;
  telefone?: string | null;
  instituicao?: string | null;
  endereco?: string | null;
  idiomas: string[];
  areasInteresse: CaseTipo[];
  createdAt: string;
  updatedAt: string;
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

export type DatasetFormat = "Shapefile" | "GeoJSON" | "KML" | "KMZ" | "CSV" | "PDF";
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

export type CaseTipo = "institucional" | "titulo_falso" | "car";

export const CASE_TIPO_LABEL: Record<CaseTipo, string> = {
  institucional: "Grilagem Institucional",
  titulo_falso: "Grilagem por Título Falso",
  car: "Grilagem por CAR",
};

export type CasePrioridade = "baixa" | "media" | "alta" | "critica";

export type CaseStatus = "pendente" | "em_verificacao" | "validado" | "rejeitado";

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
  anexoUrl?: string | null;
  anexoNome?: string | null;
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

export type NotificationTipo =
  "contribuicao_aceita" | "contribuicao_retorno" | "novo_caso_area_interesse";

export const NOTIFICATION_TIPO_LABEL: Record<NotificationTipo, string> = {
  contribuicao_aceita: "Contribuição aceita",
  contribuicao_retorno: "Retorno sobre contribuição",
  novo_caso_area_interesse: "Novidade na sua área de interesse",
};

export interface NotificationDTO {
  id: string;
  tipo: NotificationTipo;
  titulo: string;
  mensagem: string;
  lida: boolean;
  caseId?: string | null;
  createdAt: string;
}

export type InstituicaoTipo = "educacao_basica" | "educacao_superior";

export interface InstituicaoDTO {
  nome: string;
  municipio: string;
  uf: string;
  tipo: InstituicaoTipo;
  dependencia?: string | null;
}

export function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export type TimelineEscopo = "nacional" | "estadual";

export interface TimelineDate {
  year: number;
  month?: number;
  day?: number;
}

export interface TimelineJsMedia {
  url?: string;
  credit?: string;
  caption?: string;
  thumbnail?: string;
}

export interface TimelineJsEvent {
  unique_id: string;
  start_date: TimelineDate;
  end_date?: TimelineDate;
  display_date?: string;
  text: { headline: string; text: string };
  media?: TimelineJsMedia;
  group?: string;
  background?: { url?: string };
}

export interface TimelineJsonDTO {
  title?: {
    text: { headline: string; text: string };
    media?: TimelineJsMedia;
  };
  events: TimelineJsEvent[];
}

export interface TimelineEventDTO {
  id: string;
  escopo: TimelineEscopo;
  estado?: string | null;
  startYear: number;
  startMonth?: number | null;
  startDay?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  endDay?: number | null;
  displayDate?: string | null;
  headline: string;
  text: string;
  mediaUrl?: string | null;
  mediaCredit?: string | null;
  mediaCaption?: string | null;
  mediaThumb?: string | null;
  type?: string | null;
  background?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}
