"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FolderOpen,
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
  useDatasets,
  useDeleteDataset,
  useUploadDataset,
  datasetExportUrl,
} from "@/lib/queries/datasets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_ICON: Record<string, React.ElementType> = {
  active: CheckCircle2,
  processing: RefreshCw,
  error: AlertCircle,
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  processing: "Processando",
  error: "Erro",
};

const STATUS_TONE: Record<string, { icon: string; chip: string }> = {
  active: { icon: "text-emerald-500", chip: "bg-emerald-500/10" },
  processing: { icon: "text-blue-500", chip: "bg-blue-500/10" },
  error: { icon: "text-red-500", chip: "bg-red-500/10" },
};

export default function DadosPage() {
  const { data: datasets, isLoading } = useDatasets();
  const deleteDataset = useDeleteDataset();

  const totalRegistros = datasets?.reduce((sum, d) => sum + d.registros, 0) ?? 0;
  const ativos = datasets?.filter((d) => d.status === "active").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-6">
          <Metric label="Datasets" value={datasets?.length ?? 0} loading={isLoading} />
          <Metric label="Ativos" value={ativos} loading={isLoading} />
          <Metric
            label="Registros"
            value={totalRegistros.toLocaleString("pt-BR")}
            loading={isLoading}
          />
        </div>
        <UploadDialog />
      </div>

      <div className="grid gap-2.5">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}

        {!isLoading && datasets?.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Nenhum dataset importado ainda</p>
                <p className="text-xs text-muted-foreground">
                  Importe um Shapefile, GeoJSON, KML ou CSV pra começar.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {datasets?.map((d) => {
          const Icon = STATUS_ICON[d.status];
          const tone = STATUS_TONE[d.status];
          return (
            <Card key={d.id} className="transition-colors hover:bg-accent/30">
              <CardContent className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      tone.chip,
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        tone.icon,
                        d.status === "processing" && "animate-spin",
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.registros.toLocaleString("pt-BR")} registros · {d.tipoGeometria}
                      {d.erro && <span className="text-destructive"> · {d.erro}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {d.formato}
                  </Badge>
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
                  {d.status === "active" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      nativeButton={false}
                      render={
                        <a href={datasetExportUrl(d.id)} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteDataset.mutate(d.id)}
                  >
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

function Metric({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Database className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        {loading ? (
          <Skeleton className="h-5 w-8" />
        ) : (
          <p className="text-lg font-semibold">{value}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadDataset();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      await upload.mutateAsync({ nome, file });
      toast.success("Dataset enviado. Processamento em andamento.");
      setOpen(false);
      setNome("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader eyebrow="Dados espaciais · nova importação">
          <SheetTitle>Importar dados espaciais</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-nome">Nome do dataset</Label>
              <Input
                id="dataset-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataset-arquivo">Arquivo</Label>
              <Input
                id="dataset-arquivo"
                type="file"
                accept=".zip,.geojson,.json,.kml,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Shapefile: envie um .zip contendo .shp/.dbf/.shx. CSV precisa de colunas lat/lng.
              </p>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="w-full" disabled={upload.isPending}>
              {upload.isPending ? "Enviando..." : "Importar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
