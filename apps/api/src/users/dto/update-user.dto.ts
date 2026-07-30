import { IsIn, IsOptional } from "class-validator";
import type { RoleName } from "@geo/shared";

export class UpdateUserDto {
  @IsOptional()
  @IsIn(["admin", "verificador", "contribuidor", "leitor"])
  role?: RoleName;

  @IsOptional()
  @IsIn(["ativo", "inativo"])
  status?: "ativo" | "inativo";
}
