import type { ConfigService } from "@nestjs/config";
import { MinioService } from "./minio.service";

const PUBLIC_URL = "http://localhost:9004";

describe("MinioService — remoção por URL pública", () => {
  let service: MinioService;
  let removeObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const env: Record<string, string> = {
      MINIO_ENDPOINT: "localhost",
      MINIO_PORT: "9004",
      MINIO_ACCESS_KEY: "chave",
      MINIO_SECRET_KEY: "segredo",
      MINIO_BUCKET: "geo-datasets",
      MINIO_PUBLIC_URL: PUBLIC_URL,
    };
    service = new MinioService({ get: (key: string) => env[key] } as unknown as ConfigService);
    removeObject = vi.fn().mockResolvedValue(undefined);
    service.client = { removeObject } as unknown as MinioService["client"];
  });

  it("remove o avatar do próprio usuário", async () => {
    await service.deleteAvatarByUrl(`${PUBLIC_URL}/avatars/users/u1/foto.png`, "u1");
    expect(removeObject).toHaveBeenCalledWith("avatars", "users/u1/foto.png");
  });

  it("ignora avatar de outro usuário ou de outro servidor", async () => {
    await service.deleteAvatarByUrl(`${PUBLIC_URL}/avatars/users/u2/foto.png`, "u1");
    await service.deleteAvatarByUrl("https://exemplo.test/avatars/users/u1/foto.png", "u1");
    expect(removeObject).not.toHaveBeenCalled();
  });

  it("remove mídia enviada pela gestão da timeline", async () => {
    await service.deleteTimelineMediaByUrl(`${PUBLIC_URL}/attachments/timeline/abc.pdf`);
    expect(removeObject).toHaveBeenCalledWith("attachments", "timeline/abc.pdf");
  });

  it("não remove PDFs do seed nem anexos de casos", async () => {
    await service.deleteTimelineMediaByUrl(`${PUBLIC_URL}/timeline-leis/leis-brasil/lei.pdf`);
    await service.deleteTimelineMediaByUrl(`${PUBLIC_URL}/attachments/cases/c1/anexo.pdf`);
    expect(removeObject).not.toHaveBeenCalled();
  });
});
