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
  "dataset:read_restricted",
  "data:export",
  "case:read",
  "case:read_restricted",
  "case:create",
  "case:validate",
  "document:download_restricted",
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
    "case:read_restricted",
    "dataset:read_restricted",
    "document:download_restricted",
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
  onboardingProfile?: UserOnboardingProfileDTO | null;
  researcherProfile?: ResearcherProfileDTO | null;
}

export interface UserSummaryDTO extends Omit<AuthUser, "email"> {
  createdAt: string;
  updatedAt: string;
  researcherProfileComplete: boolean;
}

export const CASE_DECLARATION_VERSION = "2026-10-01";
export const CASE_FORM_SCHEMA_VERSION = "formulario-2026-10-v1";
export const LEGACY_VALIDATED_CASE_SCHEMA_VERSION = "legado-validado-pre-formulario-v1";
export const CASE_DECLARATION_TEXT =
  "Declaro que as informações e os documentos enviados são verdadeiros segundo meu conhecimento, que possuo autorização para compartilhá-los e que indiquei corretamente eventuais restrições de divulgação e dados pessoais.";

export interface UserOnboardingProfileDTO {
  municipio?: string | null;
  estado?: string | null;
  escolaridade?: string | null;
  perfilUsuario?: string | null;
  perfilUsuarioOutro?: string | null;
  possuiVinculo?: boolean | null;
  instituicaoCnpj?: string | null;
  instituicaoNome?: string | null;
  instituicaoEmail?: string | null;
  tipoVinculo?: string | null;
  tipoVinculoOutro?: string | null;
  comoConheceu?: string | null;
  comoConheceuOutro?: string | null;
  finalidadeAcesso?: string | null;
  finalidadeAcessoOutro?: string | null;
}

export interface ResearcherProfileLinkDTO {
  id?: string;
  tipo: "lattes" | "orcid" | "institucional" | "pagina_profissional" | "outro";
  url: string;
}

export interface ResearcherProfileDTO {
  emailProfissional?: string | null;
  telefoneWhatsapp?: string | null;
  instituicaoNome?: string | null;
  instituicaoCnpj?: string | null;
  instituicaoEmail?: string | null;
  tipoVinculo?: string | null;
  cargoFuncao?: string | null;
  estadoAtuacao?: string | null;
  municipioAtuacao?: string | null;
  perfilProfissional?: string | null;
  nivelFormacao?: string | null;
  finalidadeUso?: string | null;
  completo?: boolean;
  links?: ResearcherProfileLinkDTO[];
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
  caseId?: string | null;
  createdById?: string | null;
  visibility: DataVisibility;
  codigoCar?: string | null;
  codigoSigef?: string | null;
  requestedPublic: boolean;
  publicationApprovedAt?: string | null;
  publicationApprovedById?: string | null;
  createdAt: string;
}

export type CaseTipo = "institucional" | "titulo_falso" | "car";

export const CASE_TIPO_LABEL: Record<CaseTipo, string> = {
  institucional: "Grilagem Institucional",
  titulo_falso: "Grilagem por Título Falso",
  car: "Grilagem por CAR",
};

export type CasePrioridade = "baixa" | "media" | "alta" | "critica";

export type CaseStatus = "rascunho" | "pendente" | "em_verificacao" | "validado" | "rejeitado";

export type DataVisibility = "publico" | "restrito";

export interface CaseContributionDTO {
  relacaoPesquisador?: string | null;
  participouProducao?: boolean | null;
  participouValidacao?: boolean | null;
  responsavelValidacao?: string | null;
  instrumentoCentral?: string | null;
  objetoEspolio?: string | null;
  instituicaoPromotora?: string | null;
  grauPublicidadeInformacoes?: string | null;
  possuiRestricaoDivulgacao?: boolean | null;
  restricaoDivulgacao?: string | null;
  periodoInicio?: number | null;
  periodoFim?: number | null;
  situacaoCancelamento?: string | null;
  orgaoCancelamento?: string | null;
  retornouPatrimonioPublico?: boolean | null;
  destinacaoPosterior?: string | null;
  situacaoAtualImovel?: string | null;
  conflitos?: string | null;
  sujeitosSociais?: string | null;
  escalaEspacial?: string | null;
}

export interface CaseSourceDTO {
  id?: string;
  titulo: string;
  tipo?: string | null;
  referencia?: string | null;
  grauPublicidade?: string | null;
}

export interface CaseDocumentDTO {
  id: string;
  sourceId?: string | null;
  nome: string;
  mimeType: string;
  tamanho: number;
  visibility: DataVisibility;
  requestedPublic: boolean;
  publicationApprovedAt?: string | null;
  publicationApprovedById?: string | null;
  possuiDadosPessoais: boolean;
  motivoRestricao?: string | null;
  downloadUrl?: string;
  createdAt: string;
}

export interface CaseFacetSelectionDTO {
  optionId: string;
  categoria?: string;
  codigo?: string;
  label?: string;
  valorOutro?: string | null;
}

export interface CaseSpatialReferenceDTO {
  id?: string;
  tipo:
    | "coordenadas_geograficas"
    | "utm"
    | "car"
    | "sigef"
    | "shapefile"
    | "kml_kmz"
    | "mapa"
    | "outra";
  valor: string;
  descricao?: string | null;
}

export interface FormOptionDTO {
  id: string;
  categoria: string;
  codigo: string;
  label: string;
  descricao?: string | null;
  ordem: number;
}

export interface CaseDTO {
  id: string;
  nome: string;
  tipo: CaseTipo;
  municipio?: string;
  estado: string;
  descricao?: string | null;
  lat?: number | null;
  lng?: number | null;
  fonteDados?: string | null;
  denunciante?: string | null;
  prioridade: CasePrioridade;
  status: CaseStatus;
  declarationAccepted?: boolean;
  declarationVersion?: string | null;
  declarationText?: string | null;
  declarationHash?: string | null;
  declarationContentHash?: string | null;
  declarationAcceptedRevision?: number | null;
  declarationAcceptedAt?: string | null;
  declarationAcceptedById?: string | null;
  /** Ausente em registros anteriores ao formulário detalhado ou gravados por um pod antigo. */
  formSchemaVersion?: string | null;
  /** Indica ao autor/revisor que o formulário atual precisa ser concluído antes da validação. */
  requiresFormCompletion?: boolean;
  submittedAt?: string | null;
  revision: number;
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
  contribution?: CaseContributionDTO | null;
  sources: CaseSourceDTO[];
  documents: CaseDocumentDTO[];
  facets: CaseFacetSelectionDTO[];
  spatialReferences: CaseSpatialReferenceDTO[];
  datasets: DatasetDTO[];
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
