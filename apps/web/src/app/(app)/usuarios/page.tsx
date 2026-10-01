"use client";

import {
  hasPermission,
  RESEARCHER_ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ROLES,
  type RoleName,
} from "@geo/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { useUpdateUser, useUsers } from "@/lib/queries/users";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Cores seguindo a planilha de hierarquia enviada pelo projeto.
const ROLE_TONE: Record<RoleName, string> = {
  admin: "bg-red-500/15 text-red-500",
  verificador: "bg-violet-500/15 text-violet-500",
  pesquisador_envio_download: "bg-cyan-500/15 text-cyan-600",
  pesquisador_envio: "bg-blue-500/15 text-blue-500",
  visualizador: "bg-orange-500/15 text-orange-500",
};

export default function UsuariosPage() {
  const { data: users, isLoading } = useUsers();
  const updateUser = useUpdateUser();
  const currentUser = useAuthStore((s) => s.user);
  // Admin gerencia tudo; verificador só alterna contas entre visualizador e pesquisadores.
  const isAdmin = !!currentUser && hasPermission(currentUser.role, "user:manage");
  const assignableRoles: readonly RoleName[] = isAdmin ? ROLES : RESEARCHER_ASSIGNABLE_ROLES;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardContent className="grid gap-1.5 px-4 py-3.5 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">Hierarquia de acesso</p>
          {ROLES.map((role) => (
            <p key={role}>
              <span className="font-medium text-foreground">{ROLE_LABEL[role]}</span> —{" "}
              {ROLE_DESCRIPTION[role]}
            </p>
          ))}
          <p className="pt-1">
            Contas novas entram como Visualizador.{" "}
            {isAdmin
              ? "Você pode atribuir qualquer papel."
              : "Você pode alternar contas entre Visualizador e os dois níveis de Pesquisador."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-2.5">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}

        {users?.map((u) => {
          const initials = u.nome
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0]?.toUpperCase())
            .join("");
          const isSelf = u.id === currentUser?.id;
          const canEditRole = !isSelf && assignableRoles.includes(u.role);
          return (
            <Card key={u.id} className="transition-colors hover:bg-accent/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-1 ring-border">
                    <AvatarFallback className={cn("font-medium", ROLE_TONE[u.role])}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{u.nome}</p>
                      {isSelf && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          você
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {canEditRole ? (
                    <SelectField
                      className="w-[232px] text-xs"
                      value={u.role}
                      onValueChange={(role) =>
                        updateUser.mutate(
                          { id: u.id, data: { role } },
                          {
                            onSuccess: () => toast.success(`${u.nome}: ${ROLE_LABEL[role]}`),
                            onError: (err) => toast.error(err.message),
                          },
                        )
                      }
                      options={assignableRoles.map((role) => ({
                        value: role,
                        label: ROLE_LABEL[role],
                      }))}
                    />
                  ) : (
                    <Badge
                      variant="outline"
                      className="font-normal"
                      title={ROLE_DESCRIPTION[u.role]}
                    >
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                      <Switch
                        checked={u.status === "ativo"}
                        disabled={isSelf}
                        onCheckedChange={(checked) =>
                          updateUser.mutate({
                            id: u.id,
                            data: { status: checked ? "ativo" : "inativo" },
                          })
                        }
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          u.status === "ativo" ? "text-emerald-500" : "text-muted-foreground",
                        )}
                      >
                        {u.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
