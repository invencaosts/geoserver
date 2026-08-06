"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectFieldOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  /** Omita para um select "sem seleção travada" (ex: menu de ação que sempre volta a mostrar o placeholder). */
  value?: T;
  onValueChange: (value: T) => void;
  options: SelectFieldOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Select padrão do app: ocupa a largura toda (como um Input normal) e sempre
 * mostra o label mapeado, nunca o valor cru do enum/banco.
 */
export function SelectField<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  id,
  className,
}: SelectFieldProps<T>) {
  const labelByValue = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <Select
      {...(value !== undefined ? { value } : {})}
      onValueChange={(v) => v != null && onValueChange(v as T)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue>{(v: string | null) => (v ? (labelByValue[v] ?? v) : (placeholder ?? ""))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
