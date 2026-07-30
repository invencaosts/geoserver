"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Camera, ChevronsUpDown, LogOut, MapPinned, PanelLeft } from "lucide-react";
import { hasPermission } from "@geo/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { useUploadAvatar } from "@/lib/queries/profile";
import { NAV_ITEMS } from "./nav-config";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  verificador: "Verificador",
  contribuidor: "Contribuidor",
  leitor: "Leitor",
};

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const uploadAvatar = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleLogout() {
    clear();
    router.push("/login");
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    toast.promise(uploadAvatar.mutateAsync(file), {
      loading: "Enviando foto...",
      success: "Foto atualizada",
      error: (err) => (err instanceof Error ? err.message : "Falha ao enviar foto"),
    });
  }

  const initials = user?.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const visibleItems = NAV_ITEMS.filter(
    (item) => !user || hasPermission(user.role, item.permission),
  );

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-[76px]" : "w-[252px]",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/70", collapsed ? "justify-center px-0" : "justify-between px-4")}>
        <div className={cn("flex min-w-0 items-center gap-2.5", collapsed && "justify-center")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-primary-foreground">
            <MapPinned className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="truncate font-display text-[14.5px] font-bold tracking-tight text-sidebar-foreground">
              Grilagem GIS
            </span>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-7 w-7 shrink-0 rounded-none text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const link = (
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 border-l-2 px-4 py-2.5 text-[13.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-transparent text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.9} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (!collapsed) return <div key={item.href}>{link}</div>;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/70 p-3">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarFile} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={cn(
                  "flex w-full items-center gap-3 p-1.5 text-left transition-colors hover:bg-sidebar-accent/60",
                  collapsed && "justify-center",
                )}
              >
                <div className="relative shrink-0">
                  <Avatar size="lg" className="h-11 w-11">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.nome} />}
                    <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-[13px] font-semibold text-sidebar-foreground">{user?.nome}</p>
                      <p className="truncate text-[11.5px] text-sidebar-foreground/50">
                        {user ? ROLE_LABEL[user.role] : ""}
                      </p>
                    </div>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/35" />
                  </>
                )}
              </button>
            }
          />
          <DropdownMenuContent align="end" side="top" className="w-60 rounded-none">
            <div className="px-2 py-2 text-xs text-muted-foreground">{user?.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" />
              Alterar foto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="gap-2.5 text-destructive">
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
