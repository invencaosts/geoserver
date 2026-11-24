import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "mark";
  className?: string;
};

export function BrandLogo({ variant = "full", className }: BrandLogoProps) {
  return (
    <span
      role="img"
      aria-label="Observatório Grilagem de Terras"
      className={cn("brand-logo", `brand-logo--${variant}`, className)}
    />
  );
}
