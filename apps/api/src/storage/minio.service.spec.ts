import type { ConfigService } from "@nestjs/config";
import { readFileSync } from "fs";
import { join } from "path";
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

  afterEach(() => {
    vi.useRealTimers();
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

  it("grava evidências no bucket privado dedicado sem retornar URL pública", async () => {
    const putObject = vi.fn().mockResolvedValue(undefined);
    service.client = { putObject } as unknown as MinioService["client"];
    const buffer = Buffer.from("evidência");

    await expect(
      service.uploadCaseEvidence("cases/c1/doc.pdf", buffer, "application/pdf"),
    ).resolves.toBe("cases/c1/doc.pdf");
    expect(putObject).toHaveBeenCalledWith(
      "case-evidence",
      "cases/c1/doc.pdf",
      buffer,
      buffer.length,
      { "Content-Type": "application/pdf" },
    );
  });

  it("não confunde falha transitória ao consultar anexo público com objeto ausente", async () => {
    const unavailable = Object.assign(new Error("MinIO indisponível"), { statusCode: 503 });
    const statObject = vi
      .fn()
      .mockResolvedValueOnce({ size: 123, metaData: { "content-type": "application/pdf" } })
      .mockRejectedValueOnce(unavailable);
    const removeObject = vi.fn();
    service.client = { statObject, removeObject } as unknown as MinioService["client"];

    await expect(service.migrateLegacyCaseEvidence("cases/case-1/prova.pdf")).rejects.toBe(
      unavailable,
    );
    expect(removeObject).not.toHaveBeenCalled();
  });

  it("não permite que a aplicação altere políticas compartilhadas dos buckets", async () => {
    const setBucketPolicy = vi.fn().mockResolvedValue(undefined);
    service.client = {
      bucketExists: vi.fn().mockResolvedValue(true),
      setBucketPolicy,
    } as unknown as MinioService["client"];

    await service.onModuleInit();

    expect(setBucketPolicy).not.toHaveBeenCalled();
  });

  it("mantém a política da aplicação sem permissão para reabrir buckets", () => {
    const policy = JSON.parse(
      readFileSync(join(process.cwd(), "../../infra/minio/app-policy.json"), "utf8"),
    );
    const actions = policy.Statement.flatMap((statement: { Action: string[] }) => statement.Action);

    expect(actions).not.toContain("s3:PutBucketPolicy");
    expect(actions).not.toContain("s3:DeleteBucketPolicy");
    expect(actions).not.toContain("s3:PutBucketAcl");
  });

  it("publica anonimamente somente mídias da timeline no bucket de anexos", () => {
    const policy = JSON.parse(
      readFileSync(join(process.cwd(), "../../infra/minio/attachments-public-policy.json"), "utf8"),
    );

    expect(policy.Statement).toEqual([
      expect.objectContaining({
        Action: ["s3:GetObject"],
        Resource: ["arn:aws:s3:::attachments/timeline/*"],
      }),
    ]);
  });
});
