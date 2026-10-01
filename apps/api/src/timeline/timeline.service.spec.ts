import type { PrismaService } from "../prisma/prisma.service";
import type { MinioService } from "../storage/minio.service";
import { TimelineService } from "./timeline.service";

const MEDIA = "http://minio/attachments/timeline/abc.pdf";

describe("TimelineService — limpeza de mídia", () => {
  let service: TimelineService;
  let prisma: {
    timelineEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let minio: { deleteTimelineMediaByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      timelineEvent: {
        findUnique: vi.fn().mockResolvedValue({ id: "e1", escopo: "nacional", mediaUrl: MEDIA }),
        delete: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "e1" }),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    minio = { deleteTimelineMediaByUrl: vi.fn().mockResolvedValue(undefined) };
    service = new TimelineService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
    );
  });

  it("remove a mídia ao excluir o evento", async () => {
    await service.removeAdmin("e1");
    expect(minio.deleteTimelineMediaByUrl).toHaveBeenCalledWith(MEDIA);
  });

  it("mantém a mídia se outro evento ainda usa a mesma URL", async () => {
    prisma.timelineEvent.count.mockResolvedValue(1);
    await service.removeAdmin("e1");
    expect(minio.deleteTimelineMediaByUrl).not.toHaveBeenCalled();
  });

  it("remove a mídia antiga quando ela é retirada na edição", async () => {
    await service.updateAdmin("e1", { removeMedia: true });
    expect(minio.deleteTimelineMediaByUrl).toHaveBeenCalledWith(MEDIA);
  });

  it("não mexe na mídia quando a edição não a altera", async () => {
    await service.updateAdmin("e1", { headline: "Novo título" });
    expect(minio.deleteTimelineMediaByUrl).not.toHaveBeenCalled();
  });

  it("conclui a exclusão mesmo se o MinIO falhar", async () => {
    minio.deleteTimelineMediaByUrl.mockRejectedValue(new Error("MinIO indisponível"));
    await expect(service.removeAdmin("e1")).resolves.toEqual({ success: true });
  });
});
