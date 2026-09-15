"use client";

import { useRef, useState } from "react";
import { Paperclip, Plus, ShieldAlert } from "lucide-react";
import type { CaseDTO, CasePrioridade, CaseStatus, CaseTipo } from "@geo/shared";
import { CASE_TIPO_LABEL as TIPO_LABEL, hasPermission } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { SelectFormField, TextAreaField, TextField } from "@/components/ui/form-fields";
import { Skeleton } from "@/components/ui/skeleton";
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
  useCaseDashboard,
  useCases,
  useCreateCase,
  useUpdateCaseStatus,
  useUploadCaseAnexo,
} from "@/lib/queries/cases";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_LABEL: Record<CaseStatus, string> = {
  pendente: "Pendente",
  em_verificacao: "Em verificação",
  validado: "Validado",
  rejeitado: "Rejeitado",
};

const NEXT_STATUS: Record<CaseStatus, CaseStatus[]> = {
  pendente: ["em_verificacao", "rejeitado"],
  em_verificacao: ["validado", "rejeitado", "pendente"],
  validado: ["pendente"],
  rejeitado: ["pendente"],
};

const PRIORIDADE_LABEL: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function CasosPage() {
  const { data: stats, isLoading: statsLoading } = useCaseDashboard();
  const { data: cases, isLoading: casesLoading } = useCases();
  const user = useAuthStore((s) => s.user);
  const canCreate = user && hasPermission(user.role, "case:create");
  const canValidate = user && hasPermission(user.role, "case:validate");

  const maiorTipo = stats?.casosPorTipo.reduce((max, t) => (t.casos > max ? t.casos : max), 0) ?? 0;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-6">
      <div className="flex items-end justify-between border-b-2 border-foreground pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Registro de casos · atualizado agora
        </p>
        {canCreate && <NewCaseDialog />}
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
        <div className="col-span-2 min-h-0 overflow-auto border-r border-border">
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
              </tr>
            </thead>
            <tbody>
              {casesLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="border-b border-border p-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}

              {!casesLoading && cases?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ShieldAlert className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum caso registrado ainda.</p>
                  </td>
                </tr>
              )}

              {cases?.map((c, i) => (
                <CaseRow key={c.id} index={i + 1} caseItem={c} canValidate={!!canValidate} />
              ))}
            </tbody>
          </table>
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
  pendente: "text-primary",
  em_verificacao: "text-gold",
  validado: "text-moss",
  rejeitado: "text-destructive",
};

function CaseRow({
  index,
  caseItem,
  canValidate,
}: {
  index: number;
  caseItem: any;
  canValidate: boolean;
}) {
  const updateStatus = useUpdateCaseStatus();
  const uploadAnexo = useUploadCaseAnexo();
  const fileRef = useRef<HTMLInputElement>(null);
  const options = NEXT_STATUS[caseItem.status as CaseStatus] ?? [];

  return (
    <tr className="group hover:bg-muted/60">
      <td className="border-b border-border px-3 py-3 font-display text-xs text-muted-foreground tabular">
        {String(index).padStart(2, "0")}
      </td>
      <td className="border-b border-border px-3 py-3">
        <p className="text-[13px] font-semibold">{caseItem.nome}</p>
        <p className="text-[11px] text-muted-foreground">{TIPO_LABEL[caseItem.tipo as CaseTipo]}</p>
      </td>
      <td className="border-b border-border px-3 py-3 text-[12.5px] text-muted-foreground">
        {caseItem.municipio}/{caseItem.estado}
      </td>
      <td className="border-b border-border px-3 py-3 text-[12.5px] text-muted-foreground">
        {PRIORIDADE_LABEL[caseItem.prioridade]}
      </td>
      <td className="border-b border-border px-3 py-3">
        {canValidate && options.length > 0 ? (
          <SelectField
            className="h-7 rounded-none text-xs"
            placeholder={STATUS_LABEL[caseItem.status as CaseStatus]}
            onValueChange={(status: CaseStatus) => updateStatus.mutate({ id: caseItem.id, status })}
            options={options.map((o) => ({ value: o, label: STATUS_LABEL[o] }))}
          />
        ) : (
          <span
            className={cn(
              "border-y border-current py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
              STAMP_TONE[caseItem.status as CaseStatus],
            )}
          >
            {STATUS_LABEL[caseItem.status as CaseStatus]}
          </span>
        )}
      </td>
      <td className="border-b border-border px-3 py-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.kmz"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAnexo.mutate({ id: caseItem.id, file });
            e.target.value = "";
          }}
        />
        {caseItem.anexoUrl ? (
          <a
            href={caseItem.anexoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11.5px] text-primary hover:underline"
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[120px] truncate">{caseItem.anexoNome ?? "anexo"}</span>
          </a>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11.5px] text-muted-foreground"
            disabled={uploadAnexo.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            anexar
          </Button>
        )}
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
  } else if (!/^[a-zA-Z]{2}$/.test(form.estado.trim())) {
    errors.estado = "Use a sigla de 2 letras (ex: MG)";
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

  return errors;
}

function NewCaseDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CaseFormState>({
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
  });
  const [errors, setErrors] = useState<CaseFormErrors>({});
  const createCase = useCreateCase();

  function setField<K extends keyof CaseFormState>(key: K, value: CaseFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateCaseForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      toast.error("Confere os campos destacados antes de salvar");
      return;
    }
    try {
      await createCase.mutateAsync({
        ...form,
        estado: form.estado.toUpperCase(),
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
      } as Partial<CaseDTO>);
      toast.success("Caso registrado para validação");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar caso");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setErrors({});
        setOpen(next);
      }}
    >
      <SheetTrigger
        render={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo relato
          </Button>
        }
      />
      <SheetContent className="sm:max-w-lg">
        <SheetHeader eyebrow="Registro de caso · novo relato">
          <SheetTitle>Novo relato de grilagem</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="case-nome"
                label="Nome do caso"
                info="Nome identificador do caso, usado nas listagens. Obrigatório, mínimo 3 caracteres."
                className="col-span-2"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                error={errors.nome}
                required
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
                required
              />
              <TextField
                id="case-estado"
                label="Estado (UF)"
                info="Sigla de 2 letras do estado (ex: MG, SP). Obrigatório."
                value={form.estado}
                onChange={(e) => setField("estado", e.target.value)}
                error={errors.estado}
                maxLength={2}
                required
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
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="w-full" disabled={createCase.isPending}>
              {createCase.isPending ? "Enviando..." : "Enviar para validação"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
