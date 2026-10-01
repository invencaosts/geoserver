"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPinned, ShieldOff } from "lucide-react";
import { userHasPermission } from "@geo/shared";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppHeader } from "@/components/app-shell/app-header";
import { NAV_ITEMS, RESTRICTED_ROUTES } from "@/components/app-shell/nav-config";
import { useAuthStore } from "@/lib/auth-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => setHydrated(true), []);

  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  // A rota mais específica vence: /timeline/gerenciar antes de /timeline.
  const restricted = RESTRICTED_ROUTES.find((route) => pathname.startsWith(route.href)) ?? current;
  const allowed = restricted?.permission
    ? userHasPermission(user, restricted.permission)
    : !restricted || !!user;

  useEffect(() => {
    // Visitante sem permissão para a rota vai para o login; logado sem permissão vê o aviso.
    if (hydrated && !user && !allowed) router.replace("/login");
  }, [hydrated, user, allowed, router]);

  if (!hydrated || (!user && !allowed)) {
    return (
      <div className="flex h-screen items-center justify-center gap-2.5 bg-background text-sm text-muted-foreground">
        <MapPinned className="h-4 w-4 animate-pulse text-primary" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          title={current?.label ?? "Observatório Grilagem de Terras"}
          subtitle={current?.subtitle}
        />
        <main className="min-h-0 flex-1 overflow-auto">
          {allowed ? (
            children
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <ShieldOff className="h-5 w-5" />
              Seu papel não tem acesso a esta página.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
