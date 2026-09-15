"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BRAZIL_UFS } from "@/lib/brazil-ufs";
import { normalizeSearch } from "@/lib/utils";

interface UfComboboxProps {
  value: string;
  onValueChange: (uf: string) => void;
  placeholder?: string;
}

export function UfCombobox({
  value,
  onValueChange,
  placeholder = "Selecione a UF",
}: UfComboboxProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    if (!q) return BRAZIL_UFS;
    return BRAZIL_UFS.filter(
      (uf) => normalizeSearch(uf.sigla).includes(q) || normalizeSearch(uf.nome).includes(q),
    );
  }, [query]);

  const selected = BRAZIL_UFS.find((uf) => uf.sigla === value);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        render={
          <Button type="button" size="sm" variant="outline" className="w-full justify-between">
            <span className={selected ? undefined : "text-muted-foreground"}>
              {selected ? `${selected.sigla} — ${selected.nome}` : placeholder}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-80 w-(--anchor-width)">
        <div className="relative px-1 pt-1 pb-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar estado ou UF..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <DropdownMenuSeparator />
        {filtered.length === 0 && (
          <p className="px-1.5 py-2 text-center text-xs text-muted-foreground">
            Nenhum estado encontrado.
          </p>
        )}
        {filtered.map((uf) => (
          <DropdownMenuItem key={uf.sigla} onClick={() => onValueChange(uf.sigla)}>
            <span className="font-medium">{uf.sigla}</span>
            <span className="text-muted-foreground">{uf.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
