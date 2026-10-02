import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";
import type { DataVisibility } from "@geo/shared";

export class CreateDatasetDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  caseId?: string;
  @IsOptional() @IsIn(["publico", "restrito"]) visibility?: DataVisibility;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  codigoCar?: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  codigoSigef?: string;
}

export class ReviewDatasetPublicationDto {
  @IsBoolean()
  approved!: boolean;
}
