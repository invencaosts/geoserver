"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CheckCircle2,
  Database,
  FileJson,
  FileSpreadsheet,
  FileText,
  Globe,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileField, TextField } from "@/components/ui/form-fields";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useDatasets,
  useDeleteDataset,
  useUploadDataset,
  useDownloadDataset,
  useReviewDatasetPublication,
} from "@/lib/queries/datasets";
import { CASE_DECLARATION_TEXT, CASE_DECLARATION_VERSION, userHasPermission } from "@geo/shared";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCase, useSubmitCase, useUpdateCase, useUploadCaseDocument } from "@/lib/queries/cases";

const FORMATS = [
  { id: "shapefile", name: "Shapefile", ext: ".zip", icon: Database, accept: ".zip" },
  { id: "geojson", name: "GeoJSON", ext: ".geojson", icon: FileJson, accept: ".geojson,.json" },
  { id: "kml", name: "KML", ext: ".kml", icon: Globe, accept: ".kml" },
  { id: "kmz", name: "KMZ", ext: ".kmz", icon: Globe, accept: ".kmz" },
  { id: "csv", name: "CSV", ext: ".csv", icon: FileSpreadsheet, accept: ".csv" },
];

const STATUS_ICON: Record<string, React.ElementType> = {
  active: CheckCircle2,
  processing: RefreshCw,
  error: AlertCircle,
};

const STATUS_LABEL: Record<string, string> = {
  active: "Concluído",
  processing: "Processando",
  error: "Erro",
};

const STATUS_TONE: Record<string, { icon: string; chip: string }> = {
  active: { icon: "text-emerald-500", chip: "bg-emerald-500/10" },
  processing: { icon: "text-blue-500", chip: "bg-blue-500/10" },
  error: { icon: "text-red-500", chip: "bg-red-500/10" },
};

function ImportarExportarContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const { data: linkedCase, isLoading: linkedCaseLoading } = useCase(caseId);
  const submitCase = useSubmitCase();
  const updateCase = useUpdateCase();
  const { data: datasets, isLoading } = useDatasets();
  const deleteDataset = useDeleteDataset();
  const downloadDataset = useDownloadDataset();
  const reviewDataset = useReviewDatasetPublication();
  const user = useAuthStore((s) => s.user);
  const canExport = userHasPermission(user, "data:export");
  const canDelete = userHasPermission(user, "dataset:delete");
  const canReview = userHasPermission(user, "case:validate");
  const [preselectFormat, setPreselectFormat] = useState<(typeof FORMATS)[number] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [finalDeclarationAccepted, setFinalDeclarationAccepted] = useState(false);

  useEffect(() => {
    setFinalDeclarationAccepted(false);
  }, [linkedCase?.revision]);

  async function acceptAndSubmitCase() {
    if (!caseId || !linkedCase || !finalDeclarationAccepted) {
      toast.error("Revise e aceite a declaração antes de submeter");
      return;
    }
    await updateCase.mutateAsync({
      id: caseId,
      data: {
        revision: linkedCase.revision,
        declarationAccepted: true,
        declarationVersion: CASE_DECLARATION_VERSION,
      },
    });
    await submitCase.mutateAsync(caseId);
  }

  const total = datasets?.length ?? 0;
  const concluidos = datasets?.filter((d) => d.status === "active").length ?? 0;
  const processando = datasets?.filter((d) => d.status === "processing").length ?? 0;
  const exportaveis = datasets?.filter((d) => d.status === "active") ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total de operações"
          value={total}
          icon={ArrowLeftRight}
          loading={isLoading}
        />
        <StatCard
          label="Concluídas"
          value={concluidos}
          icon={CheckCircle2}
          tone="text-emerald-500"
          bg="bg-emerald-500/10"
          loading={isLoading}
        />
        <StatCard
          label="Processando"
          value={processando}
          icon={RefreshCw}
          tone="text-blue-500"
          bg="bg-blue-500/10"
          loading={isLoading}
        />
      </div>

      {/* importar */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ArrowUpFromLine className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold">Importar dados</p>
                <p className="text-xs text-muted-foreground">
                  Selecione um formato e envie o arquivo pra processar
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {FORMATS.map((format) => (
              <Sheet
                key={format.id}
                open={uploadOpen && preselectFormat?.id === format.id}
                onOpenChange={(open) => {
                  setUploadOpen(open);
                  if (open) setPreselectFormat(format);
                }}
              >
                <SheetTrigger
                  render={
                    <button
                      type="button"
                      disabled={
                        Boolean(caseId) &&
                        (linkedCaseLoading || linkedCase?.createdById !== user?.id)
                      }
                      className="flex flex-col items-center gap-2 border border-border p-4 text-center transition-colors hover:border-primary hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <format.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium">{format.name}</p>
                        <p className="text-[11px] text-muted-foreground">{format.ext}</p>
                      </div>
                    </button>
                  }
                />
                <SheetContent>
                  <SheetHeader eyebrow="Importar & Exportar · novo envio">
                    <SheetTitle>Importar {format.name}</SheetTitle>
                  </SheetHeader>
                  <SheetBody>
                    <UploadForm
                      format={format}
                      caseId={
                        linkedCase?.createdById === user?.id ? (caseId ?? undefined) : undefined
                      }
                      onDone={() => setUploadOpen(false)}
                    />
                  </SheetBody>
                </SheetContent>
              </Sheet>
            ))}
          </div>
        </CardContent>
      </Card>

      {caseId && linkedCase && linkedCase.createdById === user?.id && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold">Complementar o caso: {linkedCase.nome}</p>
              <p className="text-xs text-muted-foreground">
                Envie os documentos comprobatórios e, ao concluir, submeta o rascunho para
                verificação.
              </p>
            </div>
            <CaseDocumentUpload caseId={caseId} sources={linkedCase.sources} />
            <label className="flex items-start gap-2 border-t border-border pt-4 text-sm">
              <Checkbox
                checked={finalDeclarationAccepted}
                onCheckedChange={(checked) => setFinalDeclarationAccepted(checked === true)}
              />
              <span>
                {CASE_DECLARATION_TEXT}{" "}
                <span className="text-xs text-muted-foreground">
                  (versão {CASE_DECLARATION_VERSION}; aceite referente aos documentos e dados
                  atualmente vinculados)
                </span>
              </span>
            </label>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {linkedCase.documents.length} documento(s) e {linkedCase.datasets.length} dataset(s)
                vinculados.
              </p>
              <Button
                type="button"
                disabled={
                  linkedCase.status !== "rascunho" ||
                  !finalDeclarationAccepted ||
                  submitCase.isPending ||
                  updateCase.isPending
                }
                onClick={() =>
                  toast.promise(acceptAndSubmitCase(), {
                    loading: "Submetendo caso...",
                    success: "Caso submetido para verificação",
                    error: (error) =>
                      error instanceof Error ? error.message : "Falha ao submeter o caso",
                  })
                }
              >
                {linkedCase.status === "rascunho" ? "Submeter para verificação" : "Caso submetido"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* exportar */}
      {canExport && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ArrowDownToLine className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold">Exportar dados</p>
                <p className="text-xs text-muted-foreground">
                  Datasets ativos disponíveis pra download em GeoJSON
                </p>
              </div>
            </div>

            {isLoading && <Skeleton className="h-12 w-full rounded-lg" />}
            {!isLoading && exportaveis.length === 0 && (
              <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Nenhum dataset ativo disponível pra exportação ainda.
              </p>
            )}
            <div className="grid gap-2">
              {exportaveis.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.registros.toLocaleString("pt-BR")} registros
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={downloadDataset.isPending}
                    onClick={() =>
                      toast.promise(downloadDataset.mutateAsync({ id: d.id, nome: d.nome }), {
                        loading: "Preparando download...",
                        success: "Download iniciado",
                        error: (err) => (err instanceof Error ? err.message : "Falha no download"),
                      })
                    }
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    GeoJSON
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* histórico de operações */}
      <div className="space-y-2.5">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Histórico de operações
        </p>

        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
          ))}

        {datasets?.map((d) => {
          const Icon = STATUS_ICON[d.status];
          const tone = STATUS_TONE[d.status];
          return (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      tone.chip,
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        tone.icon,
                        d.status === "processing" && "animate-spin",
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Importação · {d.formato}
                      {` · ${d.visibility === "publico" ? "Público" : d.requestedPublic ? "Publicação solicitada" : "Restrito"}`}
                      {d.codigoCar ? ` · CAR ${d.codigoCar}` : ""}
                      {d.codigoSigef ? ` · SIGEF ${d.codigoSigef}` : ""}
                      {d.erro && <span className="text-destructive"> · {d.erro}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      d.status === "error"
                        ? "destructive"
                        : d.status === "active"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {STATUS_LABEL[d.status]}
                  </Badge>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteDataset.mutate(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canReview && d.requestedPublic && d.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reviewDataset.isPending}
                      onClick={() =>
                        reviewDataset.mutate({ id: d.id, approved: d.visibility !== "publico" })
                      }
                    >
                      {d.visibility === "publico" ? "Revogar publicação" : "Aprovar publicação"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function ImportarExportarPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <ImportarExportarContent />
    </Suspense>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "text-primary",
  bg = "bg-primary/10",
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: string;
  bg?: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-10" />
          ) : (
            <p className="text-3xl font-bold tracking-tight">{value}</p>
          )}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", bg)}>
          <Icon className={cn("h-5 w-5", tone)} />
        </div>
      </CardContent>
    </Card>
  );
}

const FORMAT_HINT: Record<string, string> = {
  shapefile: "Envie um .zip contendo .shp/.dbf/.shx",
  csv: "O CSV precisa de colunas de latitude/longitude",
};

interface UploadFormErrors {
  nome?: string;
  file?: string;
}

function validateUploadForm(nome: string, file: File | null): UploadFormErrors {
  const errors: UploadFormErrors = {};
  if (!nome.trim()) {
    errors.nome = "Informe o nome do dataset";
  } else if (nome.trim().length < 2) {
    errors.nome = "Nome muito curto (mínimo 2 caracteres)";
  }
  if (!file) {
    errors.file = "Selecione um arquivo pra importar";
  }
  return errors;
}

function UploadForm({
  format,
  caseId,
  onDone,
}: {
  format: (typeof FORMATS)[number];
  caseId?: string;
  onDone: () => void;
}) {
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<UploadFormErrors>({});
  const [visibility, setVisibility] = useState<"publico" | "restrito">("restrito");
  const [codigoCar, setCodigoCar] = useState("");
  const [codigoSigef, setCodigoSigef] = useState("");
  const upload = useUploadDataset();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateUploadForm(nome, file);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      toast.error("Confere os campos destacados antes de importar");
      return;
    }
    try {
      await upload.mutateAsync({
        nome,
        file: file!,
        caseId,
        visibility,
        codigoCar: codigoCar || undefined,
        codigoSigef: codigoSigef || undefined,
      });
      toast.success("Importação iniciada. Acompanhe o status no histórico abaixo.");
      setNome("");
      setFile(null);
      setErrors({});
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        id="ie-nome"
        label="Nome do dataset"
        info="Nome de exibição do dataset nas listagens de dados espaciais. Obrigatório, mínimo 2 caracteres."
        value={nome}
        onChange={(e) => {
          setNome(e.target.value);
          setErrors((prev) => ({ ...prev, nome: undefined }));
        }}
        error={errors.nome}
        required
      />
      <FileField
        id="ie-arquivo"
        label={`Arquivo (${format.ext})`}
        info={`Arquivo no formato ${format.name}. Obrigatório.${FORMAT_HINT[format.id] ? ` ${FORMAT_HINT[format.id]}.` : ""}`}
        accept={format.accept}
        file={file}
        onFileChange={(f) => {
          setFile(f);
          setErrors((prev) => ({ ...prev, file: undefined }));
        }}
        error={errors.file}
        hint={FORMAT_HINT[format.id]}
        required
      />
      <SelectField
        id="ie-visibility"
        value={visibility}
        onValueChange={setVisibility}
        options={[
          { value: "restrito", label: "Restrito" },
          { value: "publico", label: "Solicitar publicação após revisão" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="ie-car"
          label="Código CAR (opcional)"
          value={codigoCar}
          onChange={(event) => setCodigoCar(event.target.value)}
        />
        <TextField
          id="ie-sigef"
          label="Código SIGEF (opcional)"
          value={codigoSigef}
          onChange={(event) => setCodigoSigef(event.target.value)}
        />
      </div>
      <Button type="submit" className="w-full gap-2" disabled={upload.isPending}>
        <Upload className="h-4 w-4" />
        {upload.isPending ? "Enviando..." : "Importar"}
      </Button>
    </form>
  );
}

function CaseDocumentUpload({
  caseId,
  sources,
}: {
  caseId: string;
  sources: { id?: string; titulo: string }[];
}) {
  const upload = useUploadCaseDocument();
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"publico" | "restrito">("restrito");
  const [possuiDadosPessoais, setPossuiDadosPessoais] = useState(false);
  const [sourceId, setSourceId] = useState("");

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return toast.error("Selecione um PDF ou KMZ");
    try {
      await upload.mutateAsync({
        id: caseId,
        file,
        visibility,
        possuiDadosPessoais,
        sourceId: sourceId || undefined,
      });
      setFile(null);
      toast.success("Documento enviado para armazenamento privado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar documento");
    }
  }

  return (
    <form onSubmit={handleUpload} className="grid gap-3 md:grid-cols-2 md:items-end">
      <div className="space-y-2">
        <Label htmlFor="case-document">Documento (PDF ou KMZ)</Label>
        <input
          id="case-document"
          type="file"
          accept=".pdf,.kmz"
          className="block w-full text-sm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={possuiDadosPessoais}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              setPossuiDadosPessoais(enabled);
              if (enabled) setVisibility("restrito");
            }}
          />
          Contém dados pessoais ou informação restrita
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-document-visibility">Visibilidade</Label>
        <SelectField
          id="case-document-visibility"
          value={visibility}
          disabled={possuiDadosPessoais}
          onValueChange={setVisibility}
          options={[
            { value: "restrito", label: "Restrito" },
            { value: "publico", label: "Público após validar" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-document-source">Fonte relacionada</Label>
        <SelectField
          id="case-document-source"
          value={sourceId || undefined}
          onValueChange={setSourceId}
          placeholder="Sem vínculo específico"
          options={sources
            .filter((source) => source.id)
            .map((source) => ({ value: source.id!, label: source.titulo }))}
        />
      </div>
      <Button type="submit" className="md:col-span-2" disabled={!file || upload.isPending}>
        Enviar documento
      </Button>
    </form>
  );
}
