import "reflect-metadata";
import { validate } from "class-validator";
import { OnboardingProfileDto } from "../users/dto/update-profile.dto";

describe("IsCnpj", () => {
  it("aceita CNPJ com dígitos verificadores válidos", async () => {
    const dto = Object.assign(new OnboardingProfileDto(), {
      instituicaoCnpj: "04.252.011/0001-10",
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejeita CNPJ inválido", async () => {
    const dto = Object.assign(new OnboardingProfileDto(), {
      instituicaoCnpj: "11.111.111/1111-11",
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "instituicaoCnpj")).toBe(true);
  });
});
