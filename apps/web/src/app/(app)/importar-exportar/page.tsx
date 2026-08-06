"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDatasets, useDeleteDataset, useUploadDataset, datasetExportUrl } from "@/lib/queries/datasets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FORMATS = [
  { id: "shapefile", name: "Shapefile", ext: ".zip", icon: Database, accept: ".zip" },
  { id: "geojson", name: "GeoJSON", ext: ".geojson", icon: FileJson, accept: ".geojson,.json" },
  { id: "kml", name: "KML", ext: ".kml", icon: Globe, accept: ".kml" },
  { id: "kmz", name: "KMZ", ext: ".kmz", icon: Globe, accept: ".kmz" },
  { id: "csv", name: "CSV", ext: ".csv", icon: FileSpreadsheet, accept: ".csv" },
  { id: "pdf", name: "PDF", ext: ".pdf", icon: FileText, accept: ".pdf" },
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

export default function ImportarExportarPage() {
  const { data: datasets, isLoading } = useDatasets();
  const deleteDataset = useDeleteDataset();
  const [preselectFormat, setPreselectFormat] = useState<(typeof FORMATS)[number] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const total = datasets?.length ?? 0;
  const concluidos = datasets?.filter((d) => d.status === "active").length ?? 0;
  const processando = datasets?.filter((d) => d.status === "processing").length ?? 0;
  const exportaveis = datasets?.filter((d) => d.status === "active") ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total de operações" value={total} icon={ArrowLeftRight} loading={isLoading} />
        <StatCard label="Concluídas" value={concluidos} icon={CheckCircle2} tone="text-emerald-500" bg="bg-emerald-500/10" loading={isLoading} />
        <StatCard label="Processando" value={processando} icon={RefreshCw} tone="text-blue-500" bg="bg-blue-500/10" loading={isLoading} />
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
                <p className="text-xs text-muted-foreground">Selecione um formato e envie o arquivo pra processar</p>
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
                      className="flex flex-col items-center gap-2 border border-border p-4 text-center transition-colors hover:border-primary hover:bg-accent/40"
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
                    <UploadForm format={format} onDone={() => setUploadOpen(false)} />
                  </SheetBody>
                </SheetContent>
              </Sheet>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* exportar */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowDownToLine className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-sm font-semibold">Exportar dados</p>
              <p className="text-xs text-muted-foreground">Datasets ativos disponíveis pra download em GeoJSON</p>
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
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">{d.registros.toLocaleString("pt-BR")} registros</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  nativeButton={false}
                  render={
                    <a href={datasetExportUrl(d.id)} target="_blank" rel="noreferrer">
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      GeoJSON
                    </a>
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* histórico de operações */}
      <div className="space-y-2.5">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Histórico de operações
        </p>

        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[68px] w-full rounded-xl" />)}

        {datasets?.map((d) => {
          const Icon = STATUS_ICON[d.status];
          const tone = STATUS_TONE[d.status];
          return (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone.chip)}>
                    <Icon className={cn("h-4 w-4", tone.icon, d.status === "processing" && "animate-spin")} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Importação · {d.formato}
                      {d.erro && <span className="text-destructive"> · {d.erro}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={d.status === "error" ? "destructive" : d.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABEL[d.status]}
                  </Badge>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteDataset.mutate(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
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
          {loading ? <Skeleton className="h-8 w-10" /> : <p className="text-3xl font-bold tracking-tight">{value}</p>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", bg)}>
          <Icon className={cn("h-5 w-5", tone)} />
        </div>
      </CardContent>
    </Card>
  );
}

function UploadForm({ format, onDone }: { format: (typeof FORMATS)[number]; onDone: () => void }) {
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadDataset();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      await upload.mutateAsync({ nome, file });
      toast.success("Importação iniciada. Acompanhe o status no histórico abaixo.");
      setNome("");
      setFile(null);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ie-nome">Nome do dataset</Label>
        <Input id="ie-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ie-arquivo">Arquivo ({format.ext})</Label>
        <Input id="ie-arquivo" type="file" accept={format.accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        {format.id === "shapefile" && (
          <p className="text-xs text-muted-foreground">Envie um .zip contendo .shp/.dbf/.shx</p>
        )}
        {format.id === "csv" && (
          <p className="text-xs text-muted-foreground">O CSV precisa de colunas de latitude/longitude</p>
        )}
        {format.id === "pdf" && (
          <p className="text-xs text-muted-foreground">PDF fica guardado como documento, sem geometria no mapa</p>
        )}
      </div>
      <Button type="submit" className="w-full gap-2" disabled={upload.isPending}>
        <Upload className="h-4 w-4" />
        {upload.isPending ? "Enviando..." : "Importar"}
      </Button>
    </form>
  );
}
