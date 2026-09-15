import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";
import type { TimelineEscopo } from "@geo/shared";

const ESCOPOS: TimelineEscopo[] = ["nacional", "estadual"];

export class CreateTimelineEventDto {
  @IsIn(ESCOPOS)
  escopo!: TimelineEscopo;

  @ValidateIf((o) => o.escopo === "estadual")
  @IsString()
  @MinLength(2)
  estado?: string;

  @Type(() => Number)
  @IsInt()
  startYear!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endDay?: number;

  @IsOptional()
  @IsString()
  displayDate?: string;

  @IsString()
  @MinLength(2)
  headline!: string;

  @IsString()
  @MinLength(2)
  text!: string;

  @IsOptional()
  @IsString()
  mediaCredit?: string;

  @IsOptional()
  @IsString()
  mediaCaption?: string;

  @IsOptional()
  @IsIn(["title", ""])
  type?: string;
}
