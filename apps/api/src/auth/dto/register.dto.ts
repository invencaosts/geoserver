import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { IsCpf } from "../../common/is-cpf.validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  nomeSocial?: string;

  @IsEmail()
  email!: string;

  @IsCpf({ message: "CPF inválido" })
  cpf!: string;

  @IsString()
  @MinLength(6)
  senha!: string;
}
