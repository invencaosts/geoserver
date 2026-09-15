"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Landmark, Search, Settings2 } from "lucide-react";
import { hasPermission } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TimelineView } from "@/components/timeline/timeline-view";
import { BRAZIL_UFS } from "@/lib/brazil-ufs";
import { normalizeSearch } from "@/lib/utils";
import { useTimeline, useTimelineEstados, type TimelineModo } from "@/lib/queries/timeline";

const MODO_OPTIONS: { value: TimelineModo; label: string }[] = [
  { value: "todos", label: "Tudo" },
  { value: "nacional", label: "Nacional" },
  { value: "estadual", label: "Estadual" },
];

export default function TimelinePage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user && hasPermission(user.role, "timeline:manage");
  const [modo, setModo] = useState<TimelineModo>("todos");
  const [estadosSelecionados, setEstadosSelecionados] = useState<string[]>([]);
  const [estadoQuery, setEstadoQuery] = useState("");

  const { data: estadosDisponiveis } = useTimelineEstados();
  const disponiveis = useMemo(() => new Set(estadosDisponiveis ?? []), [estadosDisponiveis]);
  const estadosAtivos = modo === "nacional" ? [] : estadosSelecionados;
  const { data, isLoading } = useTimeline(modo, estadosAtivos);

  const toggleEstado = (uf: string) => {
    if (!disponiveis.has(uf)) return;
    setEstadosSelecionados((prev) =>
      prev.includes(uf) ? prev.filter((e) => e !== uf) : [...prev, uf],
    );
  };

  const eventCount = useMemo(() => data?.events.length ?? 0, [data]);

  const ufsFiltrados = useMemo(() => {
    const q = normalizeSearch(estadoQuery.trim());
    if (!q) return BRAZIL_UFS;
    return BRAZIL_UFS.filter(
      (uf) => normalizeSearch(uf.sigla).includes(q) || normalizeSearch(uf.nome).includes(q),
    );
  }, [estadoQuery]);

  const estadoTriggerLabel =
    estadosSelecionados.length === 0
      ? "Todos os estados"
      : estadosSelecionados.length === 1
        ? estadosSelecionados[0]
        : `${estadosSelecionados.length} estados`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {isLoading ? "Carregando..." : `${eventCount} eventos`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canManage && (
            <div className="rounded-lg border border-border bg-muted/40 p-1">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                nativeButton={false}
                render={
                  <Link href="/timeline/gerenciar">
                    <Settings2 className="h-3.5 w-3.5" />
                    Gerenciar
                  </Link>
                }
              />
            </div>
          )}

          {modo !== "nacional" && (
            <DropdownMenu onOpenChange={(open) => !open && setEstadoQuery("")}>
              <div className="rounded-lg border border-border bg-muted/40 p-1">
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="ghost">
                      {estadoTriggerLabel}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
              <DropdownMenuContent className="max-h-96 w-64">
                <div className="relative px-1 pt-1 pb-1.5">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Buscar estado ou UF..."
                    value={estadoQuery}
                    onChange={(e) => setEstadoQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
                <DropdownMenuSeparator />
                {ufsFiltrados.length === 0 && (
                  <p className="px-1.5 py-2 text-center text-xs text-muted-foreground">
                    Nenhum estado encontrado.
                  </p>
                )}
                {ufsFiltrados.map((uf) => {
                  const disponivel = disponiveis.has(uf.sigla);
                  const item = (
                    <DropdownMenuCheckboxItem
                      key={uf.sigla}
                      checked={estadosSelecionados.includes(uf.sigla)}
                      onCheckedChange={() => toggleEstado(uf.sigla)}
                      closeOnClick={false}
                      className={
                        disponivel ? undefined : "cursor-not-allowed text-muted-foreground/50"
                      }
                    >
                      <span className="font-medium">{uf.sigla}</span>
                      <span className="text-muted-foreground">{uf.nome}</span>
                    </DropdownMenuCheckboxItem>
                  );
                  if (disponivel) return item;
                  return (
                    <Tooltip key={uf.sigla}>
                      <TooltipTrigger render={item} />
                      <TooltipContent side="left">
                        Ainda sem eventos cadastrados para {uf.nome}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {estadosSelecionados.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <button
                      className="w-full rounded-md px-1.5 py-1 text-left text-xs text-primary hover:bg-accent"
                      onClick={() => setEstadosSelecionados([])}
                    >
                      Limpar seleção
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {MODO_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={modo === opt.value ? "default" : "ghost"}
                onClick={() => setModo(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading || !data ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <TimelineView data={data} />
        )}
      </div>
    </div>
  );
}
