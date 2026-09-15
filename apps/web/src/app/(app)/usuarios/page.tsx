"use client";

import type { RoleName } from "@geo/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApproveRole, useUpdateUser, useUsers } from "@/lib/queries/users";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<RoleName, string> = {
  admin: "Administrador",
  verificador: "Verificador",
  contribuidor: "Contribuidor",
  leitor: "Leitor",
};

const ROLE_TONE: Record<RoleName, string> = {
  admin: "bg-primary/15 text-primary",
  verificador: "bg-violet-500/15 text-violet-500",
  contribuidor: "bg-blue-500/15 text-blue-500",
  leitor: "bg-muted text-muted-foreground",
};

export default function UsuariosPage() {
  const { data: users, isLoading } = useUsers();
  const updateUser = useUpdateUser();
  const approveRole = useApproveRole();
  const currentUser = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
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
                      {u.roleApprovalStatus === "pendente" && (
                        <Badge className="bg-amber-500/15 text-[10px] font-normal text-amber-600">
                          solicitou {ROLE_LABEL[u.requestedRole]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {u.roleApprovalStatus === "pendente" && !isSelf && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={approveRole.isPending}
                        onClick={() => approveRole.mutate({ id: u.id, decision: "aprovado" })}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={approveRole.isPending}
                        onClick={() => approveRole.mutate({ id: u.id, decision: "rejeitado" })}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                  <SelectField
                    className="w-[168px] text-xs"
                    value={u.role}
                    disabled={isSelf}
                    onValueChange={(role) => updateUser.mutate({ id: u.id, data: { role } })}
                    options={Object.entries(ROLE_LABEL).map(([value, label]) => ({
                      value: value as RoleName,
                      label,
                    }))}
                  />

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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
