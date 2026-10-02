import { isBrazilUf } from "./brazil-ufs";

export function researcherProfileIsComplete(
  profile: Record<string, unknown> | null | undefined,
  institutionalRequired: boolean,
) {
  if (!profile) return false;
  const base = [
    "emailProfissional",
    "telefoneWhatsapp",
    "cargoFuncao",
    "estadoAtuacao",
    "municipioAtuacao",
    "perfilProfissional",
    "nivelFormacao",
    "finalidadeUso",
  ];
  const institutional = ["instituicaoNome", "instituicaoCnpj", "instituicaoEmail", "tipoVinculo"];
  return (
    [...base, ...(institutionalRequired ? institutional : [])].every((key) => {
      const value = profile[key];
      return typeof value === "string" && Boolean(value.trim());
    }) && isBrazilUf(String(profile.estadoAtuacao))
  );
}

export function onboardingProfileIsComplete(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  const requiredText = [
    "municipio",
    "estado",
    "escolaridade",
    "perfilUsuario",
    "comoConheceu",
    "finalidadeAcesso",
  ];
  if (
    !requiredText.every((key) => {
      const value = profile[key];
      return typeof value === "string" && Boolean(value.trim());
    }) ||
    typeof profile.possuiVinculo !== "boolean" ||
    !isBrazilUf(String(profile.estado))
  ) {
    return false;
  }
  if (profile.perfilUsuario === "outro" && !String(profile.perfilUsuarioOutro ?? "").trim()) {
    return false;
  }
  if (profile.comoConheceu === "outro" && !String(profile.comoConheceuOutro ?? "").trim()) {
    return false;
  }
  if (profile.finalidadeAcesso === "outro" && !String(profile.finalidadeAcessoOutro ?? "").trim()) {
    return false;
  }
  if (profile.possuiVinculo === true) {
    const institutional = ["instituicaoNome", "instituicaoCnpj", "instituicaoEmail", "tipoVinculo"];
    if (!institutional.every((key) => String(profile[key] ?? "").trim())) return false;
    if (profile.tipoVinculo === "outro" && !String(profile.tipoVinculoOutro ?? "").trim()) {
      return false;
    }
  }
  return true;
}
