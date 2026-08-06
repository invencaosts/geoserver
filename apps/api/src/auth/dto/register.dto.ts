import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";
import type { PerfilContribuidor, RoleName } from "@geo/shared";
import { IsCpf } from "../../common/is-cpf.validator";

const PERFIL_CONTRIBUIDOR_VALUES: PerfilContribuidor[] = [
  "pesquisador",
  "militante_movimento_social",
  "partido_politico",
  "servidor_publico",
  "lideranca_comunitaria",
  "movimento_social_organizado",
  "conselhos_ongs",
];

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  nomeSocial?: string;

  @IsEmail()
  email!: string;

  @IsCpf({ message: "CPF inválido" })
  cpf!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  @IsOptional()
  @IsIn(["leitor", "contribuidor", "verificador"])
  role?: RoleName;

  @ValidateIf((o) => o.role === "contribuidor" || o.role === "verificador")
  @IsIn(PERFIL_CONTRIBUIDOR_VALUES, {
    message: "Selecione seu perfil",
  })
  perfilContribuidor?: PerfilContribuidor;

  @ValidateIf((o) => o.role === "contribuidor" || o.role === "verificador")
  @IsString({ message: "Informe quem você representa" })
  @MinLength(2)
  quemRepresenta?: string;
}
