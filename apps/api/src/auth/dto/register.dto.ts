import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { RoleName } from "@geo/shared";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  @IsOptional()
  @IsIn(["admin", "verificador", "contribuidor", "leitor"])
  role?: RoleName;
}
