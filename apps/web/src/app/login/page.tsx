"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, MapPinned, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLogin, useRegister } from "@/lib/queries/auth";
import { toast } from "sonner";

const HIGHLIGHTS = [
  { icon: MapPinned, title: "Mapa territorial em tempo real", desc: "Camadas geoespaciais e casos plotados sobre PostGIS" },
  { icon: Database, title: "Dados que chegam prontos", desc: "Shapefile, GeoJSON, KML e CSV processados automaticamente" },
  { icon: ShieldCheck, title: "Acesso sob controle", desc: "Workflow de validação com auditoria e papéis de acesso" },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login.mutateAsync({ email, senha });
      } else {
        await register.mutateAsync({ nome, email, senha });
      }
      router.push("/mapa");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* painel de marca */}
      <div className="relative hidden overflow-hidden bg-[oklch(0.16_0.02_240)] lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-violet-500/15 blur-[110px]" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/30">
            <MapPinned className="h-4.5 w-4.5" />
          </div>
          <span className="text-sm font-semibold text-white">Grilagem GIS</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
              <AlertTriangle className="h-3 w-3 text-primary" />
              Monitoramento territorial colaborativo
            </span>
            <h2 className="text-3xl font-semibold leading-tight text-white">
              Vigilância geoespacial contra grilagem de terras
            </h2>
            <p className="text-sm leading-relaxed text-white/50">
              Uma plataforma única pra registrar, validar e acompanhar ocorrências com dados georreferenciados de verdade.
            </p>
          </div>

          <div className="space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-primary">
                  <h.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{h.title}</p>
                  <p className="text-xs text-white/45">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/30">Plataforma interna · dados sensíveis, acesso restrito</p>
      </div>

      {/* painel do formulário */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5 lg:hidden">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
              <MapPinned className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "login" ? "Entrar na plataforma" : "Criar sua conta"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Acesse com seu e-mail e senha cadastrados."
                : "O primeiro usuário do sistema vira administrador automaticamente."}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar conta</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
