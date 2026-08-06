"use client";

import { useEffect, useState } from "react";
import { GraduationCap, School } from "lucide-react";
import type { InstituicaoTipo } from "@geo/shared";
import { Input } from "@/components/ui/input";
import { useSearchInstituicoes } from "@/lib/queries/instituicoes";

const TIPO_LABEL: Record<InstituicaoTipo, string> = {
  educacao_basica: "Educação básica",
  educacao_superior: "Educação superior",
};

interface InstitutionAutocompleteProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Campo de texto com sugestões de instituições de ensino (INEP: Censo Escolar +
 * Censo da Educação Superior). Aceita texto livre — a instituição pode não estar na base.
 */
export function InstitutionAutocomplete({
  id,
  value,
  onValueChange,
  placeholder,
  required,
}: InstitutionAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [freeText, setFreeText] = useState(false);
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 250);
    return () => clearTimeout(t);
  }, [value]);

  const { data, isFetching } = useSearchInstituicoes(debounced);
  const showDropdown = open && !freeText && debounced.trim().length >= 2;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) setFreeText(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
          {isFetching && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>}
          {!isFetching && data?.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Nenhuma instituição encontrada na base do INEP.
            </p>
          )}
          {data?.map((inst, i) => (
            <button
              key={`${inst.nome}-${inst.municipio}-${i}`}
              type="button"
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValueChange(inst.nome);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-1.5">
                {inst.tipo === "educacao_superior" ? (
                  <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <School className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                {inst.nome}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {inst.municipio}/{inst.uf} · {TIPO_LABEL[inst.tipo]}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="w-full border-t border-border px-3 py-2 text-left text-xs font-medium text-primary hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setFreeText(true);
              setOpen(false);
            }}
          >
            Não encontrei minha instituição
          </button>
        </div>
      )}
    </div>
  );
}
