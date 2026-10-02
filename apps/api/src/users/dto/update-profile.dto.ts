import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";
import type { CaseTipo } from "@geo/shared";
import { IsCnpj } from "../../common/is-cnpj.validator";
import { BRAZIL_UF_CODES } from "../../common/brazil-ufs";
import {
  ONBOARDING_AFFILIATION_OPTIONS,
  ONBOARDING_DISCOVERY_OPTIONS,
  ONBOARDING_EDUCATION_OPTIONS,
  ONBOARDING_PURPOSE_OPTIONS,
  ONBOARDING_USER_PROFILE_OPTIONS,
} from "../../common/onboarding-options";

const AREAS_INTERESSE: CaseTipo[] = ["institucional", "titulo_falso", "car"];

export class OnboardingProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  municipio?: string | null;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(BRAZIL_UF_CODES)
  estado?: string | null;
  @IsOptional() @IsIn(ONBOARDING_EDUCATION_OPTIONS) escolaridade?: string | null;
  @IsOptional() @IsIn(ONBOARDING_USER_PROFILE_OPTIONS) perfilUsuario?: string | null;
  @IsOptional() @IsString() @MaxLength(300) perfilUsuarioOutro?: string | null;
  @IsOptional() @IsBoolean() possuiVinculo?: boolean;
  @IsOptional() @IsCnpj({ message: "CNPJ inválido" }) instituicaoCnpj?: string | null;
  @IsOptional() @IsString() @MaxLength(200) instituicaoNome?: string | null;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  instituicaoEmail?: string | null;
  @IsOptional() @IsIn(ONBOARDING_AFFILIATION_OPTIONS) tipoVinculo?: string | null;
  @IsOptional() @IsString() @MaxLength(300) tipoVinculoOutro?: string | null;
  @IsOptional() @IsIn(ONBOARDING_DISCOVERY_OPTIONS) comoConheceu?: string | null;
  @IsOptional() @IsString() @MaxLength(300) comoConheceuOutro?: string | null;
  @IsOptional() @IsIn(ONBOARDING_PURPOSE_OPTIONS) finalidadeAcesso?: string | null;
  @IsOptional() @IsString() @MaxLength(500) finalidadeAcessoOutro?: string | null;
}

export class ResearcherLinkDto {
  @IsIn(["lattes", "orcid", "institucional", "pagina_profissional", "outro"])
  tipo!: string;
  @IsUrl({ require_protocol: true }) url!: string;
}

export class ResearcherProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  emailProfissional?: string | null;
  @IsOptional() @IsString() @MaxLength(30) telefoneWhatsapp?: string | null;
  @IsOptional() @IsString() @MaxLength(200) instituicaoNome?: string | null;
  @IsOptional() @IsCnpj({ message: "CNPJ inválido" }) instituicaoCnpj?: string | null;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  instituicaoEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(120) tipoVinculo?: string | null;
  @IsOptional() @IsString() @MaxLength(160) cargoFuncao?: string | null;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(BRAZIL_UF_CODES)
  estadoAtuacao?: string | null;
  @IsOptional() @IsString() @MaxLength(120) municipioAtuacao?: string | null;
  @IsOptional() @IsString() @MaxLength(120) perfilProfissional?: string | null;
  @IsOptional() @IsString() @MaxLength(120) nivelFormacao?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) finalidadeUso?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ResearcherLinkDto)
  links?: ResearcherLinkDto[];
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeSocial?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instituicao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  endereco?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localidade?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  quemRepresenta?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  idiomas?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(AREAS_INTERESSE, { each: true })
  areasInteresse?: CaseTipo[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingProfileDto)
  onboardingProfile?: OnboardingProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResearcherProfileDto)
  researcherProfile?: ResearcherProfileDto;
}
