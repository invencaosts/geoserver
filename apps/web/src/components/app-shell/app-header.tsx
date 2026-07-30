"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-foreground/90 bg-background px-7">
      <div className="leading-tight">
        <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 rounded-none"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-[18px] w-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-[18px] w-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </Button>
    </header>
  );
}
