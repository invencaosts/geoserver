"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CaseTipo } from "@geo/shared";
import { CASE_TIPO_LABEL } from "@geo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyProfile, useUpdateProfile } from "@/lib/queries/profile";
import { toast } from "sonner";

const AREAS: CaseTipo[] = ["institucional", "titulo_falso", "car"];

export default function PerfilPage() {
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [nomeSocial, setNomeSocial] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [idiomas, setIdiomas] = useState<string[]>([]);
  const [novoIdioma, setNovoIdioma] = useState("");
  const [areasInteresse, setAreasInteresse] = useState<CaseTipo[]>([]);

  useEffect(() => {
    if (!profile) return;
    setNomeSocial(profile.nomeSocial ?? "");
    setTelefone(profile.telefone ?? "");
    setInstituicao(profile.instituicao ?? "");
    setEndereco(profile.endereco ?? "");
    setIdiomas(profile.idiomas ?? []);
    setAreasInteresse(profile.areasInteresse ?? []);
  }, [profile]);

  function addIdioma() {
    const v = novoIdioma.trim();
    if (v && !idiomas.includes(v)) setIdiomas((cur) => [...cur, v]);
    setNovoIdioma("");
  }

  function toggleArea(area: CaseTipo, checked: boolean) {
    setAreasInteresse((cur) => (checked ? [...cur, area] : cur.filter((a) => a !== area)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        nomeSocial: nomeSocial || undefined,
        telefone: telefone || undefined,
        instituicao: instituicao || undefined,
        endereco: endereco || undefined,
        idiomas,
        areasInteresse,
      });
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar perfil");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-email">E-mail</Label>
            <Input id="p-email" value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-nome-social">Nome social</Label>
            <Input id="p-nome-social" value={nomeSocial} onChange={(e) => setNomeSocial(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-telefone">Telefone</Label>
            <Input id="p-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instituição e endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-instituicao">Instituição</Label>
            <Input id="p-instituicao" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-endereco">Endereço</Label>
            <Input id="p-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idiomas conhecidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {idiomas.map((idioma) => (
              <Badge key={idioma} variant="secondary" className="gap-1 pr-1">
                {idioma}
                <button
                  type="button"
                  onClick={() => setIdiomas((cur) => cur.filter((i) => i !== idioma))}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={novoIdioma}
              onChange={(e) => setNovoIdioma(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addIdioma();
                }
              }}
              placeholder="Ex: Português, Guarani..."
            />
            <Button type="button" variant="outline" onClick={addIdioma}>Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Áreas de interesse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Você recebe notificação quando um novo caso desses tipos é registrado.
          </p>
          {AREAS.map((area) => (
            <label key={area} className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={areasInteresse.includes(area)}
                onCheckedChange={(checked) => toggleArea(area, checked === true)}
              />
              {CASE_TIPO_LABEL[area]}
            </label>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={updateProfile.isPending}>
        {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
