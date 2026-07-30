"use client";

import { useState } from "react";
import { Plus, Trash2, Layers as LayersIcon, Globe, Database, ImageIcon, MapPin } from "lucide-react";
import type { LayerCategory, LayerType } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateLayer, useDeleteLayer, useLayers, useUpdateLayer } from "@/lib/queries/layers";

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
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}

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
                    onCheckedChange={(visivel) => updateLayer.mutate({ id: layer.id, data: { visivel } })}
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
                <Badge variant="secondary" className="text-[10px]">{layer.tipo}</Badge>
                <Badge variant="outline" className="text-[10px]">{layer.categoria}</Badge>
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

function NewLayerDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<LayerType>("WMS");
  const [categoria, setCategoria] = useState<LayerCategory>("overlay");
  const [url, setUrl] = useState("");
  const [fonte, setFonte] = useState("");
  const createLayer = useCreateLayer();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createLayer.mutateAsync({ nome, tipo, categoria, url, fonte });
    setNome("");
    setUrl("");
    setFonte("");
    setOpen(false);
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
          <div className="space-y-2">
            <Label htmlFor="layer-nome">Nome</Label>
            <Input id="layer-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as LayerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WMS">WMS</SelectItem>
                  <SelectItem value="WFS">WFS</SelectItem>
                  <SelectItem value="WCS">WCS</SelectItem>
                  <SelectItem value="Vector">Vetor</SelectItem>
                  <SelectItem value="Raster">Raster</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as LayerCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="overlay">Overlay</SelectItem>
                  <SelectItem value="analysis">Análise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="layer-url">URL do serviço</Label>
            <Input id="layer-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="layer-fonte">Fonte</Label>
            <Input id="layer-fonte" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="IBGE, INPE..." required />
          </div>
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
