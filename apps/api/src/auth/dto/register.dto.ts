import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { IsCpf } from "../../common/is-cpf.validator";
import { IsCnpj } from "../../common/is-cnpj.validator";
import { BRAZIL_UF_CODES } from "../../common/brazil-ufs";
import {
  ONBOARDING_AFFILIATION_OPTIONS,
  ONBOARDING_DISCOVERY_OPTIONS,
  ONBOARDING_EDUCATION_OPTIONS,
  ONBOARDING_PURPOSE_OPTIONS,
  ONBOARDING_USER_PROFILE_OPTIONS,
} from "../../common/onboarding-options";

export class RegisterDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  nomeSocial?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsCpf({ message: "CPF inválido" })
  cpf!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  municipio!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(BRAZIL_UF_CODES)
  estado!: string;
  @IsIn(ONBOARDING_EDUCATION_OPTIONS) escolaridade!: string;
  @IsIn(ONBOARDING_USER_PROFILE_OPTIONS) perfilUsuario!: string;
  @ValidateIf((dto: RegisterDto) => dto.perfilUsuario === "outro")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  perfilUsuarioOutro?: string;
  @IsBoolean() possuiVinculo!: boolean;
  @ValidateIf((dto: RegisterDto) => dto.possuiVinculo === true)
  @IsCnpj({ message: "CNPJ inválido" })
  instituicaoCnpj?: string;
  @ValidateIf((dto: RegisterDto) => dto.possuiVinculo === true)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  instituicaoNome?: string;
  @ValidateIf((dto: RegisterDto) => dto.possuiVinculo === true)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  instituicaoEmail?: string;
  @ValidateIf((dto: RegisterDto) => dto.possuiVinculo === true)
  @IsIn(ONBOARDING_AFFILIATION_OPTIONS)
  tipoVinculo?: string;
  @ValidateIf((dto: RegisterDto) => dto.possuiVinculo === true && dto.tipoVinculo === "outro")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  tipoVinculoOutro?: string;
  @IsIn(ONBOARDING_DISCOVERY_OPTIONS) comoConheceu!: string;
  @ValidateIf((dto: RegisterDto) => dto.comoConheceu === "outro")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  comoConheceuOutro?: string;
  @IsIn(ONBOARDING_PURPOSE_OPTIONS) finalidadeAcesso!: string;
  @ValidateIf((dto: RegisterDto) => dto.finalidadeAcesso === "outro")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  finalidadeAcessoOutro?: string;
}
