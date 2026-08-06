"use client";

import { useTheme } from "next-themes";
import { Bell, CheckCheck, Contrast, Moon, Sun } from "lucide-react";
import { NOTIFICATION_TIPO_LABEL } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/lib/queries/notifications";
import { cn } from "@/lib/utils";

const THEME_ICON = { light: Sun, dark: Moon, contraste: Contrast } as const;

function NotificationBell() {
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-none">
            <Bell className="h-[18px] w-[18px]" />
            {!!unreadCount && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 rounded-none p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notificações</span>
          {!!unreadCount && (
            <button
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3 w-3" /> marcar todas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {!notifications || notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Nenhuma notificação ainda.</p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn("flex-col items-start gap-0.5 whitespace-normal py-2.5", !n.lida && "bg-accent/40")}
                onClick={() => !n.lida && markRead.mutate(n.id)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {NOTIFICATION_TIPO_LABEL[n.tipo]}
                  </span>
                  {!n.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="text-[13px] font-medium leading-snug">{n.titulo}</p>
                <p className="text-[12px] leading-snug text-muted-foreground">{n.mensagem}</p>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICON[(theme as keyof typeof THEME_ICON) ?? "dark"] ?? Moon;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-foreground/90 bg-background px-7">
      <div className="leading-tight">
        <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none">
                <Icon className="h-[18px] w-[18px]" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44 rounded-none">
            <DropdownMenuItem className="gap-2.5" onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4" /> Claro
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5" onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4" /> Escuro
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5" onClick={() => setTheme("contraste")}>
              <Contrast className="h-4 w-4" /> Alto contraste
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
