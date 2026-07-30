"use client";

import { useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import type { CasePrioridade, CaseStatus, CaseTipo } from "@geo/shared";
import { hasPermission } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCaseDashboard, useCases, useCreateCase, useUpdateCaseStatus } from "@/lib/queries/cases";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TIPO_LABEL: Record<CaseTipo, string> = {
  invasao_propriedade: "Invasão de Propriedade",
  ocupacao_irregular: "Ocupação Irregular",
  desmatamento_ilegal: "Desmatamento Ilegal",
  conflito_agrario: "Conflito Agrário",
};

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

const PRIORIDADE_LABEL: Record<string, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };

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
        <StatCell label="Casos ativos" value={stats?.casosAtivos} loading={statsLoading} highlight />
        <StatCell label="Validados" value={stats?.casosValidados} loading={statsLoading} />
        <StatCell label="Rejeitados" value={stats?.casosRejeitados} loading={statsLoading} />
        <StatCell label="Pendentes de validação" value={stats?.validacoesPendentes} loading={statsLoading} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3">
        {/* tabela principal */}
        <div className="col-span-2 min-h-0 overflow-auto border-r border-border">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="w-10 border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Caso</th>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Local</th>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</th>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {casesLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="border-b border-border p-3"><Skeleton className="h-4 w-full" /></td></tr>
                ))}

              {!casesLoading && cases?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
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
            {statsLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            {!statsLoading && stats?.casosPorTipo.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem casos ativos no momento.</p>
            )}
            {stats?.casosPorTipo.map((t) => (
              <div key={t.tipo} className="flex items-center gap-2 text-[11.5px]">
                <span className="w-[118px] shrink-0 text-muted-foreground">{TIPO_LABEL[t.tipo as CaseTipo] ?? t.tipo}</span>
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
            {statsLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            {!statsLoading && stats?.municipiosMaisAfetados.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
            )}
            {stats?.municipiosMaisAfetados.map((m, i) => (
              <div key={m.municipio} className="flex items-center justify-between border-b border-dotted border-border py-1.5 text-[12.5px]">
                <span className="text-muted-foreground">{i + 1} · {m.municipio}</span>
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
        <p className={cn("font-display text-[26px] font-bold leading-none tabular", highlight && "text-primary")}>
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

function CaseRow({ index, caseItem, canValidate }: { index: number; caseItem: any; canValidate: boolean }) {
  const updateStatus = useUpdateCaseStatus();
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
          <Select onValueChange={(status) => updateStatus.mutate({ id: caseItem.id, status: status as CaseStatus })}>
            <SelectTrigger className="h-7 w-[168px] rounded-none text-xs">
              <SelectValue placeholder={STATUS_LABEL[caseItem.status as CaseStatus]} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{STATUS_LABEL[o]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className={cn("border-y border-current py-0.5 text-[10.5px] font-bold uppercase tracking-wide", STAMP_TONE[caseItem.status as CaseStatus])}>
            {STATUS_LABEL[caseItem.status as CaseStatus]}
          </span>
        )}
      </td>
    </tr>
  );
}

function NewCaseDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    tipo: "invasao_propriedade" as CaseTipo,
    municipio: "",
    estado: "",
    descricao: "",
    lat: "",
    lng: "",
    fonteDados: "",
    denunciante: "",
    prioridade: "media" as CasePrioridade,
  });
  const createCase = useCreateCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCase.mutateAsync({
        ...form,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
      } as any);
      toast.success("Caso registrado para validação");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar caso");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="gap-2"><Plus className="h-4 w-4" />Novo relato</Button>} />
      <SheetContent className="sm:max-w-lg">
        <SheetHeader eyebrow="Registro de caso · novo relato">
          <SheetTitle>Novo relato de grilagem</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="case-nome">Nome do caso</Label>
              <Input id="case-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as CaseTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v as CasePrioridade }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-municipio">Município</Label>
              <Input id="case-municipio" value={form.municipio} onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-estado">Estado (UF)</Label>
              <Input id="case-estado" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} maxLength={2} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-lat">Latitude</Label>
              <Input id="case-lat" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} placeholder="-15.78" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-lng">Longitude</Label>
              <Input id="case-lng" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} placeholder="-47.92" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="case-descricao">Descrição</Label>
            <Textarea id="case-descricao" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="case-fonte">Fonte dos dados</Label>
              <Input id="case-fonte" value={form.fonteDados} onChange={(e) => setForm((f) => ({ ...f, fonteDados: e.target.value }))} placeholder="INCRA, CPT..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-denunciante">Denunciante</Label>
              <Input id="case-denunciante" value={form.denunciante} onChange={(e) => setForm((f) => ({ ...f, denunciante: e.target.value }))} />
            </div>
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
