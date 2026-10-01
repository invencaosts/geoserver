// Tipos compartilhados entre apps/api e apps/web

// Do maior para o menor nível de acesso. "visualizador" é também o papel de quem
// navega sem login e o papel inicial de toda conta nova.
export const ROLES = [
  "admin",
  "verificador",
  "pesquisador_envio_download",
  "pesquisador_envio",
  "visualizador",
] as const;

export type RoleName = (typeof ROLES)[number];

export const ROLE_LABEL: Record<RoleName, string> = {
  admin: "Administrador",
  verificador: "Verificador",
  pesquisador_envio_download: "Pesquisador (envio e download)",
  pesquisador_envio: "Pesquisador (envio de dados)",
  visualizador: "Visualizador",
};

export const ROLE_DESCRIPTION: Record<RoleName, string> = {
  admin: "Acesso total, incluindo gestão de usuários e camadas",
  verificador: "Valida casos, gerencia a Linha do Tempo e define os pesquisadores",
  pesquisador_envio_download: "Envia casos e datasets e baixa dados e relatórios",
  pesquisador_envio: "Envia casos e datasets, sem baixar dados",
  visualizador: "Só visualiza o site",
};

// Papéis que o verificador pode atribuir; o admin atribui qualquer um.
export const RESEARCHER_ASSIGNABLE_ROLES: RoleName[] = [
  "pesquisador_envio_download",
  "pesquisador_envio",
  "visualizador",
];

export const PERMISSIONS = [
  "layer:read",
  "layer:write",
  "layer:delete",
  "dataset:read",
  "dataset:write",
  "dataset:delete",
  "data:export",
  "case:read",
  "case:create",
  "case:validate",
  "user:read",
  "user:assign_researcher",
  "user:manage",
  "timeline:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEW_PERMISSIONS: Permission[] = ["layer:read", "dataset:read", "case:read"];
const SEND_PERMISSIONS: Permission[] = ["case:create", "dataset:write"];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  admin: [...PERMISSIONS],
  verificador: [
    ...VIEW_PERMISSIONS,
    ...SEND_PERMISSIONS,
    "data:export",
    "case:validate",
    "timeline:manage",
    "user:read",
    "user:assign_researcher",
  ],
  pesquisador_envio_download: [...VIEW_PERMISSIONS, ...SEND_PERMISSIONS, "data:export"],
  pesquisador_envio: [...VIEW_PERMISSIONS, ...SEND_PERMISSIONS],
  visualizador: [...VIEW_PERMISSIONS],
};

// Quem navega sem login tem as permissões do visualizador.
export const ANONYMOUS_ROLE: RoleName = "visualizador";

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: RoleName;
  status: "ativo" | "inativo";
  avatarUrl?: string | null;
}

export interface UserDTO extends AuthUser {
  cpf?: string | null;
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
  createdBy?: CasePersonDTO;
}

export interface CaseStatusHistoryDTO {
  id: string;
  caseId: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  changedById: string;
  note?: string | null;
  createdAt: string;
  changedBy?: CasePersonDTO;
}

export interface CasePersonDTO {
  id: string;
  nome: string;
}

export interface CaseDetailDTO extends CaseDTO {
  createdBy: CasePersonDTO;
  statusHistory: CaseStatusHistoryDTO[];
}

export interface PaginatedCasesDTO {
  items: CaseDTO[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type CaseMapPointDTO = Pick<
  CaseDTO,
  "id" | "nome" | "tipo" | "prioridade" | "status" | "lat" | "lng"
>;

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

// Mesma checagem, tratando ausência de usuário como visitante anônimo.
export function userHasPermission(
  user: { role: RoleName } | null | undefined,
  permission: Permission,
): boolean {
  return hasPermission(user?.role ?? ANONYMOUS_ROLE, permission);
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
