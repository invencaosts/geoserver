"use client";

import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  /** Precisa bater com o id do controle passado em children pra o <label> funcionar. */
  htmlFor?: string;
  label: string;
  /** Texto do tooltip do ícone "i": o que é o campo, o que informar, e a regra de validação. */
  info?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Padroniza todo campo de formulário do app: label + ícone de info (explica o campo
 * e a validação) + o controle em si + mensagem de erro. Use com Input/Textarea/Select
 * dentro de children — o FormField só cuida do entorno.
 */
export function FormField({
  htmlFor,
  label,
  info,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {info && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Sobre o campo ${label}`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              }
            />
            <TooltipContent side="top" className="max-w-64">
              {info}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
