import {
  validateAvatarUpload,
  validateCaseAttachment,
  validateDatasetUpload,
} from "./upload-validation";

function upload(originalname: string, buffer: Buffer, mimetype = "application/octet-stream") {
  return { originalname, buffer, mimetype } as Express.Multer.File;
}

describe("validação de uploads", () => {
  it("ignora o Content-Type informado pelo cliente e detecta PNG pela assinatura", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateAvatarUpload(upload("avatar.html", png, "text/html"))).toEqual({
      contentType: "image/png",
      extension: "png",
    });
  });

  it("rejeita HTML disfarçado de imagem", () => {
    expect(() => validateAvatarUpload(upload("avatar.png", Buffer.from("<script>x</script>"))))
      .toThrow("Formato inválido");
  });

  it("rejeita HTML disfarçado de PDF", async () => {
    await expect(
      validateCaseAttachment(upload("evidencia.pdf", Buffer.from("<script>x</script>"))),
    ).rejects.toThrow("Anexo inválido");
  });

  it("rejeita HTML disfarçado de CSV", async () => {
    await expect(
      validateDatasetUpload(upload("dados.csv", Buffer.from("<html>,conteudo"))),
    ).rejects.toThrow("CSV válido");
  });
});

