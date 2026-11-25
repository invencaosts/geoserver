"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DatasetMapConfig, DatasetMapMetadata } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { datasetColor } from "@/lib/dataset-map-presentation";
import { toast } from "sonner";

export function DatasetMapConfigSheet({
  metadata,
  onClose,
}: {
  metadata: DatasetMapMetadata;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<DatasetMapConfig>(metadata.config);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const fieldNames = metadata.fields.map((field) => field.name);

  async function save() {
    setSaving(true);
    try {
      const { publicFields, ...presentation } = config;
      await apiFetch(`/datasets/${encodeURIComponent(metadata.datasetId)}/map-config`, {
        method: "PATCH",
        body: metadata.canApproveFields ? { ...presentation, publicFields } : presentation,
      });
      await queryClient.invalidateQueries({ queryKey: ["dataset-map-metadata"] });
      toast.success("Apresentação da camada atualizada");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader eyebrow="Apresentação no mapa">
          <SheetTitle>{metadata.name}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <p className="text-xs text-muted-foreground">
            A configuração controla os pop-ups e a cor da camada. Salvar não publica o dataset.
          </p>
          <div className="space-y-2">
            <Label htmlFor="dataset-map-title">Campo usado no título</Label>
            <select
              id="dataset-map-title"
              className="w-full border border-input bg-background p-2 text-sm"
              value={config.titleField ?? ""}
              onChange={(event) => {
                const titleField = event.target.value || null;
                setConfig({
                  ...config,
                  titleField,
                  visibleFields:
                    titleField && config.visibleFields !== null
                      ? [...new Set([...config.visibleFields, titleField])]
                      : config.visibleFields,
                });
              }}
            >
              <option value="">Título genérico da feição</option>
              {metadata.fields.map((field) => (
                <option key={field.name} value={field.name}>
                  {config.labels[field.name] || field.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="dataset-map-color">Cor da camada</Label>
            <input
              id="dataset-map-color"
              type="color"
              value={config.color ?? datasetColor(metadata.datasetId)}
              onChange={(event) => setConfig({ ...config, color: event.target.value })}
            />
            <Button size="sm" variant="ghost" onClick={() => setConfig({ ...config, color: null })}>
              Automática
            </Button>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={config.visibleFields === null}
              onChange={(event) =>
                setConfig({ ...config, visibleFields: event.target.checked ? null : fieldNames })
              }
            />
            Mostrar todos os campos permitidos (apresentação genérica)
          </label>
          {metadata.canApproveFields && (
            <p className="text-xs text-muted-foreground">
              A coluna “Público” aprova quais atributos podem aparecer para visitantes e outros
              usuários quando o dataset estiver publicado. Nenhum campo é público por padrão.
            </p>
          )}
          <div className="space-y-3">
            {metadata.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Não há campos permitidos para configurar.
              </p>
            )}
            {metadata.fields.map((field) => (
              <div key={field.name} className="space-y-2 border-b border-border pb-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        config.visibleFields === null || config.visibleFields.includes(field.name)
                      }
                      onChange={(event) => {
                        const visible = config.visibleFields ?? fieldNames;
                        setConfig({
                          ...config,
                          titleField:
                            !event.target.checked && config.titleField === field.name
                              ? null
                              : config.titleField,
                          visibleFields: event.target.checked
                            ? [...new Set([...visible, field.name])]
                            : visible.filter((key) => key !== field.name),
                        });
                      }}
                    />
                    <span className="break-all">{field.name}</span>
                  </label>
                  {metadata.canApproveFields && (
                    <label className="flex shrink-0 items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={config.publicFields.includes(field.name)}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            publicFields: event.target.checked
                              ? [...config.publicFields, field.name]
                              : config.publicFields.filter((key) => key !== field.name),
                          })
                        }
                      />{" "}
                      Público
                    </label>
                  )}
                </div>
                <Input
                  aria-label={`Rótulo de ${field.name}`}
                  placeholder={field.label}
                  maxLength={120}
                  value={config.labels[field.name] ?? ""}
                  onChange={(event) => {
                    const labels = { ...config.labels };
                    if (event.target.value.trim()) labels[field.name] = event.target.value;
                    else delete labels[field.name];
                    setConfig({ ...config, labels });
                  }}
                />
                <p className="text-[11px] text-muted-foreground">Tipo: {field.type}</p>
              </div>
            ))}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando…" : "Salvar apresentação"}
          </Button>
          <Button disabled={saving} variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
