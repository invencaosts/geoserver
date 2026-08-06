import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { CaseTipo } from "@geo/shared";

const AREAS_INTERESSE: CaseTipo[] = ["institucional", "titulo_falso", "car"];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instituicao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  endereco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  quemRepresenta?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  idiomas?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(AREAS_INTERESSE, { each: true })
  areasInteresse?: CaseTipo[];
}
