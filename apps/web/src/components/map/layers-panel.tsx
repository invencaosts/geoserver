"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Layers as LayersIcon,
  Globe,
  Database,
  ImageIcon,
  MapPin,
} from "lucide-react";
import type { LayerCategory, LayerType } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SelectFormField, TextField } from "@/components/ui/form-fields";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateLayer, useDeleteLayer, useLayers, useUpdateLayer } from "@/lib/queries/layers";
import { toast } from "sonner";

const TYPE_ICON: Record<LayerType, React.ElementType> = {
  WMS: Globe,
  WFS: Database,
  WCS: ImageIcon,
  Vector: MapPin,
  Raster: LayersIcon,
};

export function LayersPanel() {
  const { data: layers, isLoading } = useLayers();
  const updateLayer = useUpdateLayer();
  const deleteLayer = useDeleteLayer();

  return (
    <div className="glass-panel flex max-h-[calc(100vh-7rem)] w-80 flex-col rounded-xl">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <span className="text-sm font-semibold">Camadas</span>
        <NewLayerDialog />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}

        {!isLoading && layers?.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nenhuma camada cadastrada ainda.
          </p>
        )}

        {layers?.map((layer) => {
          const Icon = TYPE_ICON[layer.tipo];
          return (
            <Card key={layer.id} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Switch
                    checked={layer.visivel}
                    onCheckedChange={(visivel) =>
                      updateLayer.mutate({ id: layer.id, data: { visivel } })
                    }
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{layer.nome}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteLayer.mutate(layer.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {layer.tipo}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {layer.categoria}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Opacidade</span>
                  <span>{layer.opacidade}%</span>
                </div>
                <Slider
                  value={[layer.opacidade]}
                  max={100}
                  step={5}
                  onValueChange={(v) =>
                    updateLayer.mutate({
                      id: layer.id,
                      data: { opacidade: Array.isArray(v) ? v[0] : v },
                    })
                  }
                />
              </div>

              <p className="truncate text-[11px] text-muted-foreground">Fonte: {layer.fonte}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface LayerFormErrors {
  nome?: string;
  url?: string;
  fonte?: string;
}

function validateLayerForm(nome: string, url: string, fonte: string): LayerFormErrors {
  const errors: LayerFormErrors = {};
  if (!nome.trim()) {
    errors.nome = "Informe o nome da camada";
  } else if (nome.trim().length < 2) {
    errors.nome = "Nome muito curto (mínimo 2 caracteres)";
  }
  if (url.trim() && !/^https?:\/\/.+/i.test(url.trim())) {
    errors.url = "URL deve começar com http:// ou https://";
  }
  if (!fonte.trim()) {
    errors.fonte = "Informe a fonte dos dados";
  }
  return errors;
}

function NewLayerDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<LayerType>("WMS");
  const [categoria, setCategoria] = useState<LayerCategory>("overlay");
  const [url, setUrl] = useState("");
  const [fonte, setFonte] = useState("");
  const [errors, setErrors] = useState<LayerFormErrors>({});
  const createLayer = useCreateLayer();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateLayerForm(nome, url, fonte);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      toast.error("Confere os campos destacados antes de salvar");
      return;
    }
    try {
      await createLayer.mutateAsync({ nome, tipo, categoria, url, fonte });
      setNome("");
      setUrl("");
      setFonte("");
      setErrors({});
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar camada");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <Plus className="h-3.5 w-3.5" />
            Nova
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader eyebrow="Camadas · nova entrada">
          <SheetTitle>Adicionar camada</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <TextField
              id="layer-nome"
              label="Nome"
              info="Nome de exibição da camada no painel. Obrigatório, mínimo 2 caracteres."
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErrors((prev) => ({ ...prev, nome: undefined }));
              }}
              error={errors.nome}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectFormField<LayerType>
                id="layer-tipo"
                label="Tipo"
                info="Protocolo/formato da fonte geoespacial. WMS/WFS/WCS são serviços web; Vetor/Raster são dados já processados no sistema."
                value={tipo}
                onValueChange={setTipo}
                options={[
                  { value: "WMS", label: "WMS" },
                  { value: "WFS", label: "WFS" },
                  { value: "WCS", label: "WCS" },
                  { value: "Vector", label: "Vetor" },
                  { value: "Raster", label: "Raster" },
                ]}
              />
              <SelectFormField<LayerCategory>
                id="layer-categoria"
                label="Categoria"
                info='Como a camada aparece agrupada no mapa: "Base" (fundo), "Overlay" (sobreposta) ou "Análise" (derivada de processamento).'
                value={categoria}
                onValueChange={setCategoria}
                options={[
                  { value: "base", label: "Base" },
                  { value: "overlay", label: "Overlay" },
                  { value: "analysis", label: "Análise" },
                ]}
              />
            </div>
            <TextField
              id="layer-url"
              label="URL do serviço"
              info="Opcional. Endereço do serviço WMS/WFS/WCS que fornece a camada. Se preenchido, precisa começar com http:// ou https://."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setErrors((prev) => ({ ...prev, url: undefined }));
              }}
              error={errors.url}
              placeholder="https://..."
            />
            <TextField
              id="layer-fonte"
              label="Fonte"
              info="Órgão ou origem dos dados dessa camada (ex: IBGE, INPE, INCRA). Obrigatório."
              value={fonte}
              onChange={(e) => {
                setFonte(e.target.value);
                setErrors((prev) => ({ ...prev, fonte: undefined }));
              }}
              error={errors.fonte}
              placeholder="IBGE, INPE..."
              required
            />
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="w-full" disabled={createLayer.isPending}>
              Adicionar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
