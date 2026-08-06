import { IsIn } from "class-validator";

export class ApproveRoleDto {
  @IsIn(["aprovado", "rejeitado"])
  decision!: "aprovado" | "rejeitado";
}
