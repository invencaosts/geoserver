import { IsIn, IsOptional, IsString } from "class-validator";
import type { CaseStatus } from "@geo/shared";

const STATUSES: CaseStatus[] = ["pendente", "em_verificacao", "validado", "rejeitado"];

export class UpdateCaseStatusDto {
  @IsIn(STATUSES)
  status!: CaseStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
