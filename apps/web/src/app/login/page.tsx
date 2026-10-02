"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, MapPinned, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLogin, useRegister } from "@/lib/queries/auth";
import { BRAZIL_UFS } from "@/lib/brazil-ufs";
import { toast } from "sonner";

function formatCpf(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const HIGHLIGHTS = [
  {
    icon: MapPinned,
    title: "Mapa territorial em tempo real",
    desc: "Camadas geoespaciais e casos plotados sobre PostGIS",
  },
  {
    icon: Database,
    title: "Dados que chegam prontos",
    desc: "Shapefile, GeoJSON, KML, KMZ e CSV processados automaticamente",
  },
  {
    icon: ShieldCheck,
    title: "Acesso sob controle",
    desc: "Workflow de validação com auditoria e papéis de acesso",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nome, setNome] = useState("");
  const [nomeSocial, setNomeSocial] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [escolaridade, setEscolaridade] = useState("");
  const [perfilUsuario, setPerfilUsuario] = useState("");
  const [perfilUsuarioOutro, setPerfilUsuarioOutro] = useState("");
  const [possuiVinculo, setPossuiVinculo] = useState(false);
  const [instituicaoNome, setInstituicaoNome] = useState("");
  const [instituicaoCnpj, setInstituicaoCnpj] = useState("");
  const [instituicaoEmail, setInstituicaoEmail] = useState("");
  const [tipoVinculo, setTipoVinculo] = useState("");
  const [tipoVinculoOutro, setTipoVinculoOutro] = useState("");
  const [comoConheceu, setComoConheceu] = useState("");
  const [comoConheceuOutro, setComoConheceuOutro] = useState("");
  const [finalidadeAcesso, setFinalidadeAcesso] = useState("");
  const [finalidadeAcessoOutro, setFinalidadeAcessoOutro] = useState("");

  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login.mutateAsync({ email, senha });
      } else {
        if (
          !municipio.trim() ||
          !BRAZIL_UFS.some((uf) => uf.sigla === estado) ||
          !escolaridade ||
          !perfilUsuario ||
          !comoConheceu ||
          !finalidadeAcesso ||
          (perfilUsuario === "outro" && !perfilUsuarioOutro.trim()) ||
          (comoConheceu === "outro" && !comoConheceuOutro.trim()) ||
          (finalidadeAcesso === "outro" && !finalidadeAcessoOutro.trim()) ||
          (possuiVinculo &&
            (!instituicaoNome.trim() ||
              !instituicaoCnpj.trim() ||
              !instituicaoEmail.trim() ||
              !tipoVinculo ||
              (tipoVinculo === "outro" && !tipoVinculoOutro.trim())))
        ) {
          toast.error("Preencha todos os campos obrigatórios do cadastro");
          return;
        }
        await register.mutateAsync({
          nome,
          nomeSocial: nomeSocial || undefined,
          email,
          cpf,
          senha,
          municipio,
          estado,
          escolaridade,
          perfilUsuario,
          perfilUsuarioOutro: perfilUsuarioOutro || undefined,
          possuiVinculo,
          instituicaoNome: instituicaoNome || undefined,
          instituicaoCnpj: instituicaoCnpj || undefined,
          instituicaoEmail: instituicaoEmail || undefined,
          tipoVinculo: tipoVinculo || undefined,
          tipoVinculoOutro: tipoVinculoOutro || undefined,
          comoConheceu,
          comoConheceuOutro: comoConheceuOutro || undefined,
          finalidadeAcesso,
          finalidadeAcessoOutro: finalidadeAcessoOutro || undefined,
        });
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
          <span className="text-sm font-semibold text-white">Observatório Grilagem de Terras</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
              <AlertTriangle className="h-3 w-3 text-primary" />
              Monitoramento territorial colaborativo
            </span>
            <h2 className="text-3xl font-semibold leading-tight text-white">
              Observatório Grilagem de Terras Ariovaldo Umbelino de Oliveira
            </h2>
            <p className="text-sm leading-relaxed text-white/50">
              Uma plataforma única pra registrar, validar e acompanhar ocorrências com dados
              georreferenciados de verdade.
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

        <p className="relative text-[11px] text-white/30">
          Em homenagem ao Professor Doutor Ariovaldo Umbelino de Oliveira
        </p>
      </div>

      {/* painel do formulário */}
      <div className="flex items-center justify-center bg-background p-6">
        <div
          className={
            mode === "register" ? "w-full max-w-2xl space-y-6" : "w-full max-w-sm space-y-6"
          }
        >
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
                : "Contas novas entram como Visualizador. Um verificador ou administrador libera o envio e o download de dados."}
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
              <>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="municipio">Município</Label>
                    <Input
                      id="municipio"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado (UF)</Label>
                    <SelectField
                      id="estado"
                      value={estado || undefined}
                      onValueChange={setEstado}
                      placeholder="Selecione"
                      options={BRAZIL_UFS.map((uf) => ({
                        value: uf.sigla,
                        label: `${uf.sigla} — ${uf.nome}`,
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="escolaridade">Grau de escolaridade</Label>
                    <SelectField
                      id="escolaridade"
                      value={escolaridade || undefined}
                      onValueChange={setEscolaridade}
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
                    <Label htmlFor="perfilUsuario">Perfil de usuário</Label>
                    <SelectField
                      id="perfilUsuario"
                      value={perfilUsuario || undefined}
                      onValueChange={setPerfilUsuario}
                      placeholder="Selecione"
                      options={[
                        { value: "estudante", label: "Estudante" },
                        { value: "professor", label: "Professor" },
                        { value: "pesquisador", label: "Pesquisador" },
                        { value: "setor_publico", label: "Profissional do Setor Público" },
                        { value: "setor_privado", label: "Profissional do Setor Privado" },
                        { value: "autonomo", label: "Profissional Autônomo" },
                        { value: "trabalhador_rural", label: "Trabalhador Rural" },
                        {
                          value: "organizacao_social",
                          label: "Representante de organização social",
                        },
                        {
                          value: "comunidade_tradicional",
                          label: "Representante de comunidade tradicional",
                        },
                        { value: "imprensa", label: "Imprensa/comunicação" },
                        { value: "outro", label: "Outro" },
                        { value: "prefiro_nao_informar", label: "Prefiro não informar" },
                      ]}
                    />
                    {perfilUsuario === "outro" && (
                      <Input
                        value={perfilUsuarioOutro}
                        onChange={(e) => setPerfilUsuarioOutro(e.target.value)}
                        placeholder="Especifique o perfil"
                        required
                      />
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={possuiVinculo}
                    onCheckedChange={(checked) => setPossuiVinculo(checked === true)}
                  />
                  Possuo vínculo com uma instituição
                </label>
                {possuiVinculo && (
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="instituicaoNome">Instituição</Label>
                      <Input
                        id="instituicaoNome"
                        value={instituicaoNome}
                        onChange={(e) => setInstituicaoNome(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instituicaoCnpj">CNPJ</Label>
                      <Input
                        id="instituicaoCnpj"
                        value={instituicaoCnpj}
                        onChange={(e) => setInstituicaoCnpj(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instituicaoEmail">E-mail institucional</Label>
                      <Input
                        id="instituicaoEmail"
                        type="email"
                        value={instituicaoEmail}
                        onChange={(e) => setInstituicaoEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipoVinculo">Tipo de vínculo</Label>
                      <SelectField
                        id="tipoVinculo"
                        value={tipoVinculo || undefined}
                        onValueChange={setTipoVinculo}
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
                          {
                            value: "organizacao_internacional",
                            label: "Organização internacional",
                          },
                          { value: "outro", label: "Outro" },
                        ]}
                      />
                      {tipoVinculo === "outro" && (
                        <Input
                          value={tipoVinculoOutro}
                          onChange={(e) => setTipoVinculoOutro(e.target.value)}
                          placeholder="Especifique o vínculo"
                          required
                        />
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="comoConheceu">Como conheceu a plataforma?</Label>
                    <SelectField
                      id="comoConheceu"
                      value={comoConheceu || undefined}
                      onValueChange={setComoConheceu}
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
                    {comoConheceu === "outro" && (
                      <Input
                        value={comoConheceuOutro}
                        onChange={(e) => setComoConheceuOutro(e.target.value)}
                        placeholder="Descreva como conheceu"
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finalidadeAcesso">Principal finalidade de acesso</Label>
                    <SelectField
                      id="finalidadeAcesso"
                      value={finalidadeAcesso || undefined}
                      onValueChange={setFinalidadeAcesso}
                      placeholder="Selecione"
                      options={[
                        {
                          value: "conhecer_informacoes",
                          label: "Conhecer as informações disponíveis",
                        },
                        { value: "pesquisa_academica", label: "Pesquisa acadêmica" },
                        { value: "estudos_escolares", label: "Estudos escolares" },
                        { value: "pesquisa_profissional", label: "Pesquisa profissional" },
                        { value: "pesquisa_jornalistica", label: "Pesquisa jornalística" },
                        { value: "consulta_trabalho", label: "Consulta para trabalho" },
                        {
                          value: "questoes_territoriais",
                          label: "Interesse em questões territoriais",
                        },
                        { value: "questoes_fundiarias", label: "Interesse em questões fundiárias" },
                        { value: "questoes_ambientais", label: "Interesse em questões ambientais" },
                        { value: "interesse_pessoal", label: "Interesse pessoal" },
                        { value: "outro", label: "Outro" },
                      ]}
                    />
                    {finalidadeAcesso === "outro" && (
                      <Input
                        value={finalidadeAcessoOutro}
                        onChange={(e) => setFinalidadeAcessoOutro(e.target.value)}
                        placeholder="Descreva a finalidade"
                        required
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeSocial">Nome social (opcional)</Label>
                  <Input
                    id="nomeSocial"
                    value={nomeSocial}
                    onChange={(e) => setNomeSocial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
              </>
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

          <Link
            href="/mapa"
            className="block text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Continuar sem login
          </Link>
        </div>
      </div>
    </div>
  );
}
