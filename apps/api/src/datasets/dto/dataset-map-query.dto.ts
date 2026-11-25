import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ArrayMaxSize,
} from "class-validator";

export class DatasetMapFeaturesQueryDto {
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize = 100;
  @IsOptional() @IsString() @MaxLength(200) bbox?: string;
}

export class DatasetClusterQueryDto extends DatasetMapFeaturesQueryDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(22) z!: number;
  @Type(() => Number) @IsInt() @Min(0) cellX!: number;
  @Type(() => Number) @IsInt() @Min(0) cellY!: number;
}

export class DatasetMapConfigDto {
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(200)
  titleField?: string | null;
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  visibleFields?: string[] | null;
  @ValidateIf((_object, value) => value !== undefined) @IsObject() labels?: Record<string, string>;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  publicFields?: string[];
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string | null;
}
