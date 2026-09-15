"use client";

import { useRef } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, type FormFieldProps } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";

type FieldShellProps = Omit<FormFieldProps, "children" | "htmlFor"> & { id: string };

/** Input de texto/número padronizado — FormField + Input, só passa a peculiaridade. */
export function TextField({
  id,
  label,
  info,
  error,
  required,
  className,
  ...inputProps
}: FieldShellProps & React.ComponentProps<typeof Input>) {
  return (
    <FormField htmlFor={id} label={label} info={info} error={error} required={required}>
      <Input id={id} aria-invalid={!!error} {...inputProps} />
    </FormField>
  );
}

/** Textarea padronizado. */
export function TextAreaField({
  id,
  label,
  info,
  error,
  required,
  ...textareaProps
}: FieldShellProps & React.ComponentProps<typeof Textarea>) {
  return (
    <FormField htmlFor={id} label={label} info={info} error={error} required={required}>
      <Textarea id={id} aria-invalid={!!error} {...textareaProps} />
    </FormField>
  );
}

/** Select padronizado (usa o SelectField já existente no design system). */
export function SelectFormField<T extends string>({
  id,
  label,
  info,
  error,
  required,
  value,
  onValueChange,
  options,
  placeholder,
}: FieldShellProps & {
  value?: T;
  onValueChange: (value: T) => void;
  options: SelectFieldOption<T>[];
  placeholder?: string;
}) {
  return (
    <FormField htmlFor={id} label={label} info={info} error={error} required={required}>
      <SelectField
        id={id}
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
      />
    </FormField>
  );
}

/**
 * Input de arquivo padronizado: esconde o <input type="file"> nativo (feio, some
 * conforme o browser) atrás de um botão no estilo do sistema + nome do arquivo escolhido.
 */
export function FileField({
  id,
  label,
  info,
  error,
  required,
  accept,
  file,
  onFileChange,
  buttonLabel = "Selecionar arquivo",
  hint,
}: FieldShellProps & {
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  buttonLabel?: string;
  hint?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <FormField htmlFor={id} label={label} info={info} error={error} required={required}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
          {buttonLabel}
        </Button>
        <span className="truncate text-xs text-muted-foreground">
          {file?.name ?? "Nenhum arquivo escolhido"}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </FormField>
  );
}
