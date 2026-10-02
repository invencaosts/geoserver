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
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyProfile, useUpdateProfile } from "@/lib/queries/profile";
import { toast } from "sonner";
import { BRAZIL_UFS } from "@/lib/brazil-ufs";

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
  const [onboarding, setOnboarding] = useState({
    municipio: "",
    estado: "",
    escolaridade: "",
    perfilUsuario: "",
    perfilUsuarioOutro: "",
    possuiVinculo: false,
    instituicaoCnpj: "",
    instituicaoNome: "",
    instituicaoEmail: "",
    tipoVinculo: "",
    tipoVinculoOutro: "",
    comoConheceu: "",
    comoConheceuOutro: "",
    finalidadeAcesso: "",
    finalidadeAcessoOutro: "",
  });
  const [researcher, setResearcher] = useState({
    emailProfissional: "",
    telefoneWhatsapp: "",
    instituicaoNome: "",
    instituicaoCnpj: "",
    instituicaoEmail: "",
    tipoVinculo: "",
    cargoFuncao: "",
    estadoAtuacao: "",
    municipioAtuacao: "",
    perfilProfissional: "",
    nivelFormacao: "",
    finalidadeUso: "",
    lattes: "",
    orcid: "",
    institucional: "",
    paginaProfissional: "",
    outroLink: "",
  });

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza o formulário editável quando a consulta assíncrona carrega outro perfil */
  useEffect(() => {
    if (!profile) return;
    setNomeSocial(profile.nomeSocial ?? "");
    setTelefone(profile.telefone ?? "");
    setInstituicao(profile.instituicao ?? "");
    setEndereco(profile.endereco ?? "");
    setIdiomas(profile.idiomas ?? []);
    setAreasInteresse(profile.areasInteresse ?? []);
    const onboardingProfile = profile.onboardingProfile;
    setOnboarding({
      municipio: onboardingProfile?.municipio ?? "",
      estado: onboardingProfile?.estado ?? "",
      escolaridade: onboardingProfile?.escolaridade ?? "",
      perfilUsuario: onboardingProfile?.perfilUsuario ?? "",
      perfilUsuarioOutro: onboardingProfile?.perfilUsuarioOutro ?? "",
      possuiVinculo: onboardingProfile?.possuiVinculo ?? false,
      instituicaoCnpj: onboardingProfile?.instituicaoCnpj ?? "",
      instituicaoNome: onboardingProfile?.instituicaoNome ?? "",
      instituicaoEmail: onboardingProfile?.instituicaoEmail ?? "",
      tipoVinculo: onboardingProfile?.tipoVinculo ?? "",
      tipoVinculoOutro: onboardingProfile?.tipoVinculoOutro ?? "",
      comoConheceu: onboardingProfile?.comoConheceu ?? "",
      comoConheceuOutro: onboardingProfile?.comoConheceuOutro ?? "",
      finalidadeAcesso: onboardingProfile?.finalidadeAcesso ?? "",
      finalidadeAcessoOutro: onboardingProfile?.finalidadeAcessoOutro ?? "",
    });
    const researcherProfile = profile.researcherProfile;
    const link = (type: string) =>
      researcherProfile?.links?.find((item) => item.tipo === type)?.url ?? "";
    setResearcher({
      emailProfissional: researcherProfile?.emailProfissional ?? "",
      telefoneWhatsapp: researcherProfile?.telefoneWhatsapp ?? "",
      instituicaoNome: researcherProfile?.instituicaoNome ?? "",
      instituicaoCnpj: researcherProfile?.instituicaoCnpj ?? "",
      instituicaoEmail: researcherProfile?.instituicaoEmail ?? "",
      tipoVinculo: researcherProfile?.tipoVinculo ?? "",
      cargoFuncao: researcherProfile?.cargoFuncao ?? "",
      estadoAtuacao: researcherProfile?.estadoAtuacao ?? "",
      municipioAtuacao: researcherProfile?.municipioAtuacao ?? "",
      perfilProfissional: researcherProfile?.perfilProfissional ?? "",
      nivelFormacao: researcherProfile?.nivelFormacao ?? "",
      finalidadeUso: researcherProfile?.finalidadeUso ?? "",
      lattes: link("lattes"),
      orcid: link("orcid"),
      institucional: link("institucional"),
      paginaProfissional: link("pagina_profissional"),
      outroLink: link("outro"),
    });
  }, [profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    if (
      !onboarding.municipio.trim() ||
      !BRAZIL_UFS.some((uf) => uf.sigla === onboarding.estado) ||
      !onboarding.escolaridade ||
      !onboarding.perfilUsuario ||
      (onboarding.perfilUsuario === "outro" && !onboarding.perfilUsuarioOutro.trim()) ||
      !onboarding.comoConheceu ||
      (onboarding.comoConheceu === "outro" && !onboarding.comoConheceuOutro.trim()) ||
      !onboarding.finalidadeAcesso ||
      (onboarding.finalidadeAcesso === "outro" && !onboarding.finalidadeAcessoOutro.trim()) ||
      (onboarding.possuiVinculo &&
        (!onboarding.instituicaoNome.trim() ||
          !onboarding.instituicaoCnpj.trim() ||
          !onboarding.instituicaoEmail.trim() ||
          !onboarding.tipoVinculo ||
          (onboarding.tipoVinculo === "outro" && !onboarding.tipoVinculoOutro.trim())))
    ) {
      toast.error("Complete os campos obrigatórios do cadastro antes de salvar");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        nomeSocial: nomeSocial || null,
        telefone: telefone || null,
        instituicao: instituicao || null,
        endereco: endereco || null,
        idiomas,
        areasInteresse,
        onboardingProfile: {
          municipio: onboarding.municipio || null,
          estado: onboarding.estado || null,
          escolaridade: onboarding.escolaridade || null,
          perfilUsuario: onboarding.perfilUsuario || null,
          perfilUsuarioOutro: onboarding.perfilUsuarioOutro || null,
          possuiVinculo: onboarding.possuiVinculo,
          instituicaoCnpj: onboarding.possuiVinculo ? onboarding.instituicaoCnpj || null : null,
          instituicaoNome: onboarding.possuiVinculo ? onboarding.instituicaoNome || null : null,
          instituicaoEmail: onboarding.possuiVinculo ? onboarding.instituicaoEmail || null : null,
          tipoVinculo: onboarding.possuiVinculo ? onboarding.tipoVinculo || null : null,
          tipoVinculoOutro: onboarding.possuiVinculo ? onboarding.tipoVinculoOutro || null : null,
          comoConheceu: onboarding.comoConheceu || null,
          comoConheceuOutro: onboarding.comoConheceuOutro || null,
          finalidadeAcesso: onboarding.finalidadeAcesso || null,
          finalidadeAcessoOutro: onboarding.finalidadeAcessoOutro || null,
        },
        researcherProfile: {
          emailProfissional: researcher.emailProfissional || null,
          telefoneWhatsapp: researcher.telefoneWhatsapp || null,
          instituicaoNome: researcher.instituicaoNome || null,
          instituicaoCnpj: researcher.instituicaoCnpj || null,
          instituicaoEmail: researcher.instituicaoEmail || null,
          tipoVinculo: researcher.tipoVinculo || null,
          cargoFuncao: researcher.cargoFuncao || null,
          estadoAtuacao: researcher.estadoAtuacao || null,
          municipioAtuacao: researcher.municipioAtuacao || null,
          perfilProfissional: researcher.perfilProfissional || null,
          nivelFormacao: researcher.nivelFormacao || null,
          finalidadeUso: researcher.finalidadeUso || null,
          links: [
            ["lattes", researcher.lattes],
            ["orcid", researcher.orcid],
            ["institucional", researcher.institucional],
            ["pagina_profissional", researcher.paginaProfissional],
            ["outro", researcher.outroLink],
          ]
            .filter((entry) => entry[1])
            .map(([tipo, url]) => ({ tipo: tipo as "lattes", url })),
        },
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
            <Label htmlFor="p-nome">Nome completo</Label>
            <Input id="p-nome" value={profile?.nome ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-email">E-mail</Label>
            <Input id="p-email" value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-nome-social">Nome social</Label>
            <Input
              id="p-nome-social"
              value={nomeSocial}
              onChange={(e) => setNomeSocial(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-telefone">Telefone</Label>
            <Input id="p-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastro e finalidade de acesso</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onb-municipio">Município</Label>
            <Input
              id="onb-municipio"
              value={onboarding.municipio}
              onChange={(event) =>
                setOnboarding((current) => ({ ...current, municipio: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-estado">Estado (UF)</Label>
            <SelectField
              id="onb-estado"
              value={onboarding.estado || undefined}
              onValueChange={(estado) => setOnboarding((current) => ({ ...current, estado }))}
              placeholder="Selecione"
              options={BRAZIL_UFS.map((uf) => ({
                value: uf.sigla,
                label: `${uf.sigla} — ${uf.nome}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-escolaridade">Escolaridade</Label>
            <SelectField
              id="onb-escolaridade"
              value={onboarding.escolaridade || undefined}
              onValueChange={(escolaridade) =>
                setOnboarding((current) => ({ ...current, escolaridade }))
              }
              placeholder="Selecione"
              options={[
                { value: "fundamental_incompleto", label: "Ensino fundamental incompleto" },
                { value: "fundamental_completo", label: "Ensino fundamental completo" },
                { value: "medio_incompleto", label: "Ensino médio incompleto" },
                { value: "medio_completo", label: "Ensino médio completo" },
                { value: "tecnico", label: "Ensino técnico" },
                { value: "graduacao_incompleta", label: "Graduação incompleta" },
                { value: "graduacao_completa", label: "Graduação completa" },
                { value: "especializacao", label: "Especialização" },
                { value: "mestrado", label: "Mestrado" },
                { value: "doutorado", label: "Doutorado" },
                { value: "pos_doutorado", label: "Pós-doutorado" },
                { value: "prefiro_nao_informar", label: "Prefiro não informar" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-perfil">Perfil de usuário</Label>
            <SelectField
              id="onb-perfil"
              value={onboarding.perfilUsuario || undefined}
              onValueChange={(perfilUsuario) =>
                setOnboarding((current) => ({ ...current, perfilUsuario }))
              }
              placeholder="Selecione"
              options={[
                { value: "estudante", label: "Estudante" },
                { value: "professor", label: "Professor" },
                { value: "pesquisador", label: "Pesquisador" },
                { value: "setor_publico", label: "Profissional do Setor Público" },
                { value: "setor_privado", label: "Profissional do Setor Privado" },
                { value: "autonomo", label: "Profissional autônomo" },
                { value: "trabalhador_rural", label: "Trabalhador rural" },
                { value: "organizacao_social", label: "Representante de organização social" },
                {
                  value: "comunidade_tradicional",
                  label: "Representante de comunidade tradicional",
                },
                { value: "imprensa", label: "Imprensa/comunicação" },
                { value: "outro", label: "Outro" },
                { value: "prefiro_nao_informar", label: "Prefiro não informar" },
              ]}
            />
          </div>
          {onboarding.perfilUsuario === "outro" && (
            <div className="space-y-2">
              <Label htmlFor="onb-perfil-outro">Outro perfil (especifique)</Label>
              <Input
                id="onb-perfil-outro"
                value={onboarding.perfilUsuarioOutro}
                onChange={(event) =>
                  setOnboarding((current) => ({
                    ...current,
                    perfilUsuarioOutro: event.target.value,
                  }))
                }
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="onb-descoberta">Como conheceu a plataforma</Label>
            <SelectField
              id="onb-descoberta"
              value={onboarding.comoConheceu || undefined}
              onValueChange={(comoConheceu) =>
                setOnboarding((current) => ({ ...current, comoConheceu }))
              }
              placeholder="Selecione"
              options={[
                { value: "universidade", label: "Universidade/instituição de ensino" },
                { value: "pesquisa_academica", label: "Pesquisa acadêmica" },
                { value: "redes_sociais", label: "Redes sociais" },
                { value: "internet", label: "Site/internet" },
                { value: "indicacao", label: "Indicação de outra pessoa" },
                { value: "organizacao_social", label: "Organização/movimento social" },
                { value: "orgao_publico", label: "Órgão público" },
                { value: "evento", label: "Evento/palestra" },
                { value: "imprensa", label: "Imprensa" },
                { value: "outro", label: "Outro" },
              ]}
            />
          </div>
          {onboarding.comoConheceu === "outro" && (
            <div className="space-y-2">
              <Label htmlFor="onb-descoberta-outro">Outra forma de descoberta</Label>
              <Input
                id="onb-descoberta-outro"
                value={onboarding.comoConheceuOutro}
                onChange={(event) =>
                  setOnboarding((current) => ({
                    ...current,
                    comoConheceuOutro: event.target.value,
                  }))
                }
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="onb-finalidade">Finalidade de acesso</Label>
            <SelectField
              id="onb-finalidade"
              value={onboarding.finalidadeAcesso || undefined}
              onValueChange={(finalidadeAcesso) =>
                setOnboarding((current) => ({ ...current, finalidadeAcesso }))
              }
              placeholder="Selecione"
              options={[
                { value: "conhecer_informacoes", label: "Conhecer as informações disponíveis" },
                { value: "pesquisa_academica", label: "Pesquisa acadêmica" },
                { value: "estudos_escolares", label: "Estudos escolares" },
                { value: "pesquisa_profissional", label: "Pesquisa profissional" },
                { value: "pesquisa_jornalistica", label: "Pesquisa jornalística" },
                { value: "consulta_trabalho", label: "Consulta para trabalho" },
                { value: "questoes_territoriais", label: "Interesse territorial" },
                { value: "questoes_fundiarias", label: "Interesse fundiário" },
                { value: "questoes_ambientais", label: "Interesse ambiental" },
                { value: "interesse_pessoal", label: "Interesse pessoal" },
                { value: "outro", label: "Outro" },
              ]}
            />
          </div>
          {onboarding.finalidadeAcesso === "outro" && (
            <div className="space-y-2">
              <Label htmlFor="onb-finalidade-outro">Outra finalidade</Label>
              <Input
                id="onb-finalidade-outro"
                value={onboarding.finalidadeAcessoOutro}
                onChange={(event) =>
                  setOnboarding((current) => ({
                    ...current,
                    finalidadeAcessoOutro: event.target.value,
                  }))
                }
                required
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={onboarding.possuiVinculo}
              onCheckedChange={(checked) =>
                setOnboarding((current) => ({ ...current, possuiVinculo: checked === true }))
              }
            />
            Possui vínculo institucional
          </label>
          {onboarding.possuiVinculo && (
            <>
              {(
                [
                  ["instituicaoNome", "Instituição"],
                  ["instituicaoCnpj", "CNPJ"],
                  ["instituicaoEmail", "E-mail institucional"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`onb-${key}`}>{label}</Label>
                  <Input
                    id={`onb-${key}`}
                    type={key === "instituicaoEmail" ? "email" : "text"}
                    value={onboarding[key]}
                    onChange={(event) =>
                      setOnboarding((current) => ({ ...current, [key]: event.target.value }))
                    }
                    required
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="onb-tipoVinculo">Tipo de vínculo</Label>
                <SelectField
                  id="onb-tipoVinculo"
                  value={onboarding.tipoVinculo || undefined}
                  onValueChange={(tipoVinculo) =>
                    setOnboarding((current) => ({ ...current, tipoVinculo }))
                  }
                  placeholder="Selecione"
                  options={[
                    { value: "universidade", label: "Universidade/instituição de ensino" },
                    { value: "instituto_pesquisa", label: "Instituto de pesquisa" },
                    { value: "escola", label: "Escola" },
                    { value: "orgao_publico", label: "Órgão público" },
                    { value: "empresa_privada", label: "Empresa privada" },
                    { value: "sociedade_civil", label: "Organização da sociedade civil" },
                    { value: "movimento_social", label: "Movimento social" },
                    { value: "organizacao_comunitaria", label: "Organização comunitária" },
                    { value: "cooperativa_associacao", label: "Cooperativa/associação" },
                    { value: "sindicato", label: "Sindicato" },
                    { value: "organizacao_internacional", label: "Organização internacional" },
                    { value: "outro", label: "Outro" },
                  ]}
                />
              </div>
              {onboarding.tipoVinculo === "outro" && (
                <div className="space-y-2">
                  <Label htmlFor="onb-tipoVinculoOutro">Outro vínculo (especifique)</Label>
                  <Input
                    id="onb-tipoVinculoOutro"
                    value={onboarding.tipoVinculoOutro}
                    onChange={(event) =>
                      setOnboarding((current) => ({
                        ...current,
                        tipoVinculoOutro: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil profissional do pesquisador</CardTitle>
          <p className="text-xs text-muted-foreground">
            Preencha antes de solicitar promoção a pesquisador. Dados institucionais são
            obrigatórios para o perfil com download.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["emailProfissional", "E-mail profissional"],
              ["telefoneWhatsapp", "Telefone/WhatsApp"],
              ["instituicaoNome", "Instituição"],
              ["instituicaoCnpj", "CNPJ"],
              ["instituicaoEmail", "E-mail institucional"],
              ["tipoVinculo", "Tipo de vínculo"],
              ["cargoFuncao", "Cargo/função"],
              ["estadoAtuacao", "Estado de atuação"],
              ["municipioAtuacao", "Município de atuação"],
              ["perfilProfissional", "Perfil profissional"],
              ["nivelFormacao", "Nível de formação"],
              ["finalidadeUso", "Finalidade de uso"],
              ["lattes", "Currículo Lattes"],
              ["orcid", "ORCID"],
              ["institucional", "Perfil institucional"],
              ["paginaProfissional", "Página profissional"],
              ["outroLink", "Outro link profissional"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`researcher-${key}`}>{label}</Label>
              <Input
                id={`researcher-${key}`}
                type={
                  ["emailProfissional", "instituicaoEmail"].includes(key)
                    ? "email"
                    : [
                          "lattes",
                          "orcid",
                          "institucional",
                          "paginaProfissional",
                          "outroLink",
                        ].includes(key)
                      ? "url"
                      : "text"
                }
                value={researcher[key]}
                onChange={(event) =>
                  setResearcher((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instituição e endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-instituicao">Instituição</Label>
            <Input
              id="p-instituicao"
              value={instituicao}
              onChange={(e) => setInstituicao(e.target.value)}
            />
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
            <Button type="button" variant="outline" onClick={addIdioma}>
              Adicionar
            </Button>
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
