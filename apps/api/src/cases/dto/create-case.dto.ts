import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from "class-validator";
import type { CasePrioridade, CaseTipo } from "@geo/shared";

const TIPOS: CaseTipo[] = ["institucional", "titulo_falso", "car"];
const PRIORIDADES: CasePrioridade[] = ["baixa", "media", "alta", "critica"];

export class CreateCaseDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsIn(TIPOS)
  tipo!: CaseTipo;

  @IsString()
  municipio!: string;

  @IsString()
  estado!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  fonteDados?: string;

  @IsOptional()
  @IsString()
  denunciante?: string;

  @IsOptional()
  @IsIn(PRIORIDADES)
  prioridade?: CasePrioridade;
}
