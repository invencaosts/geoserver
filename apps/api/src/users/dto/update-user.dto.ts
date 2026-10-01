import { IsIn, IsOptional } from "class-validator";
import { ROLES, type RoleName } from "@geo/shared";

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: RoleName;

  @IsOptional()
  @IsIn(["ativo", "inativo"])
  status?: "ativo" | "inativo";
}
