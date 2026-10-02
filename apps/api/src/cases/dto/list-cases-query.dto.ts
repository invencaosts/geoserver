import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { CaseStatus, CaseTipo } from "@geo/shared";

const STATUSES: CaseStatus[] = ["rascunho", "pendente", "em_verificacao", "validado", "rejeitado"];
const TIPOS: CaseTipo[] = ["institucional", "titulo_falso", "car"];

export class ListCasesQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: CaseTipo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
