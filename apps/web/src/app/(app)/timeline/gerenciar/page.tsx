"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { TimelineEscopo, TimelineEventDTO } from "@geo/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { FileField, SelectFormField, TextAreaField, TextField } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { UfCombobox } from "@/components/timeline/uf-combobox";
import { BRAZIL_UFS } from "@/lib/brazil-ufs";
import { normalizeSearch } from "@/lib/utils";
import {
  useCreateTimelineEvent,
  useDeleteTimelineEvent,
  useTimelineAdminList,
  useUpdateTimelineEvent,
} from "@/lib/queries/timeline-admin";
import { toast } from "sonner";

const ESCOPO_OPTIONS = [
  { value: "nacional" as TimelineEscopo, label: "Nacional" },
  { value: "estadual" as TimelineEscopo, label: "Estadual" },
];

const ESCOPO_FILTRO_OPTIONS: { value: "todos" | TimelineEscopo; label: string }[] = [
  { value: "todos", label: "Tudo" },
  { value: "nacional", label: "Nacional" },
  { value: "estadual", label: "Estadual" },
];

const MIDIA_FILTRO_OPTIONS: { value: "todos" | "com" | "sem"; label: string }[] = [
  { value: "todos", label: "Qualquer mídia" },
  { value: "com", label: "Com mídia" },
  { value: "sem", label: "Sem mídia" },
];

const PAGE_SIZE = 20;

const TIPO_OPTIONS = [
  { value: "normal", label: "Evento normal" },
  { value: "title", label: "Título da linha do tempo" },
];

interface FormState {
  escopo: TimelineEscopo;
  estado: string;
  startYear: string;
  startMonth: string;
  startDay: string;
  endYear: string;
  endMonth: string;
  endDay: string;
  displayDate: string;
  headline: string;
  text: string;
  mediaCredit: string;
  mediaCaption: string;
  type: string;
}

const EMPTY_FORM: FormState = {
  escopo: "nacional",
  estado: "",
  startYear: "",
  startMonth: "",
  startDay: "",
  endYear: "",
  endMonth: "",
  endDay: "",
  displayDate: "",
  headline: "",
  text: "",
  mediaCredit: "",
  mediaCaption: "",
  type: "normal",
};

function eventToForm(event: TimelineEventDTO): FormState {
  return {
    escopo: event.escopo,
    estado: event.estado ?? "",
    startYear: String(event.startYear),
    startMonth: event.startMonth ? String(event.startMonth) : "",
    startDay: event.startDay ? String(event.startDay) : "",
    endYear: event.endYear ? String(event.endYear) : "",
    endMonth: event.endMonth ? String(event.endMonth) : "",
    endDay: event.endDay ? String(event.endDay) : "",
    displayDate: event.displayDate ?? "",
    headline: event.headline,
    text: event.text,
    mediaCredit: event.mediaCredit ?? "",
    mediaCaption: event.mediaCaption ?? "",
    type: event.type === "title" ? "title" : "normal",
  };
}

function buildFormData(form: FormState, file: File | null, removeMedia: boolean): FormData {
  const fd = new FormData();
  fd.append("escopo", form.escopo);
  if (form.escopo === "estadual") fd.append("estado", form.estado.toUpperCase());
  fd.append("startYear", form.startYear);
  if (form.startMonth) fd.append("startMonth", form.startMonth);
  if (form.startDay) fd.append("startDay", form.startDay);
  if (form.endYear) fd.append("endYear", form.endYear);
  if (form.endMonth) fd.append("endMonth", form.endMonth);
  if (form.endDay) fd.append("endDay", form.endDay);
  if (form.displayDate) fd.append("displayDate", form.displayDate);
  fd.append("headline", form.headline);
  fd.append("text", form.text);
  if (form.mediaCredit) fd.append("mediaCredit", form.mediaCredit);
  if (form.mediaCaption) fd.append("mediaCaption", form.mediaCaption);
  fd.append("type", form.type === "title" ? "title" : "");
  if (file) fd.append("file", file);
  if (removeMedia) fd.append("removeMedia", "true");
  return fd;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function isValidYear(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1000 && n <= 2100;
}

function isValidMonth(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

function isValidDay(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (form.escopo === "estadual" && !form.estado) {
    errors.estado = "Selecione o estado";
  }
  if (!form.startYear.trim()) {
    errors.startYear = "Informe o ano de início";
  } else if (!isValidYear(form.startYear)) {
    errors.startYear = "Ano inválido (use 4 dígitos, entre 1000 e 2100)";
  }
  if (form.startMonth && !isValidMonth(form.startMonth)) {
    errors.startMonth = "Mês deve ser entre 1 e 12";
  }
  if (form.startDay && !isValidDay(form.startDay)) {
    errors.startDay = "Dia deve ser entre 1 e 31";
  }
  if (form.endYear && !isValidYear(form.endYear)) {
    errors.endYear = "Ano inválido (use 4 dígitos, entre 1000 e 2100)";
  } else if (
    form.endYear &&
    isValidYear(form.startYear) &&
    Number(form.endYear) < Number(form.startYear)
  ) {
    errors.endYear = "Ano de fim não pode ser antes do ano de início";
  }
  if (form.endMonth && !isValidMonth(form.endMonth)) {
    errors.endMonth = "Mês deve ser entre 1 e 12";
  }
  if (form.endDay && !isValidDay(form.endDay)) {
    errors.endDay = "Dia deve ser entre 1 e 31";
  }
  if (!form.headline.trim()) {
    errors.headline = "Informe o título do evento";
  } else if (form.headline.trim().length < 3) {
    errors.headline = "Título muito curto (mínimo 3 caracteres)";
  }
  if (!form.text.trim()) {
    errors.text = "Informe o texto do evento";
  } else if (form.text.trim().length < 10) {
    errors.text = "Texto muito curto (mínimo 10 caracteres)";
  }

  return errors;
}

export default function TimelineGerenciarPage() {
  const { data: events, isLoading } = useTimelineAdminList();
  const deleteEvent = useDeleteTimelineEvent();
  const [editing, setEditing] = useState<TimelineEventDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TimelineEventDTO | null>(null);

  const [search, setSearch] = useState("");
  const [escopoFiltro, setEscopoFiltro] = useState<"todos" | TimelineEscopo>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [midiaFiltro, setMidiaFiltro] = useState<"todos" | "com" | "sem">("todos");

  const estadosDisponiveis = useMemo(() => {
    const set = new Set((events ?? []).map((e) => e.estado).filter((v): v is string => !!v));
    return BRAZIL_UFS.filter((uf) => set.has(uf.sigla));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = normalizeSearch(search.trim());
    return (events ?? []).filter((e) => {
      if (escopoFiltro !== "todos" && e.escopo !== escopoFiltro) return false;
      if (estadoFiltro && e.estado !== estadoFiltro) return false;
      if (midiaFiltro === "com" && !e.mediaUrl) return false;
      if (midiaFiltro === "sem" && e.mediaUrl) return false;
      if (q) {
        const haystack = normalizeSearch(`${e.headline} ${e.text} ${e.estado ?? ""}`);
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, escopoFiltro, estadoFiltro, midiaFiltro, search]);

  const filtrosAtivos =
    search.trim() || escopoFiltro !== "todos" || estadoFiltro || midiaFiltro !== "todos";

  const limparFiltros = () => {
    setSearch("");
    setEscopoFiltro("todos");
    setEstadoFiltro("");
    setMidiaFiltro("todos");
  };

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search, escopoFiltro, estadoFiltro, midiaFiltro]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paginatedEvents = filteredEvents.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteEvent.mutateAsync(pendingDelete.id);
      toast.success("Evento removido");
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover evento");
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col p-6">
      <div className="flex items-center justify-between border-b-2 border-foreground pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/timeline"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gestão da linha do tempo
            </p>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Carregando..."
                : filtrosAtivos
                  ? `${filteredEvents.length} de ${events?.length ?? 0} eventos`
                  : `${events?.length ?? 0} eventos cadastrados`}
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo evento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border py-3">
        <div className="relative min-w-48 flex-1 rounded-lg border border-border bg-muted/40 p-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, texto ou estado..."
            className="h-7 border-0 bg-transparent pl-7 shadow-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {ESCOPO_FILTRO_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={escopoFiltro === opt.value ? "default" : "ghost"}
              onClick={() => {
                setEscopoFiltro(opt.value);
                if (opt.value !== "estadual") setEstadoFiltro("");
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {escopoFiltro !== "nacional" && estadosDisponiveis.length > 0 && (
          <DropdownMenu>
            <div className="rounded-lg border border-border bg-muted/40 p-1">
              <DropdownMenuTrigger
                render={
                  <Button size="sm" variant="ghost">
                    {estadoFiltro
                      ? BRAZIL_UFS.find((uf) => uf.sigla === estadoFiltro)?.sigla
                      : "Todos os estados"}
                  </Button>
                }
              />
            </div>
            <DropdownMenuContent className="max-h-72 w-48">
              <DropdownMenuItem onClick={() => setEstadoFiltro("")}>
                Todos os estados
              </DropdownMenuItem>
              {estadosDisponiveis.map((uf) => (
                <DropdownMenuItem key={uf.sigla} onClick={() => setEstadoFiltro(uf.sigla)}>
                  <span className="font-medium">{uf.sigla}</span>
                  <span className="text-muted-foreground">{uf.nome}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <div className="rounded-lg border border-border bg-muted/40 p-1">
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="ghost">
                  {MIDIA_FILTRO_OPTIONS.find((o) => o.value === midiaFiltro)?.label}
                </Button>
              }
            />
          </div>
          <DropdownMenuContent className="w-40">
            {MIDIA_FILTRO_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.value} onClick={() => setMidiaFiltro(opt.value)}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {filtrosAtivos && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={limparFiltros}
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Escopo
              </th>
              <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ano
              </th>
              <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Evento
              </th>
              <th className="border-b border-border px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mídia
              </th>
              <th className="w-20 border-b border-border px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="border-b border-border px-3 py-3" colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {paginatedEvents.map((event) => (
              <tr key={event.id} className="group hover:bg-muted/60">
                <td className="border-b border-border px-3 py-3">
                  <Badge variant={event.escopo === "nacional" ? "default" : "secondary"}>
                    {event.escopo === "nacional" ? "Nacional" : event.estado}
                  </Badge>
                </td>
                <td className="border-b border-border px-3 py-3 text-[12.5px] tabular-nums text-muted-foreground">
                  {event.startYear}
                  {event.endYear ? `–${event.endYear}` : ""}
                </td>
                <td className="border-b border-border px-3 py-3">
                  <p className="text-[13px] font-semibold">{event.headline}</p>
                  {event.type === "title" && (
                    <p className="text-[11px] text-primary">Título da timeline</p>
                  )}
                </td>
                <td className="border-b border-border px-3 py-3">
                  {event.mediaUrl ? (
                    <a
                      href={event.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11.5px] text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      abrir
                    </a>
                  ) : (
                    <span className="text-[11.5px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="border-b border-border px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditing(event)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(event)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {filtrosAtivos
                    ? "Nenhum evento encontrado com esses filtros."
                    : "Nenhum evento cadastrado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Página {pageClamped} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pageClamped <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pageClamped >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <EventFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        title="Novo evento"
      />

      {editing && (
        <EventFormSheet
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          mode="edit"
          title="Editar evento"
          event={editing}
        />
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir evento?</DialogTitle>
            <DialogDescription>
              "{pendingDelete?.headline}" será removido da linha do tempo. Essa ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEvent.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventFormSheet({
  open,
  onOpenChange,
  mode,
  title,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  title: string;
  event?: TimelineEventDTO;
}) {
  const [form, setForm] = useState<FormState>(event ? eventToForm(event) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const createEvent = useCreateTimelineEvent();
  const updateEvent = useUpdateTimelineEvent();
  const pending = createEvent.isPending || updateEvent.isPending;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      toast.error("Confere os campos destacados antes de salvar");
      return;
    }
    const formData = buildFormData(form, file, removeMedia);
    try {
      if (mode === "create") {
        await createEvent.mutateAsync(formData);
        toast.success("Evento cadastrado na linha do tempo");
        setForm(EMPTY_FORM);
        setErrors({});
        setFile(null);
      } else if (event) {
        await updateEvent.mutateAsync({ id: event.id, formData });
        toast.success("Evento atualizado");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar evento");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setForm(event ? eventToForm(event) : EMPTY_FORM);
          setErrors({});
          setFile(null);
          setRemoveMedia(false);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent className="sm:max-w-lg">
        <SheetHeader eyebrow="Linha do tempo · marco legal">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <SelectFormField
                id="tl-escopo"
                label="Escopo"
                info="Define se o marco vale pro Brasil inteiro (Nacional) ou só pra um estado específico (Estadual)."
                value={form.escopo}
                onValueChange={(escopo: TimelineEscopo) => setField("escopo", escopo)}
                options={ESCOPO_OPTIONS}
              />
              {form.escopo === "estadual" && (
                <FormField
                  htmlFor="tl-estado"
                  label="Estado"
                  info="UF ao qual esse marco se refere. Obrigatório quando o escopo é Estadual."
                  error={errors.estado}
                  required
                >
                  <UfCombobox
                    value={form.estado}
                    onValueChange={(estado) => setField("estado", estado)}
                  />
                </FormField>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <TextField
                id="tl-start-year"
                label="Ano início"
                info="Ano em que o marco começou a valer. Obrigatório — 4 dígitos, entre 1000 e 2100."
                type="number"
                value={form.startYear}
                onChange={(e) => setField("startYear", e.target.value)}
                error={errors.startYear}
                required
              />
              <TextField
                id="tl-start-month"
                label="Mês"
                info="Opcional. Preencha só se souber o mês exato do início (1 a 12)."
                type="number"
                min={1}
                max={12}
                value={form.startMonth}
                onChange={(e) => setField("startMonth", e.target.value)}
                error={errors.startMonth}
              />
              <TextField
                id="tl-start-day"
                label="Dia"
                info="Opcional. Preencha só se souber o dia exato do início (1 a 31)."
                type="number"
                min={1}
                max={31}
                value={form.startDay}
                onChange={(e) => setField("startDay", e.target.value)}
                error={errors.startDay}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <TextField
                id="tl-end-year"
                label="Ano fim"
                info='Opcional — preencha só se o marco cobre um período (ex: uma era histórica), não um evento pontual. Não pode ser antes do "Ano início".'
                type="number"
                value={form.endYear}
                onChange={(e) => setField("endYear", e.target.value)}
                error={errors.endYear}
              />
              <TextField
                id="tl-end-month"
                label="Mês"
                info="Opcional. Mês do fim do período (1 a 12)."
                type="number"
                min={1}
                max={12}
                value={form.endMonth}
                onChange={(e) => setField("endMonth", e.target.value)}
                error={errors.endMonth}
              />
              <TextField
                id="tl-end-day"
                label="Dia"
                info="Opcional. Dia do fim do período (1 a 31)."
                type="number"
                min={1}
                max={31}
                value={form.endDay}
                onChange={(e) => setField("endDay", e.target.value)}
                error={errors.endDay}
              />
            </div>

            <TextField
              id="tl-display-date"
              label="Data de exibição"
              info='Opcional. Texto livre que substitui o ano nos rótulos da timeline (ex: "Século XIX") — use quando a data exata não fizer sentido mostrar.'
              value={form.displayDate}
              onChange={(e) => setField("displayDate", e.target.value)}
              placeholder='Ex: "Século XIX"'
            />

            <TextField
              id="tl-headline"
              label="Título"
              info="Título curto do evento, aparece em destaque na timeline. Obrigatório, mínimo 3 caracteres."
              value={form.headline}
              onChange={(e) => setField("headline", e.target.value)}
              error={errors.headline}
              required
            />

            <TextAreaField
              id="tl-text"
              label="Texto"
              info="Descrição do marco legal — aparece quando o evento é aberto na timeline. Obrigatório, mínimo 10 caracteres."
              value={form.text}
              onChange={(e) => setField("text", e.target.value)}
              error={errors.text}
              rows={5}
              required
            />

            <SelectFormField
              id="tl-tipo"
              label="Tipo"
              info='"Evento normal" aparece na linha do tempo. "Título da linha do tempo" define o slide de abertura — só deve existir um por escopo.'
              value={form.type}
              onValueChange={(type: string) => setField("type", type)}
              options={TIPO_OPTIONS}
            />

            <div className="space-y-3 rounded-lg border border-border p-3">
              <FileField
                id="tl-file"
                label="Mídia"
                info="PDF do documento ou imagem ilustrativa do evento (opcional). Formatos aceitos: PDF, PNG, JPG, WEBP, SVG."
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg"
                file={file}
                onFileChange={setFile}
                hint={
                  mode === "edit" &&
                  event?.mediaUrl &&
                  !file && (
                    <label className="flex items-center gap-1.5 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={removeMedia}
                        onChange={(e) => setRemoveMedia(e.target.checked)}
                      />
                      Remover mídia atual
                    </label>
                  )
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="tl-media-credit"
                  label="Crédito"
                  info="Opcional. Texto de crédito da mídia, mostrado junto com ela na timeline (ex: nome do fotógrafo/fonte)."
                  value={form.mediaCredit}
                  onChange={(e) => setField("mediaCredit", e.target.value)}
                />
                <TextField
                  id="tl-media-caption"
                  label="Legenda"
                  info="Opcional. Legenda curta mostrada abaixo da mídia na timeline."
                  value={form.mediaCaption}
                  onChange={(e) => setField("mediaCaption", e.target.value)}
                />
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Salvando..."
                : mode === "create"
                  ? "Cadastrar evento"
                  : "Salvar alterações"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
