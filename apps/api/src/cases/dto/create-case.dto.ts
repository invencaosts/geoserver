import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { CasePrioridade, CaseTipo, DataVisibility } from "@geo/shared";
import { BRAZIL_UF_CODES } from "../../common/brazil-ufs";

const TIPOS: CaseTipo[] = ["institucional", "titulo_falso", "car"];
const PRIORIDADES: CasePrioridade[] = ["baixa", "media", "alta", "critica"];
const VISIBILITIES: DataVisibility[] = ["publico", "restrito"];

export class CaseContributionDto {
  @IsOptional() @IsString() @MaxLength(240) relacaoPesquisador?: string | null;
  @IsOptional() @IsBoolean() participouProducao?: boolean;
  @IsOptional() @IsBoolean() participouValidacao?: boolean;
  @IsOptional() @IsString() @MaxLength(240) responsavelValidacao?: string | null;
  @IsOptional() @IsString() @MaxLength(240) instrumentoCentral?: string | null;
  @IsOptional() @IsString() @MaxLength(240) objetoEspolio?: string | null;
  @IsOptional() @IsString() @MaxLength(240) instituicaoPromotora?: string | null;
  @IsOptional() @IsString() @MaxLength(120) grauPublicidadeInformacoes?: string | null;
  @IsOptional() @IsBoolean() possuiRestricaoDivulgacao?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) restricaoDivulgacao?: string | null;
  @IsOptional() @IsInt() @Min(1500) @Max(2200) periodoInicio?: number;
  @IsOptional() @IsInt() @Min(1500) @Max(2200) periodoFim?: number;
  @IsOptional() @IsString() @MaxLength(240) situacaoCancelamento?: string | null;
  @IsOptional() @IsString() @MaxLength(240) orgaoCancelamento?: string | null;
  @IsOptional() @IsBoolean() retornouPatrimonioPublico?: boolean | null;
  @IsOptional() @IsString() @MaxLength(1000) destinacaoPosterior?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) situacaoAtualImovel?: string | null;
  @IsOptional() @IsString() @MaxLength(3000) conflitos?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) sujeitosSociais?: string | null;
  @IsOptional() @IsString() @MaxLength(120) escalaEspacial?: string | null;
}

export class CaseSourceDto {
  @IsOptional() @IsString() id?: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  titulo!: string;
  @IsOptional() @IsString() @MaxLength(120) tipo?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) referencia?: string | null;
  @IsOptional() @IsIn(VISIBILITIES) grauPublicidade?: DataVisibility | null;
}

export class CaseFacetDto {
  @IsString() optionId!: string;
  @IsOptional() @IsString() @MaxLength(500) valorOutro?: string | null;
}

export class CaseSpatialReferenceDto {
  @IsOptional() @IsString() id?: string;
  @IsIn(["coordenadas_geograficas", "utm", "car", "sigef", "shapefile", "kml_kmz", "mapa", "outra"])
  tipo!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  valor!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string | null;
}

export class CreateCaseDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  nome?: string;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: CaseTipo;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  municipio?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(BRAZIL_UF_CODES)
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string | null;

  @IsOptional()
  @IsLatitude()
  lat?: number | null;

  @IsOptional()
  @IsLongitude()
  lng?: number | null;

  @IsOptional()
  @IsString()
  fonteDados?: string | null;

  @IsOptional()
  @IsString()
  denunciante?: string | null;

  @IsOptional()
  @IsIn(PRIORIDADES)
  prioridade?: CasePrioridade;

  @IsOptional()
  @IsBoolean()
  declarationAccepted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  declarationVersion?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CaseContributionDto)
  contribution?: CaseContributionDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CaseSourceDto)
  sources?: CaseSourceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CaseFacetDto)
  facets?: CaseFacetDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CaseSpatialReferenceDto)
  spatialReferences?: CaseSpatialReferenceDto[];
}

export class UploadCaseDocumentDto {
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsIn(VISIBILITIES) visibility?: DataVisibility;
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  possuiDadosPessoais?: boolean;
  @IsOptional() @IsString() @MaxLength(500) motivoRestricao?: string;
}

export class ReviewDocumentPublicationDto {
  @IsBoolean()
  approved!: boolean;
}
