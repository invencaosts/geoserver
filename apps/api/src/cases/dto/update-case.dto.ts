import { PartialType } from "@nestjs/mapped-types";
import { IsInt, Min } from "class-validator";
import { CreateCaseDto } from "./create-case.dto";

export class UpdateCaseDto extends PartialType(CreateCaseDto) {
  @IsInt()
  @Min(0)
  revision!: number;
}
