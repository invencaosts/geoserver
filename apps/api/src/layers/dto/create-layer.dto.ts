import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import type { LayerCategory, LayerType } from "@geo/shared";

const TIPOS: LayerType[] = ["WMS", "WFS", "WCS", "Vector", "Raster"];
const CATEGORIAS: LayerCategory[] = ["base", "overlay", "analysis"];

export class CreateLayerDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsIn(TIPOS)
  tipo!: LayerType;

  @IsOptional()
  @IsIn(CATEGORIAS)
  categoria?: LayerCategory;

  @IsOptional()
  @IsString()
  url?: string;

  @IsString()
  fonte!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  opacidade?: number;
}
