"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  MapPin,
  Paperclip,
  Plus,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import type { CaseDTO, CasePrioridade, CaseStatus, CaseTipo } from "@geo/shared";
import {
  CASE_DECLARATION_TEXT,
  CASE_DECLARATION_VERSION,
  CASE_TIPO_LABEL as TIPO_LABEL,
  userHasPermission,
} from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectFormField, TextAreaField, TextField } from "@/components/ui/form-fields";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select-field";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCase,
  useCaseDashboard,
  useCases,
  useCreateCase,
  useCaseOptions,
  useDownloadCaseDocument,
  useReviewDocumentPublication,
  useUpdateCase,
  useUpdateCaseStatus,
  useUploadCaseAnexo,
} from "@/lib/queries/cases";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { BRAZIL_UFS } from "@/lib/brazil-ufs";
import { toast } from "sonner";

const STATUS_LABEL: Record<CaseStatus, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente",
  em_verificacao: "Em verificação",
  validado: "Validado",
  rejeitado: "Rejeitado",
};

const NEXT_STATUS: Record<CaseStatus, CaseStatus[]> = {
  rascunho: [],
  pendente: ["em_verificacao", "rejeitado"],
  em_verificacao: ["validado", "rejeitado", "pendente"],
  validado: ["pendente"],
  rejeitado: [],
};

const PRIORIDADE_LABEL: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const FORM_CATEGORY_LABEL: Record<string, string> = {
  relacao_pesquisador: "Relação com o caso",
  participacao_producao: "Participação na produção/validação",
  instrumento_central: "Instrumento central",
  fonte_documento: "Fontes e documentos comprobatórios",
  publicidade_documentos: "Publicidade dos documentos",
  mecanismo_grilagem: "Mecanismos de grilagem",
  objeto_espolio: "Objeto do espólio",
  grau_publicidade: "Grau de publicidade",
  periodo_ocorrencia: "Período de ocorrência/análise",
  cancelamento_titulos: "Cancelamento de títulos",
  retorno_patrimonio: "Retorno ao patrimônio público",
  destinacao_terras: "Destinação posterior das terras",
  situacao_imovel: "Situação atual do imóvel/área",
  sujeitos_sociais: "Conflitos e sujeitos sociais",
  escala_caso: "Escala do caso",
  localizacao: "Formas de localização",
};

const MULTI_SELECT_FORM_CATEGORIES = new Set([
  "fonte_documento",
  "mecanismo_grilagem",
  "objeto_espolio",
  "sujeitos_sociais",
  "localizacao",
]);

export default function CasosPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "todos">("todos");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const { data: stats, isLoading: statsLoading } = useCaseDashboard();
  const {
    data: casesPage,
    isLoading: casesLoading,
    isFetching: casesFetching,
    isError: casesError,
    error: casesErrorValue,
    refetch: refetchCases,
  } = useCases({
    page,
    limit: 20,
    status: statusFilter === "todos" ? undefined : statusFilter,
  });
  const cases = casesPage?.items;
  const user = useAuthStore((s) => s.user);
  const canCreate = userHasPermission(user, "case:create");
  const canValidate = userHasPermission(user, "case:validate");

  useEffect(() => {
    if (!casesPage) return;
    const lastPage = Math.max(1, casesPage.totalPages);
    if (page > lastPage) {
      // Sincroniza o estado local quando uma validação remove o último item da página.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(lastPage);
    }
  }, [casesPage, page]);

  const maiorTipo = stats?.casosPorTipo.reduce((max, t) => (t.casos > max ? t.casos : max), 0) ?? 0;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Registro de casos · atualizado agora
        </p>
        <div className="flex items-end gap-2">
          <div className="min-w-44">
            <Label htmlFor="case-status-filter" className="sr-only">
              Filtrar casos por status
            </Label>
            <SelectField
              id="case-status-filter"
              value={statusFilter}
              onValueChange={(status) => {
                setStatusFilter(status);
                setPage(1);
              }}
              options={[
                { value: "todos", label: "Todos os status" },
                ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
                  value: value as CaseStatus,
                  label,
                })),
              ]}
              className="h-8 rounded-none text-xs"
            />
          </div>
          {canCreate && (
            <NewCaseDialog
              key={editingDraftId ?? "new-case"}
              draftId={editingDraftId}
              onDraftClosed={() => setEditingDraftId(null)}
            />
          )}
        </div>
      </div>

      {/* faixa de estatísticas — régua, sem blocos */}
      <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
        <StatCell
          label="Casos ativos"
          value={stats?.casosAtivos}
          loading={statsLoading}
          highlight
        />
        <StatCell label="Validados" value={stats?.casosValidados} loading={statsLoading} />
        <StatCell label="Rejeitados" value={stats?.casosRejeitados} loading={statsLoading} />
        <StatCell
          label="Pendentes de validação"
          value={stats?.validacoesPendentes}
          loading={statsLoading}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3">
        {/* tabela principal */}
        <div className="col-span-2 flex min-h-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="w-10 border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Caso
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Local
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Prioridade
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Anexo
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {casesLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="border-b border-border p-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}

                {!casesLoading && casesError && (
                  <tr>
                    <td colSpan={7} className="py-14 text-center">
                      <AlertCircle className="mx-auto mb-2 h-7 w-7 text-destructive/70" />
                      <p className="text-sm font-medium">Não foi possível carregar os casos.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {casesErrorValue instanceof Error
                          ? casesErrorValue.message
                          : "Tente novamente em instantes."}
                      </p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onClick={() => refetchCases()}
                      >
                        Tentar novamente
                      </Button>
                    </td>
                  </tr>
                )}

                {!casesLoading && !casesError && cases?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <ShieldAlert className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        {statusFilter === "todos"
                          ? "Nenhum caso registrado ainda."
                          : `Nenhum caso com status “${STATUS_LABEL[statusFilter]}”.`}
                      </p>
                    </td>
                  </tr>
                )}

                {!casesError &&
                  cases?.map((c, i) => (
                    <CaseRow
                      key={c.id}
                      index={(page - 1) * (casesPage?.limit ?? 20) + i + 1}
                      caseItem={c}
                      onView={() => setSelectedCaseId(c.id)}
                      canUpload={!!user && c.createdById === user.id && c.status === "rascunho"}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          {!casesLoading && !casesError && casesPage && casesPage.total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {casesFetching ? "Atualizando… " : ""}
                {casesPage.total} {casesPage.total === 1 ? "caso" : "casos"} · página{" "}
                {casesPage.page} de {casesPage.totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Ir para a página anterior"
                  disabled={page <= 1 || casesFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Ir para a próxima página"
                  disabled={page >= casesPage.totalPages || casesFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* coluna lateral — distribuição + ranking */}
        <div className="min-h-0 overflow-auto px-5 py-4">
          <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Distribuição por tipo
          </h2>
          <div className="mb-6 space-y-2.5">
            {statsLoading &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            {!statsLoading && stats?.casosPorTipo.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem casos ativos no momento.</p>
            )}
            {stats?.casosPorTipo.map((t) => (
              <div key={t.tipo} className="flex items-center gap-2 text-[11.5px]">
                <span className="w-[118px] shrink-0 text-muted-foreground">
                  {TIPO_LABEL[t.tipo as CaseTipo] ?? t.tipo}
                </span>
                <span className="h-[5px] flex-1 bg-muted">
                  <span
                    className="block h-full bg-gold"
                    style={{ width: `${maiorTipo ? (t.casos / maiorTipo) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-4 shrink-0 text-right font-semibold tabular">{t.casos}</span>
              </div>
            ))}
          </div>

          <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Municípios mais afetados
          </h2>
          <div className="space-y-0">
            {statsLoading &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            {!statsLoading && stats?.municipiosMaisAfetados.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
            )}
            {stats?.municipiosMaisAfetados.map((m, i) => (
              <div
                key={m.municipio}
                className="flex items-center justify-between border-b border-dotted border-border py-1.5 text-[12.5px]"
              >
                <span className="text-muted-foreground">
                  {i + 1} · {m.municipio}
                </span>
                <span className="font-semibold tabular">{m.casos}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CaseDetailsDialog
        caseId={selectedCaseId}
        canValidate={!!canValidate}
        onOpenChange={(open) => !open && setSelectedCaseId(null)}
        onEditDraft={(id) => {
          setSelectedCaseId(null);
          setEditingDraftId(id);
        }}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value?: number;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      {loading ? (
        <Skeleton className="h-7 w-10" />
      ) : (
        <p
          className={cn(
            "font-display text-[26px] font-bold leading-none tabular",
            highlight && "text-primary",
          )}
        >
          {value}
        </p>
      )}
      <p className="mt-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

const STAMP_TONE: Record<CaseStatus, string> = {
  rascunho: "text-muted-foreground",
  pendente: "text-primary",
  em_verificacao: "text-gold",
  validado: "text-moss",
  rejeitado: "text-destructive",
};

function CaseRow({
  index,
  caseItem,
  onView,
  canUpload,
}: {
  index: number;
  caseItem: CaseDTO;
  onView: () => void;
  canUpload: boolean;
}) {
  const uploadAnexo = useUploadCaseAnexo();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <tr className="group hover:bg-muted/60">
      <td className="border-b border-border px-3 py-3 font-display text-xs text-muted-foreground tabular">
        {String(index).padStart(2, "0")}
      </td>
      <td className="border-b border-border px-3 py-3">
        <button
          type="button"
          className="text-left text-[13px] font-semibold hover:text-primary hover:underline"
          onClick={onView}
        >
          {caseItem.nome}
        </button>
        <p className="text-[11px] text-muted-foreground">{TIPO_LABEL[caseItem.tipo as CaseTipo]}</p>
      </td>
      <td className="border-b border-border px-3 py-3 text-[12.5px] text-muted-foreground">
        {caseItem.municipio ? `${caseItem.municipio}/${caseItem.estado}` : "Localização restrita"}
      </td>
      <td className="border-b border-border px-3 py-3 text-[12.5px] text-muted-foreground">
        {PRIORIDADE_LABEL[caseItem.prioridade]}
      </td>
      <td className="border-b border-border px-3 py-3">
        <span
          className={cn(
            "border-y border-current py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
            STAMP_TONE[caseItem.status as CaseStatus],
          )}
        >
          {STATUS_LABEL[caseItem.status as CaseStatus]}
        </span>
      </td>
      <td className="border-b border-border px-3 py-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.kmz"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadAnexo.mutate(
                { id: caseItem.id, file },
                {
                  onSuccess: () => toast.success("Anexo enviado"),
                  onError: (uploadError) =>
                    toast.error(
                      uploadError instanceof Error ? uploadError.message : "Falha ao enviar anexo",
                    ),
                },
              );
            }
            e.target.value = "";
          }}
        />
        {caseItem.anexoUrl ? (
          <a
            href={caseItem.anexoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11.5px] text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[120px] truncate">{caseItem.anexoNome ?? "anexo"}</span>
          </a>
        ) : canUpload ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11.5px] text-muted-foreground"
            disabled={uploadAnexo.isPending}
            onClick={(event) => {
              event.stopPropagation();
              fileRef.current?.click();
            }}
          >
            <Paperclip className="h-3.5 w-3.5" />
            anexar
          </Button>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">Sem anexo</span>
        )}
      </td>
      <td className="border-b border-border px-3 py-3 text-right">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onView}>
          <Eye />
          Ver detalhes
        </Button>
      </td>
    </tr>
  );
}

interface CaseFormState {
  nome: string;
  tipo: CaseTipo;
  municipio: string;
  estado: string;
  descricao: string;
  lat: string;
  lng: string;
  fonteDados: string;
  denunciante: string;
  prioridade: CasePrioridade;
  relacaoPesquisador: string;
  participouProducao: boolean;
  participouValidacao: boolean;
  responsavelValidacao: string;
  instrumentoCentral: string;
  fonteId?: string;
  fonteTitulo: string;
  fonteReferencia: string;
  grauPublicidadeFonte: string;
  facetIds: string[];
  facetOtherValues: Record<string, string>;
  objetoEspolio: string;
  instituicaoPromotora: string;
  possuiRestricaoDivulgacao: boolean | null;
  restricaoDivulgacao: string;
  periodoInicio: string;
  periodoFim: string;
  situacaoCancelamento: string;
  orgaoCancelamento: string;
  destinacaoPosterior: string;
  situacaoAtualImovel: string;
  conflitos: string;
  sujeitosSociais: string;
  escalaEspacial: string;
  referenciaEspacialTipo: string;
  referenciaEspacialId?: string;
  referenciaEspacialValor: string;
  declarationAccepted: boolean;
}

function createEmptyCaseForm(): CaseFormState {
  return {
    nome: "",
    tipo: "institucional",
    municipio: "",
    estado: "",
    descricao: "",
    lat: "",
    lng: "",
    fonteDados: "",
    denunciante: "",
    prioridade: "media",
    relacaoPesquisador: "",
    participouProducao: false,
    participouValidacao: false,
    responsavelValidacao: "",
    instrumentoCentral: "",
    fonteId: undefined,
    fonteTitulo: "",
    fonteReferencia: "",
    grauPublicidadeFonte: "restrito",
    facetIds: [],
    facetOtherValues: {},
    objetoEspolio: "",
    instituicaoPromotora: "",
    possuiRestricaoDivulgacao: null,
    restricaoDivulgacao: "",
    periodoInicio: "",
    periodoFim: "",
    situacaoCancelamento: "",
    orgaoCancelamento: "",
    destinacaoPosterior: "",
    situacaoAtualImovel: "",
    conflitos: "",
    sujeitosSociais: "",
    escalaEspacial: "municipal",
    referenciaEspacialTipo: "coordenadas_geograficas",
    referenciaEspacialId: undefined,
    referenciaEspacialValor: "",
    declarationAccepted: false,
  };
}

type CaseFormErrors = Partial<Record<keyof CaseFormState, string>>;

function validateCaseForm(form: CaseFormState): CaseFormErrors {
  const errors: CaseFormErrors = {};

  if (!form.nome.trim()) {
    errors.nome = "Informe o nome do caso";
  } else if (form.nome.trim().length < 3) {
    errors.nome = "Nome muito curto (mínimo 3 caracteres)";
  }
  if (!form.municipio.trim()) {
    errors.municipio = "Informe o município";
  }
  if (!form.estado.trim()) {
    errors.estado = "Informe a UF";
  } else if (!BRAZIL_UFS.some((uf) => uf.sigla === form.estado.trim().toUpperCase())) {
    errors.estado = "Selecione uma UF válida";
  }
  if (form.lat.trim()) {
    const lat = Number(form.lat);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.lat = "Latitude inválida (entre -90 e 90)";
    }
  }
  if (form.lng.trim()) {
    const lng = Number(form.lng);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      errors.lng = "Longitude inválida (entre -180 e 180)";
    }
  }
  if (!form.fonteTitulo.trim()) errors.fonteTitulo = "Informe ao menos uma fonte";
  if (typeof form.possuiRestricaoDivulgacao !== "boolean") {
    errors.possuiRestricaoDivulgacao = "Responda se existem restrições de divulgação";
  }
  if (!form.declarationAccepted) {
    errors.declarationAccepted = "Aceite a declaração de responsabilidade";
  }

  return errors;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-[13px]">{children || "Não informado"}</dd>
    </div>
  );
}

function CaseDetailsDialog({
  caseId,
  canValidate,
  onOpenChange,
  onEditDraft,
}: {
  caseId: string | null;
  canValidate: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDraft: (id: string) => void;
}) {
  const { data: detail, isLoading, isError, error, refetch } = useCase(caseId);
  const updateStatus = useUpdateCaseStatus();
  const downloadDocument = useDownloadCaseDocument();
  const reviewDocument = useReviewDocumentPublication();
  const currentUser = useAuthStore((state) => state.user);
  const [nextStatus, setNextStatus] = useState<CaseStatus | "">("");
  const [note, setNote] = useState("");

  async function handleValidation(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !nextStatus) return;
    if (nextStatus === "rejeitado" && !note.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }

    try {
      await updateStatus.mutateAsync({
        id: detail.id,
        status: nextStatus,
        note: note.trim() || undefined,
      });
      toast.success(`Status alterado para ${STATUS_LABEL[nextStatus]}`);
      setNextStatus("");
      setNote("");
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Falha ao atualizar o caso",
      );
    }
  }

  const options = detail
    ? NEXT_STATUS[detail.status].filter(
        (status) => status !== "validado" || !detail.requiresFormCompletion,
      )
    : [];

  return (
    <Dialog
      open={Boolean(caseId)}
      onOpenChange={(open) => {
        if (!open) {
          setNextStatus("");
          setNote("");
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogTitle className="sr-only">Detalhes do caso de grilagem</DialogTitle>
        {isLoading && (
          <div className="space-y-4 py-8" aria-label="Carregando detalhes do caso">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="py-10 text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive/70" />
            <h2 className="font-display text-lg font-bold">Não foi possível abrir o caso</h2>
            <DialogDescription className="mt-2">
              {error instanceof Error ? error.message : "Tente novamente em instantes."}
            </DialogDescription>
            <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !isError && detail && (
          <>
            <DialogHeader className="border-b border-border pb-4 pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "border-y border-current py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                    STAMP_TONE[detail.status],
                  )}
                >
                  {STATUS_LABEL[detail.status]}
                </span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {TIPO_LABEL[detail.tipo]}
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight">{detail.nome}</h2>
              <DialogDescription>
                Consulte as informações registradas, os documentos e todo o histórico de validação
                deste caso.
              </DialogDescription>
              {["rascunho", "rejeitado"].includes(detail.status) &&
                detail.createdById === currentUser?.id && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="w-fit" onClick={() => onEditDraft(detail.id)}>
                      {detail.status === "rejeitado" ? "Corrigir e reabrir" : "Editar formulário"}
                    </Button>
                    {detail.status === "rascunho" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-fit"
                        render={<Link href={`/importar-exportar?caseId=${detail.id}`} />}
                      >
                        Continuar anexos
                      </Button>
                    )}
                  </div>
                )}
            </DialogHeader>

            <div className="grid gap-5 md:grid-cols-2">
              <section className="border border-border p-4" aria-labelledby="case-general-heading">
                <h3 id="case-general-heading" className="mb-4 font-display text-base font-bold">
                  Informações gerais
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <DetailItem label="Identificador">{detail.id}</DetailItem>
                  <DetailItem label="Prioridade">{PRIORIDADE_LABEL[detail.prioridade]}</DetailItem>
                  <DetailItem label="Autor">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {detail.createdBy.nome}
                    </span>
                  </DetailItem>
                  <DetailItem label="Status atual">{STATUS_LABEL[detail.status]}</DetailItem>
                  <DetailItem label="Criado em">{formatDate(detail.createdAt)}</DetailItem>
                  <DetailItem label="Última atualização">{formatDate(detail.updatedAt)}</DetailItem>
                </dl>
              </section>

              <section className="border border-border p-4" aria-labelledby="case-location-heading">
                <h3 id="case-location-heading" className="mb-4 font-display text-base font-bold">
                  Localização
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <DetailItem label="Município">{detail.municipio}</DetailItem>
                  <DetailItem label="Estado">{detail.estado}</DetailItem>
                  <DetailItem label="Latitude">
                    {detail.lat != null ? String(detail.lat) : "Não informada"}
                  </DetailItem>
                  <DetailItem label="Longitude">
                    {detail.lng != null ? String(detail.lng) : "Não informada"}
                  </DetailItem>
                </dl>
                {detail.lat != null && detail.lng != null && (
                  <p className="mt-4 flex items-center gap-1.5 border-t border-dotted border-border pt-3 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Coordenadas: {detail.lat.toFixed(6)}, {detail.lng.toFixed(6)}
                  </p>
                )}
              </section>
            </div>

            <section className="border border-border p-4" aria-labelledby="case-report-heading">
              <h3 id="case-report-heading" className="mb-4 font-display text-base font-bold">
                Relato e evidências
              </h3>
              <dl className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <DetailItem label="Descrição">
                    <span className="whitespace-pre-wrap leading-relaxed">
                      {detail.descricao || "Não informada"}
                    </span>
                  </DetailItem>
                </div>
                <DetailItem label="Fonte dos dados">
                  {detail.fonteDados || "Não informada"}
                </DetailItem>
                <DetailItem label="Denunciante">{detail.denunciante || "Não informado"}</DetailItem>
                <div className="md:col-span-2">
                  <DetailItem label="Documentos comprobatórios">
                    {detail.documents.length ? (
                      <div className="space-y-2">
                        {detail.documents.map((document) => (
                          <div key={document.id} className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={downloadDocument.isPending}
                              onClick={() =>
                                downloadDocument.mutate({
                                  caseId: detail.id,
                                  documentId: document.id,
                                  nome: document.nome,
                                })
                              }
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              {document.nome}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {document.possuiDadosPessoais
                                ? "Restrito: contém dados pessoais"
                                : document.publicationApprovedAt
                                  ? "Publicação aprovada"
                                  : document.requestedPublic
                                    ? "Publicação solicitada"
                                    : "Restrito"}
                            </span>
                            {canValidate &&
                              document.requestedPublic &&
                              !document.possuiDadosPessoais && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    document.publicationApprovedAt ? "destructive" : "secondary"
                                  }
                                  disabled={reviewDocument.isPending}
                                  onClick={() =>
                                    reviewDocument.mutate(
                                      {
                                        caseId: detail.id,
                                        documentId: document.id,
                                        approved: !document.publicationApprovedAt,
                                      },
                                      {
                                        onSuccess: () =>
                                          toast.success(
                                            document.publicationApprovedAt
                                              ? "Publicação revogada"
                                              : "Publicação aprovada",
                                          ),
                                        onError: (reviewError) => toast.error(reviewError.message),
                                      },
                                    )
                                  }
                                >
                                  {document.publicationApprovedAt
                                    ? "Revogar"
                                    : "Aprovar publicação"}
                                </Button>
                              )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "Nenhum documento disponível"
                    )}
                  </DetailItem>
                </div>
              </dl>
            </section>

            <section className="border border-border p-4" aria-labelledby="case-research-heading">
              <h3 id="case-research-heading" className="mb-4 font-display text-base font-bold">
                Questionário de pesquisa e publicidade
              </h3>
              <dl className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Relação do pesquisador">
                  {detail.contribution?.relacaoPesquisador || "Não informada"}
                </DetailItem>
                <DetailItem label="Produção e validação">
                  {`Produção: ${detail.contribution?.participouProducao ? "sim" : "não"} · Validação: ${detail.contribution?.participouValidacao ? "sim" : "não"}`}
                </DetailItem>
                <DetailItem label="Responsável pela validação">
                  {detail.contribution?.responsavelValidacao || "Não informado"}
                </DetailItem>
                <DetailItem label="Instrumento central">
                  {detail.contribution?.instrumentoCentral || "Não informado"}
                </DetailItem>
                <DetailItem label="Objeto do espólio">
                  {detail.contribution?.objetoEspolio || "Não informado"}
                </DetailItem>
                <DetailItem label="Instituição promotora">
                  {detail.contribution?.instituicaoPromotora || "Não informada"}
                </DetailItem>
                <DetailItem label="Publicidade e restrição">
                  {[
                    detail.contribution?.grauPublicidadeInformacoes,
                    detail.contribution?.possuiRestricaoDivulgacao
                      ? detail.contribution.restricaoDivulgacao || "Com restrição"
                      : "Sem restrição declarada",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </DetailItem>
                <DetailItem label="Período">
                  {[detail.contribution?.periodoInicio, detail.contribution?.periodoFim]
                    .filter((value) => value != null)
                    .join("–") || "Não informado"}
                </DetailItem>
                <DetailItem label="Cancelamento e órgão">
                  {[
                    detail.contribution?.situacaoCancelamento,
                    detail.contribution?.orgaoCancelamento,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Não informados"}
                </DetailItem>
                <DetailItem label="Retorno ao patrimônio público">
                  {detail.contribution?.retornouPatrimonioPublico == null
                    ? "Não informado"
                    : detail.contribution.retornouPatrimonioPublico
                      ? "Sim"
                      : "Não"}
                </DetailItem>
                <DetailItem label="Destinação e situação atual">
                  {[
                    detail.contribution?.destinacaoPosterior,
                    detail.contribution?.situacaoAtualImovel,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Não informadas"}
                </DetailItem>
                <DetailItem label="Escala espacial">
                  {detail.contribution?.escalaEspacial || "Não informada"}
                </DetailItem>
                <DetailItem label="Conflitos">
                  {detail.contribution?.conflitos || "Não informados"}
                </DetailItem>
                <DetailItem label="Sujeitos sociais">
                  {detail.contribution?.sujeitosSociais || "Não informados"}
                </DetailItem>
                <div className="md:col-span-2">
                  <DetailItem label="Mecanismos e categorias">
                    {detail.facets.length
                      ? detail.facets
                          .map(
                            (facet) =>
                              `${facet.label ?? facet.codigo ?? facet.optionId}${facet.valorOutro ? `: ${facet.valorOutro}` : ""}`,
                          )
                          .join("; ")
                      : "Nenhum informado"}
                  </DetailItem>
                </div>
                <div className="md:col-span-2">
                  <DetailItem label="Fontes">
                    {detail.sources.length
                      ? detail.sources
                          .map(
                            (source) =>
                              `${source.titulo}${source.referencia ? ` — ${source.referencia}` : ""} (${source.grauPublicidade ?? "publicidade não informada"})`,
                          )
                          .join("; ")
                      : "Nenhuma informada"}
                  </DetailItem>
                </div>
                <div className="md:col-span-2">
                  <DetailItem label="Referências espaciais">
                    {detail.spatialReferences.length
                      ? detail.spatialReferences
                          .map((reference) => `${reference.tipo}: ${reference.valor}`)
                          .join("; ")
                      : "Nenhuma informada"}
                  </DetailItem>
                </div>
                <div className="md:col-span-2">
                  <DetailItem label="Datasets vinculados">
                    {detail.datasets.length
                      ? detail.datasets
                          .map(
                            (dataset) =>
                              `${dataset.nome} · ${dataset.status} · ${dataset.visibility}${dataset.codigoCar ? ` · CAR ${dataset.codigoCar}` : ""}${dataset.codigoSigef ? ` · SIGEF ${dataset.codigoSigef}` : ""}`,
                          )
                          .join("; ")
                      : "Nenhum dataset vinculado"}
                  </DetailItem>
                </div>
              </dl>
            </section>

            <section className="border border-border p-4" aria-labelledby="case-history-heading">
              <h3 id="case-history-heading" className="mb-4 font-display text-base font-bold">
                Histórico de status
              </h3>
              {detail.statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma alteração de status registrada.
                </p>
              ) : (
                <ol className="space-y-0">
                  {detail.statusHistory.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="relative border-l border-border pb-4 pl-5 last:pb-0"
                    >
                      <span
                        className="absolute -left-1 top-1.5 h-2 w-2 bg-primary"
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[13px] font-semibold">
                          {entry.fromStatus
                            ? `${STATUS_LABEL[entry.fromStatus]} → ${STATUS_LABEL[entry.toStatus]}`
                            : STATUS_LABEL[entry.toStatus]}
                        </p>
                        <time
                          className="flex items-center gap-1 text-[11px] text-muted-foreground"
                          dateTime={entry.createdAt}
                        >
                          <Clock3 className="h-3 w-3" />
                          {formatDate(entry.createdAt)}
                        </time>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.changedBy?.nome ||
                          (index === 0 ? detail.createdBy.nome : "Usuário não identificado")}
                      </p>
                      {entry.note && (
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px]">{entry.note}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section
              className="border-2 border-foreground p-4"
              aria-labelledby="case-validation-heading"
            >
              <h3 id="case-validation-heading" className="font-display text-base font-bold">
                Validação do caso
              </h3>
              {detail.requiresFormCompletion && detail.status !== "validado" && (
                <p className="mt-2 flex items-start gap-2 border border-gold/50 bg-gold/10 p-3 text-sm">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  Registro legado: devolva-o ao autor para completar o formulário e aceitar a
                  declaração atual. A validação fica indisponível até uma nova submissão.
                </p>
              )}
              {!canValidate ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Seu perfil possui acesso somente à consulta. A alteração de status é reservada a
                  verificadores e administradores.
                </p>
              ) : options.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Não há transições disponíveis para este status.
                </p>
              ) : (
                <form
                  onSubmit={handleValidation}
                  className="mt-4 grid gap-3 md:grid-cols-[minmax(190px,0.7fr)_1.3fr_auto] md:items-end"
                >
                  <div className="space-y-2">
                    <Label htmlFor="case-next-status">Novo status</Label>
                    <SelectField
                      id="case-next-status"
                      value={nextStatus || undefined}
                      onValueChange={setNextStatus}
                      placeholder="Selecione"
                      disabled={updateStatus.isPending}
                      options={options.map((status) => ({
                        value: status,
                        label: STATUS_LABEL[status],
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="case-validation-note">
                      {nextStatus === "rejeitado" ? "Motivo da rejeição *" : "Observação"}
                    </Label>
                    <Textarea
                      id="case-validation-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={1000}
                      rows={2}
                      disabled={updateStatus.isPending}
                      placeholder="Registre o fundamento da decisão"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      updateStatus.isPending ||
                      !nextStatus ||
                      (nextStatus === "rejeitado" && !note.trim())
                    }
                  >
                    {updateStatus.isPending ? "Salvando…" : "Confirmar"}
                  </Button>
                </form>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewCaseDialog({
  draftId,
  onDraftClosed,
}: {
  draftId: string | null;
  onDraftClosed: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workingDraftId, setWorkingDraftId] = useState<string | null>(draftId);
  const workingDraftIdRef = useRef<string | null>(draftId);
  const hydratedDraftIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [editVersion, setEditVersion] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CaseFormState>(createEmptyCaseForm);
  const [errors, setErrors] = useState<CaseFormErrors>({});
  const [additionalSources, setAdditionalSources] = useState<
    { id?: string; titulo: string; referencia: string; grauPublicidade: string }[]
  >([]);
  const [additionalSpatialReferences, setAdditionalSpatialReferences] = useState<
    { id?: string; tipo: string; valor: string; descricao: string }[]
  >([]);
  const createCase = useCreateCase();
  const updateCase = useUpdateCase();
  const { data: draft } = useCase(draftId);
  const { data: options = [] } = useCaseOptions();

  useEffect(() => {
    setWorkingDraftId(draftId);
    workingDraftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    if (!draftId) return;
    setOpen(true);
    if (!draft || !["rascunho", "rejeitado"].includes(draft.status)) return;
    if (hydratedDraftIdRef.current === draft.id) return;
    hydratedDraftIdRef.current = draft.id;
    const primarySource = draft.sources[0];
    const primaryReference = draft.spatialReferences[0];
    setForm({
      nome: draft.nome,
      tipo: draft.tipo,
      municipio: draft.municipio ?? "",
      estado: draft.estado,
      descricao: draft.descricao ?? "",
      lat: draft.lat == null ? "" : String(draft.lat),
      lng: draft.lng == null ? "" : String(draft.lng),
      fonteDados: draft.fonteDados ?? "",
      denunciante: draft.denunciante ?? "",
      prioridade: draft.prioridade,
      relacaoPesquisador: draft.contribution?.relacaoPesquisador ?? "",
      participouProducao: draft.contribution?.participouProducao ?? false,
      participouValidacao: draft.contribution?.participouValidacao ?? false,
      responsavelValidacao: draft.contribution?.responsavelValidacao ?? "",
      instrumentoCentral: draft.contribution?.instrumentoCentral ?? "",
      fonteId: primarySource?.id,
      fonteTitulo: primarySource?.titulo ?? "",
      fonteReferencia: primarySource?.referencia ?? "",
      grauPublicidadeFonte: primarySource?.grauPublicidade === "publico" ? "publico" : "restrito",
      facetIds: draft.facets.map((facet) => facet.optionId),
      facetOtherValues: Object.fromEntries(
        draft.facets
          .filter((facet) => facet.valorOutro)
          .map((facet) => [facet.optionId, facet.valorOutro ?? ""]),
      ),
      objetoEspolio: draft.contribution?.objetoEspolio ?? "",
      instituicaoPromotora: draft.contribution?.instituicaoPromotora ?? "",
      possuiRestricaoDivulgacao: draft.contribution?.possuiRestricaoDivulgacao ?? null,
      restricaoDivulgacao: draft.contribution?.restricaoDivulgacao ?? "",
      periodoInicio:
        draft.contribution?.periodoInicio == null ? "" : String(draft.contribution.periodoInicio),
      periodoFim:
        draft.contribution?.periodoFim == null ? "" : String(draft.contribution.periodoFim),
      situacaoCancelamento: draft.contribution?.situacaoCancelamento ?? "",
      orgaoCancelamento: draft.contribution?.orgaoCancelamento ?? "",
      destinacaoPosterior: draft.contribution?.destinacaoPosterior ?? "",
      situacaoAtualImovel: draft.contribution?.situacaoAtualImovel ?? "",
      conflitos: draft.contribution?.conflitos ?? "",
      sujeitosSociais: draft.contribution?.sujeitosSociais ?? "",
      escalaEspacial: draft.contribution?.escalaEspacial ?? "municipal",
      referenciaEspacialId: primaryReference?.id,
      referenciaEspacialTipo: primaryReference?.tipo ?? "coordenadas_geograficas",
      referenciaEspacialValor: primaryReference?.valor ?? "",
      // Um rascunho reaberto sempre exige um novo gesto afirmativo. O servidor
      // preserva o aceite anterior apenas enquanto o conteúdo permanece idêntico.
      declarationAccepted: false,
    });
    setAdditionalSources(
      draft.sources.slice(1).map((source) => ({
        id: source.id,
        titulo: source.titulo,
        referencia: source.referencia ?? "",
        grauPublicidade: source.grauPublicidade === "publico" ? "publico" : "restrito",
      })),
    );
    setAdditionalSpatialReferences(
      draft.spatialReferences.slice(1).map((reference) => ({
        id: reference.id,
        tipo: reference.tipo,
        valor: reference.valor,
        descricao: reference.descricao ?? "",
      })),
    );
    revisionRef.current = draft.revision;
    dirtyRef.current = false;
    setAutosaveStatus("saved");
  }, [draftId, draft]);

  function markDirty(invalidateDeclaration = true) {
    dirtyRef.current = true;
    editVersionRef.current += 1;
    setEditVersion(editVersionRef.current);
    setAutosaveStatus("idle");
    if (invalidateDeclaration) {
      setForm((current) =>
        current.declarationAccepted ? { ...current, declarationAccepted: false } : current,
      );
    }
  }

  function setField<K extends keyof CaseFormState>(key: K, value: CaseFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    markDirty(key !== "declarationAccepted");
  }

  function changeAdditionalSources(updater: Parameters<typeof setAdditionalSources>[0]) {
    setAdditionalSources(updater);
    markDirty();
  }

  function changeAdditionalSpatialReferences(
    updater: Parameters<typeof setAdditionalSpatialReferences>[0],
  ) {
    setAdditionalSpatialReferences(updater);
    markDirty();
  }

  function selectedFacetCodes(category: string) {
    return options
      .filter((option) => option.categoria === category && form.facetIds.includes(option.id))
      .map((option) => option.codigo);
  }

  function selectedFacetText(category: string) {
    return options
      .filter((option) => option.categoria === category && form.facetIds.includes(option.id))
      .map((option) =>
        option.codigo === "outro"
          ? form.facetOtherValues[option.id]?.trim() || option.label
          : option.label,
      )
      .join("; ");
  }

  function selectedReturnToPublicHeritage(): boolean | null {
    const code = selectedFacetCodes("retorno_patrimonio")[0];
    if (code === "sim") return true;
    if (code === "nao") return false;
    return null;
  }

  async function saveCurrentStep() {
    const versionBeingSaved = editVersionRef.current;
    const nullable = (value: string) => value.trim() || null;
    const stepPayload =
      step === 1
        ? {
            nome: form.nome || undefined,
            tipo: form.tipo,
            municipio: form.municipio,
            estado: form.estado.toUpperCase(),
            descricao: nullable(form.descricao),
            lat: form.lat ? Number(form.lat) : null,
            lng: form.lng ? Number(form.lng) : null,
            fonteDados: nullable(form.fonteDados),
            denunciante: nullable(form.denunciante),
            prioridade: form.prioridade,
          }
        : step === 2
          ? {
              contribution: {
                relacaoPesquisador: nullable(form.relacaoPesquisador),
                participouProducao: form.participouProducao,
                participouValidacao: form.participouValidacao,
                responsavelValidacao: nullable(form.responsavelValidacao),
              },
            }
          : step === 3
            ? {
                contribution: { instrumentoCentral: nullable(form.instrumentoCentral) },
                sources: [
                  {
                    id: form.fonteId,
                    titulo: form.fonteTitulo,
                    referencia: nullable(form.fonteReferencia),
                    grauPublicidade: (form.grauPublicidadeFonte || "restrito") as
                      "publico" | "restrito",
                  },
                  ...additionalSources,
                ].filter((source) => source.titulo.trim()),
              }
            : step === 4
              ? {
                  contribution: {
                    relacaoPesquisador:
                      selectedFacetText("relacao_pesquisador") || nullable(form.relacaoPesquisador),
                    instrumentoCentral:
                      selectedFacetText("instrumento_central") || nullable(form.instrumentoCentral),
                    objetoEspolio:
                      selectedFacetText("objeto_espolio") || nullable(form.objetoEspolio),
                    grauPublicidadeInformacoes: selectedFacetCodes("grau_publicidade")[0] ?? null,
                    situacaoCancelamento:
                      selectedFacetText("cancelamento_titulos") ||
                      nullable(form.situacaoCancelamento),
                    orgaoCancelamento: nullable(form.orgaoCancelamento),
                    retornouPatrimonioPublico: selectedReturnToPublicHeritage(),
                    destinacaoPosterior:
                      selectedFacetText("destinacao_terras") || nullable(form.destinacaoPosterior),
                    situacaoAtualImovel:
                      selectedFacetText("situacao_imovel") || nullable(form.situacaoAtualImovel),
                    sujeitosSociais:
                      selectedFacetText("sujeitos_sociais") || nullable(form.sujeitosSociais),
                    escalaEspacial:
                      selectedFacetText("escala_caso") || nullable(form.escalaEspacial),
                  },
                  facets: form.facetIds.map((optionId) => ({
                    optionId,
                    valorOutro: form.facetOtherValues[optionId] || null,
                  })),
                }
              : step === 5
                ? {
                    contribution: {
                      instituicaoPromotora: nullable(form.instituicaoPromotora),
                      grauPublicidadeInformacoes: selectedFacetCodes("grau_publicidade")[0] ?? null,
                      possuiRestricaoDivulgacao: form.possuiRestricaoDivulgacao,
                      restricaoDivulgacao: nullable(form.restricaoDivulgacao),
                      periodoInicio: form.periodoInicio ? Number(form.periodoInicio) : null,
                      periodoFim: form.periodoFim ? Number(form.periodoFim) : null,
                    },
                  }
                : step === 6
                  ? {
                      contribution: {
                        conflitos: nullable(form.conflitos),
                        sujeitosSociais:
                          selectedFacetText("sujeitos_sociais") || nullable(form.sujeitosSociais),
                      },
                    }
                  : {
                      contribution: {
                        escalaEspacial:
                          selectedFacetText("escala_caso") || nullable(form.escalaEspacial),
                      },
                      spatialReferences: [
                        ...(form.referenciaEspacialValor
                          ? [
                              {
                                id: form.referenciaEspacialId,
                                tipo: form.referenciaEspacialTipo as
                                  | "coordenadas_geograficas"
                                  | "utm"
                                  | "car"
                                  | "sigef"
                                  | "shapefile"
                                  | "kml_kmz"
                                  | "mapa"
                                  | "outra",
                                valor: form.referenciaEspacialValor,
                                descricao: null,
                              },
                            ]
                          : []),
                        ...additionalSpatialReferences
                          .filter((reference) => reference.valor.trim())
                          .map((reference) => ({
                            ...reference,
                            tipo: reference.tipo as
                              | "coordenadas_geograficas"
                              | "utm"
                              | "car"
                              | "sigef"
                              | "shapefile"
                              | "kml_kmz"
                              | "mapa"
                              | "outra",
                            descricao: nullable(reference.descricao),
                          })),
                      ],
                    };
    const save = async () => {
      setAutosaveStatus("saving");
      const currentId = workingDraftIdRef.current;
      const saved = currentId
        ? await updateCase.mutateAsync({
            id: currentId,
            data: { ...stepPayload, revision: revisionRef.current },
          })
        : await createCase.mutateAsync(stepPayload);
      if (!currentId) {
        workingDraftIdRef.current = saved.id;
        setWorkingDraftId(saved.id);
      }
      revisionRef.current = saved.revision;
      if (editVersionRef.current === versionBeingSaved) {
        dirtyRef.current = false;
        setAutosaveStatus("saved");
      }
      return saved;
    };
    const queued = saveQueueRef.current.then(save, save);
    saveQueueRef.current = queued.catch(() => undefined);
    try {
      return await queued;
    } catch (error) {
      setAutosaveStatus("error");
      throw error;
    }
  }

  useEffect(() => {
    if (!open || editVersion === 0 || !dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      void saveCurrentStep().catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha no salvamento automático");
      });
    }, 1200);
    return () => window.clearTimeout(timer);
    // saveCurrentStep usa deliberadamente o snapshot do render atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVersion, open, step]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && autosaveStatus !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [autosaveStatus]);

  async function closeAndFlush() {
    await saveQueueRef.current;
    if (dirtyRef.current) {
      try {
        await saveCurrentStep();
        toast.success("Rascunho salvo automaticamente");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `${error.message}. O formulário permanecerá aberto.`
            : "Não foi possível salvar; o formulário permanecerá aberto.",
        );
        return;
      }
    }
    setErrors({});
    setStep(1);
    setForm(createEmptyCaseForm());
    setAdditionalSources([]);
    setAdditionalSpatialReferences([]);
    setWorkingDraftId(null);
    workingDraftIdRef.current = null;
    hydratedDraftIdRef.current = null;
    revisionRef.current = 0;
    dirtyRef.current = false;
    setOpen(false);
    if (draftId) onDraftClosed();
  }

  async function advanceStep() {
    try {
      await saveQueueRef.current;
      if (dirtyRef.current) await saveCurrentStep();
      setStep((current) => Math.min(8, current + 1));
      toast.success("Etapa salva no rascunho");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar esta etapa");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateCaseForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      if (
        formErrors.nome ||
        formErrors.municipio ||
        formErrors.estado ||
        formErrors.lat ||
        formErrors.lng
      ) {
        setStep(1);
      } else if (formErrors.fonteTitulo) {
        setStep(3);
      } else if (formErrors.possuiRestricaoDivulgacao) {
        setStep(5);
      } else {
        setStep(8);
      }
      toast.error("Confere os campos destacados antes de salvar");
      return;
    }
    const missingCategories = Object.keys(FORM_CATEGORY_LABEL).filter((category) =>
      options
        .filter((option) => option.categoria === category)
        .every((option) => !form.facetIds.includes(option.id)),
    );
    if (missingCategories.length) {
      setStep(4);
      toast.error("Selecione ao menos uma opção em cada categoria do questionário");
      return;
    }
    const missingOther = options.find(
      (option) =>
        option.codigo === "outro" &&
        form.facetIds.includes(option.id) &&
        !form.facetOtherValues[option.id]?.trim(),
    );
    if (missingOther) {
      setStep(4);
      toast.error(`Especifique a opção Outro em ${FORM_CATEGORY_LABEL[missingOther.categoria]}`);
      return;
    }
    if (
      !form.referenciaEspacialValor.trim() &&
      !additionalSpatialReferences.some((reference) => reference.valor.trim())
    ) {
      setStep(7);
      toast.error("Informe ao menos uma referência espacial");
      return;
    }
    try {
      const payload = {
        nome: form.nome,
        tipo: form.tipo,
        municipio: form.municipio,
        estado: form.estado.toUpperCase(),
        descricao: form.descricao || null,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        fonteDados: form.fonteDados || null,
        denunciante: form.denunciante || null,
        prioridade: form.prioridade,
        declarationAccepted: form.declarationAccepted,
        declarationVersion: form.declarationAccepted ? CASE_DECLARATION_VERSION : undefined,
        contribution: {
          relacaoPesquisador:
            selectedFacetText("relacao_pesquisador") || form.relacaoPesquisador || null,
          participouProducao: form.participouProducao,
          participouValidacao: form.participouValidacao,
          responsavelValidacao: form.responsavelValidacao || null,
          instrumentoCentral:
            selectedFacetText("instrumento_central") || form.instrumentoCentral || null,
          objetoEspolio: selectedFacetText("objeto_espolio") || form.objetoEspolio || null,
          instituicaoPromotora: form.instituicaoPromotora || null,
          grauPublicidadeInformacoes: selectedFacetCodes("grau_publicidade")[0] ?? null,
          possuiRestricaoDivulgacao: form.possuiRestricaoDivulgacao,
          restricaoDivulgacao: form.restricaoDivulgacao || null,
          periodoInicio: form.periodoInicio ? Number(form.periodoInicio) : null,
          periodoFim: form.periodoFim ? Number(form.periodoFim) : null,
          situacaoCancelamento:
            selectedFacetText("cancelamento_titulos") || form.situacaoCancelamento || null,
          orgaoCancelamento: form.orgaoCancelamento || null,
          retornouPatrimonioPublico: selectedReturnToPublicHeritage(),
          destinacaoPosterior:
            selectedFacetText("destinacao_terras") || form.destinacaoPosterior || null,
          situacaoAtualImovel:
            selectedFacetText("situacao_imovel") || form.situacaoAtualImovel || null,
          conflitos: form.conflitos || null,
          sujeitosSociais: selectedFacetText("sujeitos_sociais") || form.sujeitosSociais || null,
          escalaEspacial: selectedFacetText("escala_caso") || form.escalaEspacial || null,
        },
        sources: [
          {
            id: form.fonteId,
            titulo: form.fonteTitulo,
            referencia: form.fonteReferencia || null,
            grauPublicidade: (form.grauPublicidadeFonte || "restrito") as "publico" | "restrito",
          },
          ...additionalSources
            .filter((source) => source.titulo.trim())
            .map((source) => ({
              id: source.id,
              titulo: source.titulo,
              referencia: source.referencia || null,
              grauPublicidade: (source.grauPublicidade || "restrito") as "publico" | "restrito",
            })),
        ],
        facets: form.facetIds.map((optionId) => ({
          optionId,
          valorOutro: form.facetOtherValues[optionId] || null,
        })),
        spatialReferences: [
          ...(form.referenciaEspacialValor
            ? [
                {
                  id: form.referenciaEspacialId,
                  tipo: form.referenciaEspacialTipo as
                    | "coordenadas_geograficas"
                    | "utm"
                    | "car"
                    | "sigef"
                    | "shapefile"
                    | "kml_kmz"
                    | "mapa"
                    | "outra",
                  valor: form.referenciaEspacialValor,
                  descricao: null,
                },
              ]
            : []),
          ...additionalSpatialReferences
            .filter((reference) => reference.valor.trim())
            .map((reference) => ({
              id: reference.id,
              tipo: reference.tipo as
                | "coordenadas_geograficas"
                | "utm"
                | "car"
                | "sigef"
                | "shapefile"
                | "kml_kmz"
                | "mapa"
                | "outra",
              valor: reference.valor,
              descricao: reference.descricao || null,
            })),
        ],
      };
      await saveQueueRef.current;
      const currentId = workingDraftIdRef.current;
      const saved = currentId
        ? await updateCase.mutateAsync({
            id: currentId,
            data: { ...payload, revision: revisionRef.current },
          })
        : await createCase.mutateAsync(payload);
      toast.success(
        currentId
          ? "Rascunho atualizado. Agora revise os anexos e dados espaciais."
          : "Rascunho salvo. Agora envie documentos e dados espaciais.",
      );
      setOpen(false);
      setForm(createEmptyCaseForm());
      setAdditionalSources([]);
      setAdditionalSpatialReferences([]);
      setWorkingDraftId(null);
      workingDraftIdRef.current = null;
      hydratedDraftIdRef.current = null;
      revisionRef.current = 0;
      dirtyRef.current = false;
      onDraftClosed();
      router.push(`/importar-exportar?caseId=${encodeURIComponent(saved.id)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar rascunho");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) void closeAndFlush();
        else setOpen(true);
      }}
    >
      {!draftId && (
        <SheetTrigger
          render={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo relato
            </Button>
          }
        />
      )}
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader eyebrow={`Registro de caso · ${draftId ? "retomar rascunho" : "novo relato"}`}>
          <SheetTitle>
            {draftId ? "Editar relato de grilagem" : "Novo relato de grilagem"}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
              <p>Etapa {step} de 8</p>
              <p aria-live="polite">
                {autosaveStatus === "saving"
                  ? "Salvando automaticamente…"
                  : autosaveStatus === "saved"
                    ? "Rascunho salvo"
                    : autosaveStatus === "error"
                      ? "Falha ao salvar"
                      : dirtyRef.current
                        ? "Alterações pendentes"
                        : ""}
              </p>
            </div>
            <div className={step === 1 ? "space-y-4" : "hidden"}>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="case-nome"
                  label="Nome do caso"
                  info="Nome identificador do caso, usado nas listagens. Obrigatório, mínimo 3 caracteres."
                  className="col-span-2"
                  value={form.nome}
                  onChange={(e) => setField("nome", e.target.value)}
                  error={errors.nome}
                />
                <SelectFormField
                  id="case-tipo"
                  label="Tipo"
                  info="Classifica o mecanismo de grilagem: institucional, por título falso ou por autodeclaração no CAR."
                  value={form.tipo}
                  onValueChange={(tipo: CaseTipo) => setField("tipo", tipo)}
                  options={Object.entries(TIPO_LABEL).map(([value, label]) => ({
                    value: value as CaseTipo,
                    label,
                  }))}
                />
                <SelectFormField
                  id="case-prioridade"
                  label="Prioridade"
                  info="Urgência de verificação do caso — usada pra ordenar o workflow de validação."
                  value={form.prioridade}
                  onValueChange={(prioridade: CasePrioridade) => setField("prioridade", prioridade)}
                  options={Object.entries(PRIORIDADE_LABEL).map(([value, label]) => ({
                    value: value as CasePrioridade,
                    label,
                  }))}
                />
                <TextField
                  id="case-municipio"
                  label="Município"
                  info="Município onde ocorre o caso. Obrigatório."
                  value={form.municipio}
                  onChange={(e) => setField("municipio", e.target.value)}
                  error={errors.municipio}
                />
                <SelectFormField
                  id="case-estado"
                  label="Estado (UF)"
                  info="Unidade federativa onde ocorre o caso. Obrigatório."
                  value={form.estado || undefined}
                  onValueChange={(estado) => setField("estado", estado)}
                  placeholder="Selecione"
                  options={BRAZIL_UFS.map((uf) => ({
                    value: uf.sigla,
                    label: `${uf.sigla} — ${uf.nome}`,
                  }))}
                  error={errors.estado}
                />
                <TextField
                  id="case-lat"
                  label="Latitude"
                  info="Opcional. Coordenada decimal, entre -90 e 90 (ex: -15.78). Usada pra plotar o caso no mapa."
                  value={form.lat}
                  onChange={(e) => setField("lat", e.target.value)}
                  error={errors.lat}
                  placeholder="-15.78"
                />
                <TextField
                  id="case-lng"
                  label="Longitude"
                  info="Opcional. Coordenada decimal, entre -180 e 180 (ex: -47.92). Usada pra plotar o caso no mapa."
                  value={form.lng}
                  onChange={(e) => setField("lng", e.target.value)}
                  error={errors.lng}
                  placeholder="-47.92"
                />
              </div>
              <TextAreaField
                id="case-descricao"
                label="Descrição"
                info="Opcional. Detalhes do caso — contexto, histórico, o que motivou o relato."
                value={form.descricao}
                onChange={(e) => setField("descricao", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="case-fonte"
                  label="Fonte dos dados"
                  info="Opcional. De onde vem a informação do caso (ex: INCRA, CPT, denúncia direta)."
                  value={form.fonteDados}
                  onChange={(e) => setField("fonteDados", e.target.value)}
                  placeholder="INCRA, CPT..."
                />
                <TextField
                  id="case-denunciante"
                  label="Denunciante"
                  info="Opcional. Identificação de quem relatou o caso — dado sensível, visível só pra quem tem permissão de validar."
                  value={form.denunciante}
                  onChange={(e) => setField("denunciante", e.target.value)}
                />
              </div>
            </div>

            <div className={cn("border-t border-border pt-4", step !== 2 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">2. Relação e validação</h3>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="case-relacao"
                  label="Relação do pesquisador com o caso"
                  value={form.relacaoPesquisador}
                  onChange={(event) => setField("relacaoPesquisador", event.target.value)}
                />
                <TextField
                  id="case-responsavel-validacao"
                  label="Responsável pela validação"
                  value={form.responsavelValidacao}
                  onChange={(event) => setField("responsavelValidacao", event.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={form.participouProducao}
                    onCheckedChange={(checked) => setField("participouProducao", checked === true)}
                  />
                  Participou da produção
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={form.participouValidacao}
                    onCheckedChange={(checked) => setField("participouValidacao", checked === true)}
                  />
                  Participou da validação
                </label>
              </div>
            </div>

            <div className={cn("border-t border-border pt-4", step !== 3 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">3. Origem e fontes</h3>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="case-instrumento"
                  label="Instrumento central do estudo"
                  value={form.instrumentoCentral}
                  onChange={(event) => setField("instrumentoCentral", event.target.value)}
                />
                <TextField
                  id="case-fonte-titulo"
                  label="Título da fonte"
                  value={form.fonteTitulo}
                  onChange={(event) => setField("fonteTitulo", event.target.value)}
                  error={errors.fonteTitulo}
                />
                <TextField
                  id="case-fonte-referencia"
                  label="Link ou referência"
                  value={form.fonteReferencia}
                  onChange={(event) => setField("fonteReferencia", event.target.value)}
                />
                <SelectFormField
                  id="case-fonte-publicidade"
                  label="Publicidade da fonte"
                  value={form.grauPublicidadeFonte}
                  onValueChange={(value) => setField("grauPublicidadeFonte", value)}
                  options={[
                    { value: "publico", label: "Pública" },
                    { value: "restrito", label: "Restrita" },
                  ]}
                />
              </div>
              {additionalSources.map((source, index) => (
                <div key={index} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
                  <TextField
                    id={`case-source-${index}-title`}
                    label={`Fonte adicional ${index + 1}`}
                    value={source.titulo}
                    onChange={(event) =>
                      changeAdditionalSources((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, titulo: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <SelectFormField
                    id={`case-source-${index}-visibility`}
                    label="Visibilidade"
                    value={source.grauPublicidade}
                    onValueChange={(value) =>
                      changeAdditionalSources((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, grauPublicidade: value } : item,
                        ),
                      )
                    }
                    options={[
                      { value: "restrito", label: "Restrita" },
                      { value: "publico", label: "Pública" },
                    ]}
                  />
                  <TextField
                    id={`case-source-${index}-reference`}
                    label="Link ou referência"
                    value={source.referencia}
                    onChange={(event) =>
                      changeAdditionalSources((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, referencia: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-7"
                    onClick={() =>
                      changeAdditionalSources((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  changeAdditionalSources((current) => [
                    ...current,
                    { titulo: "", referencia: "", grauPublicidade: "restrito" },
                  ])
                }
              >
                Adicionar outra fonte
              </Button>
            </div>

            <div className={cn("border-t border-border pt-4", step !== 4 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">4. Mecanismos e situação fundiária</h3>
              <div className="space-y-4">
                {Object.entries(FORM_CATEGORY_LABEL).map(([categoria, label]) => {
                  const categoryOptions = options.filter(
                    (option) => option.categoria === categoria,
                  );
                  if (!categoryOptions.length) return null;
                  const selectedOptions = categoryOptions.filter((option) =>
                    form.facetIds.includes(option.id),
                  );
                  const isMultiple = MULTI_SELECT_FORM_CATEGORIES.has(categoria);
                  return (
                    <fieldset key={categoria} className="border border-border p-3">
                      <legend className="px-1 text-xs font-semibold">{label}</legend>
                      {isMultiple ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {categoryOptions.map((option) => (
                            <div key={option.id}>
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={form.facetIds.includes(option.id)}
                                  onCheckedChange={(checked) =>
                                    setField(
                                      "facetIds",
                                      checked
                                        ? [...form.facetIds, option.id]
                                        : form.facetIds.filter((id) => id !== option.id),
                                    )
                                  }
                                />
                                {option.label}
                              </label>
                              {option.codigo === "outro" && form.facetIds.includes(option.id) && (
                                <TextField
                                  id={`case-facet-other-${option.id}`}
                                  label="Especifique"
                                  value={form.facetOtherValues[option.id] ?? ""}
                                  onChange={(event) =>
                                    setField("facetOtherValues", {
                                      ...form.facetOtherValues,
                                      [option.id]: event.target.value,
                                    })
                                  }
                                  required
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <SelectField
                            id={`case-facet-${categoria}`}
                            value={selectedOptions[0]?.id}
                            onValueChange={(optionId) =>
                              setField("facetIds", [
                                ...form.facetIds.filter(
                                  (id) => !categoryOptions.some((option) => option.id === id),
                                ),
                                optionId,
                              ])
                            }
                            placeholder="Selecione"
                            options={categoryOptions.map((option) => ({
                              value: option.id,
                              label: option.label,
                            }))}
                          />
                          {selectedOptions[0]?.codigo === "outro" && (
                            <TextField
                              id={`case-facet-other-${selectedOptions[0].id}`}
                              label="Especifique"
                              value={form.facetOtherValues[selectedOptions[0].id] ?? ""}
                              onChange={(event) =>
                                setField("facetOtherValues", {
                                  ...form.facetOtherValues,
                                  [selectedOptions[0].id]: event.target.value,
                                })
                              }
                              required
                            />
                          )}
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TextField
                  id="case-objeto-espolio"
                  label="Objeto do espólio"
                  value={form.objetoEspolio}
                  onChange={(event) => setField("objetoEspolio", event.target.value)}
                />
                <TextField
                  id="case-situacao-cancelamento"
                  label="Situação do cancelamento dos títulos"
                  value={form.situacaoCancelamento}
                  onChange={(event) => setField("situacaoCancelamento", event.target.value)}
                />
                <TextField
                  id="case-orgao-cancelamento"
                  label="Órgão responsável"
                  value={form.orgaoCancelamento}
                  onChange={(event) => setField("orgaoCancelamento", event.target.value)}
                />
                <TextField
                  id="case-destinacao"
                  label="Destinação posterior das terras"
                  value={form.destinacaoPosterior}
                  onChange={(event) => setField("destinacaoPosterior", event.target.value)}
                />
                <TextField
                  id="case-situacao-atual"
                  label="Situação atual do imóvel"
                  value={form.situacaoAtualImovel}
                  onChange={(event) => setField("situacaoAtualImovel", event.target.value)}
                />
              </div>
            </div>

            <div className={cn("border-t border-border pt-4", step !== 5 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">5. Publicidade e período</h3>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="case-instituicao-promotora"
                  label="Instituição promotora"
                  value={form.instituicaoPromotora}
                  onChange={(event) => setField("instituicaoPromotora", event.target.value)}
                />
                <SelectFormField
                  id="case-publicidade-info"
                  label="Publicidade das informações"
                  value={selectedFacetCodes("grau_publicidade")[0]}
                  onValueChange={(codigo) => {
                    const publicityOptions = options.filter(
                      (option) => option.categoria === "grau_publicidade",
                    );
                    const selected = publicityOptions.find((option) => option.codigo === codigo);
                    if (selected) {
                      setField("facetIds", [
                        ...form.facetIds.filter(
                          (id) => !publicityOptions.some((option) => option.id === id),
                        ),
                        selected.id,
                      ]);
                    }
                  }}
                  placeholder="Selecione"
                  options={options
                    .filter((option) => option.categoria === "grau_publicidade")
                    .map((option) => ({ value: option.codigo, label: option.label }))}
                />
                <TextField
                  id="case-periodo-inicio"
                  label="Ano inicial"
                  type="number"
                  value={form.periodoInicio}
                  onChange={(event) => setField("periodoInicio", event.target.value)}
                />
                <TextField
                  id="case-periodo-fim"
                  label="Ano final"
                  type="number"
                  value={form.periodoFim}
                  onChange={(event) => setField("periodoFim", event.target.value)}
                />
              </div>
              <SelectFormField
                id="case-possui-restricao"
                label="Existem informações com restrição de divulgação?"
                value={
                  form.possuiRestricaoDivulgacao === null
                    ? undefined
                    : form.possuiRestricaoDivulgacao
                      ? "sim"
                      : "nao"
                }
                onValueChange={(value) => setField("possuiRestricaoDivulgacao", value === "sim")}
                placeholder="Selecione Sim ou Não"
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                ]}
                error={errors.possuiRestricaoDivulgacao}
              />
              {form.possuiRestricaoDivulgacao && (
                <TextAreaField
                  id="case-restricao"
                  label="Descreva a restrição"
                  value={form.restricaoDivulgacao}
                  onChange={(event) => setField("restricaoDivulgacao", event.target.value)}
                />
              )}
            </div>

            <div className={cn("border-t border-border pt-4", step !== 6 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">6. Conflitos e sujeitos envolvidos</h3>
              <TextAreaField
                id="case-conflitos"
                label="Conflitos identificados"
                value={form.conflitos}
                onChange={(event) => setField("conflitos", event.target.value)}
              />
              <TextAreaField
                id="case-sujeitos"
                label="Sujeitos sociais envolvidos"
                value={form.sujeitosSociais}
                onChange={(event) => setField("sujeitosSociais", event.target.value)}
              />
            </div>

            <div className={cn("border-t border-border pt-4", step !== 7 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">7. Dados espaciais</h3>
              <div className="grid grid-cols-2 gap-3">
                <SelectFormField
                  id="case-escala"
                  label="Escala espacial"
                  value={form.escalaEspacial}
                  onValueChange={(value) => setField("escalaEspacial", value)}
                  options={[
                    { value: "local", label: "Local/imóvel" },
                    { value: "municipal", label: "Municipal" },
                    { value: "estadual", label: "Estadual" },
                    { value: "regional", label: "Regional" },
                  ]}
                />
                <SelectFormField
                  id="case-referencia-tipo"
                  label="Forma de localização"
                  value={form.referenciaEspacialTipo}
                  onValueChange={(value) => setField("referenciaEspacialTipo", value)}
                  options={[
                    { value: "coordenadas_geograficas", label: "Coordenadas geográficas" },
                    { value: "utm", label: "Coordenadas UTM" },
                    { value: "car", label: "CAR" },
                    { value: "sigef", label: "SIGEF" },
                    { value: "shapefile", label: "Shapefile" },
                    { value: "kml_kmz", label: "KML/KMZ" },
                    { value: "mapa", label: "Link de mapa" },
                    { value: "outra", label: "Outra referência" },
                  ]}
                />
              </div>
              <TextField
                id="case-referencia-valor"
                label="Código, coordenada ou link"
                value={form.referenciaEspacialValor}
                onChange={(event) => setField("referenciaEspacialValor", event.target.value)}
              />
              {additionalSpatialReferences.map((reference, index) => (
                <div
                  key={reference.id ?? index}
                  className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_1fr_auto]"
                >
                  <SelectFormField
                    id={`case-reference-${index}-type`}
                    label={`Referência ${index + 2}`}
                    value={reference.tipo}
                    onValueChange={(value) =>
                      changeAdditionalSpatialReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, tipo: value } : item,
                        ),
                      )
                    }
                    options={[
                      { value: "coordenadas_geograficas", label: "Coordenadas geográficas" },
                      { value: "utm", label: "Coordenadas UTM" },
                      { value: "car", label: "CAR" },
                      { value: "sigef", label: "SIGEF" },
                      { value: "shapefile", label: "Shapefile" },
                      { value: "kml_kmz", label: "KML/KMZ" },
                      { value: "mapa", label: "Link de mapa" },
                      { value: "outra", label: "Outra referência" },
                    ]}
                  />
                  <TextField
                    id={`case-reference-${index}-value`}
                    label="Código, coordenada ou link"
                    value={reference.valor}
                    onChange={(event) =>
                      changeAdditionalSpatialReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, valor: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <TextField
                    id={`case-reference-${index}-description`}
                    label="Descrição"
                    value={reference.descricao}
                    onChange={(event) =>
                      changeAdditionalSpatialReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, descricao: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-7"
                    onClick={() =>
                      changeAdditionalSpatialReferences((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  changeAdditionalSpatialReferences((current) => [
                    ...current,
                    { tipo: "coordenadas_geograficas", valor: "", descricao: "" },
                  ])
                }
              >
                Adicionar referência espacial
              </Button>
            </div>

            <div className={cn("border-t border-border pt-4", step !== 8 && "hidden")}>
              <h3 className="mb-3 text-sm font-semibold">8. Declaração e revisão</h3>
              <dl className="mb-4 grid gap-3 border border-border p-3 text-xs sm:grid-cols-2">
                <DetailItem label="Caso">{form.nome || "Não informado"}</DetailItem>
                <DetailItem label="Tipo e prioridade">
                  {`${TIPO_LABEL[form.tipo]} · ${PRIORIDADE_LABEL[form.prioridade]}`}
                </DetailItem>
                <DetailItem label="Local">
                  {[form.municipio, form.estado.toUpperCase()].filter(Boolean).join("/") ||
                    "Não informado"}
                </DetailItem>
                <DetailItem label="Coordenadas">
                  {[form.lat, form.lng].filter(Boolean).join(", ") || "Não informadas"}
                </DetailItem>
                <DetailItem label="Relação com o caso">
                  {form.relacaoPesquisador || "Não informada"}
                </DetailItem>
                <DetailItem label="Produção e validação">
                  {`Produção: ${form.participouProducao ? "sim" : "não"} · Validação: ${form.participouValidacao ? "sim" : "não"}`}
                </DetailItem>
                <DetailItem label="Responsável pela validação">
                  {form.responsavelValidacao || "Não informado"}
                </DetailItem>
                <DetailItem label="Instrumento central">
                  {form.instrumentoCentral || "Não informado"}
                </DetailItem>
                <div className="sm:col-span-2">
                  <DetailItem label="Fontes e referências">
                    {[
                      `${form.fonteTitulo}${form.fonteReferencia ? ` — ${form.fonteReferencia}` : ""}`,
                      ...additionalSources
                        .filter((source) => source.titulo.trim())
                        .map(
                          (source) =>
                            `${source.titulo}${source.referencia ? ` — ${source.referencia}` : ""}`,
                        ),
                    ].join("; ")}
                  </DetailItem>
                </div>
                <DetailItem label="Mecanismos">
                  {form.facetIds
                    .map((id) => options.find((option) => option.id === id)?.label)
                    .filter(Boolean)
                    .join(", ") || "Não informados"}
                </DetailItem>
                <DetailItem label="Valores 'Outro'">
                  {Object.values(form.facetOtherValues).filter(Boolean).join(", ") ||
                    "Não informado"}
                </DetailItem>
                <DetailItem label="Objeto do espólio">
                  {form.objetoEspolio || "Não informado"}
                </DetailItem>
                <DetailItem label="Instituição promotora">
                  {form.instituicaoPromotora || "Não informada"}
                </DetailItem>
                <DetailItem label="Publicidade">
                  {selectedFacetText("grau_publicidade") || "Não informada"}
                </DetailItem>
                <DetailItem label="Restrição de divulgação">
                  {form.possuiRestricaoDivulgacao
                    ? form.restricaoDivulgacao || "Restrição sem descrição"
                    : "Não"}
                </DetailItem>
                <DetailItem label="Período">
                  {[form.periodoInicio, form.periodoFim].filter(Boolean).join("–") ||
                    "Não informado"}
                </DetailItem>
                <DetailItem label="Cancelamento">
                  {[form.situacaoCancelamento, form.orgaoCancelamento]
                    .filter(Boolean)
                    .join(" · ") || "Não informado"}
                </DetailItem>
                <DetailItem label="Retorno ao patrimônio público">
                  {selectedFacetText("retorno_patrimonio") || "Não informado"}
                </DetailItem>
                <DetailItem label="Destinação e situação atual">
                  {[form.destinacaoPosterior, form.situacaoAtualImovel]
                    .filter(Boolean)
                    .join(" · ") || "Não informadas"}
                </DetailItem>
                <DetailItem label="Conflitos">{form.conflitos || "Não informados"}</DetailItem>
                <DetailItem label="Sujeitos sociais">
                  {form.sujeitosSociais || "Não informados"}
                </DetailItem>
                <DetailItem label="Escala espacial">
                  {form.escalaEspacial || "Não informada"}
                </DetailItem>
                <DetailItem label="Referência espacial">
                  {[
                    form.referenciaEspacialValor
                      ? `${form.referenciaEspacialTipo}: ${form.referenciaEspacialValor}`
                      : "",
                    ...additionalSpatialReferences
                      .filter((reference) => reference.valor.trim())
                      .map((reference) => `${reference.tipo}: ${reference.valor}`),
                  ]
                    .filter(Boolean)
                    .join("; ") || "Não informada"}
                </DetailItem>
                <DetailItem label="Fonte geral">{form.fonteDados || "Não informada"}</DetailItem>
                <DetailItem label="Denunciante">{form.denunciante || "Não informado"}</DetailItem>
                <div className="sm:col-span-2">
                  <DetailItem label="Descrição">{form.descricao || "Não informada"}</DetailItem>
                </div>
              </dl>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.declarationAccepted}
                  onCheckedChange={(checked) => setField("declarationAccepted", checked === true)}
                />
                <span>
                  {CASE_DECLARATION_TEXT}{" "}
                  <span className="text-xs text-muted-foreground">
                    (versão {CASE_DECLARATION_VERSION})
                  </span>
                </span>
              </label>
              {errors.declarationAccepted && (
                <p className="mt-1 text-xs text-destructive">{errors.declarationAccepted}</p>
              )}
            </div>
          </SheetBody>
          <SheetFooter>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={step === 1 || createCase.isPending || updateCase.isPending}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                Voltar
              </Button>
              {step < 8 ? (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={createCase.isPending || updateCase.isPending}
                  onClick={advanceStep}
                >
                  {createCase.isPending || updateCase.isPending ? "Salvando…" : "Salvar e avançar"}
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createCase.isPending || updateCase.isPending}
                >
                  {createCase.isPending || updateCase.isPending
                    ? "Salvando..."
                    : draftId
                      ? "Atualizar rascunho e continuar"
                      : "Salvar rascunho e continuar"}
                </Button>
              )}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
