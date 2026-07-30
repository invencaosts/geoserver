import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateLayerDto } from "./create-layer.dto";

export class UpdateLayerDto extends PartialType(CreateLayerDto) {
  @IsOptional()
  @IsBoolean()
  visivel?: boolean;
}
