import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Agent, type ClientRequestArgs } from "http";
import { Client } from "minio";
import type { Socket } from "net";
import type { Duplex } from "stream";

const AVATAR_BUCKET = "avatars";
const ATTACHMENTS_BUCKET = "attachments";
const CASE_EVIDENCE_BUCKET = "case-evidence";
export const MINIO_REQUEST_TIMEOUT_MS = 60_000;

class DestroyOnTimeoutAgent extends Agent {
  override createConnection(
    options: ClientRequestArgs,
    callback?: (err: Error | null, stream: Duplex) => void,
  ) {
    const connection = super.createConnection(options, callback);
    const socket = connection as Socket | null | undefined;
    if (socket) {
      socket.setTimeout(MINIO_REQUEST_TIMEOUT_MS);
      socket.once("timeout", () =>
        socket.destroy(new Error("Tempo esgotado na comunicação com o MinIO")),
      );
    }
    return connection;
  }
}

@Injectable()
export class MinioService implements OnModuleInit {
  client: Client;
  bucket: string;
  publicUrl: string;

  constructor(private config: ConfigService) {
    this.client = new Client({
      endPoint: this.config.get<string>("MINIO_ENDPOINT")!,
      port: Number(this.config.get<string>("MINIO_PORT")),
      useSSL: false,
      accessKey: this.config.get<string>("MINIO_ACCESS_KEY")!,
      secretKey: this.config.get<string>("MINIO_SECRET_KEY")!,
    });
    this.client.setRequestOptions({
      agent: new DestroyOnTimeoutAgent({ keepAlive: true, timeout: MINIO_REQUEST_TIMEOUT_MS }),
    });
    this.bucket = this.config.get<string>("MINIO_BUCKET")!;
    this.publicUrl =
      this.config.get<string>("MINIO_PUBLIC_URL") ??
      `http://${this.config.get<string>("MINIO_ENDPOINT")}:${this.config.get<string>("MINIO_PORT")}`;
  }

  async onModuleInit() {
    // Políticas são provisionadas fora da aplicação. A credencial da API não
    // possui PutBucketPolicy, o que impede versões antigas de reabrirem buckets.
    await this.ensureBucket(this.bucket);
    await this.ensureBucket(AVATAR_BUCKET);
    await this.ensureBucket(ATTACHMENTS_BUCKET);
    await this.ensureBucket(CASE_EVIDENCE_BUCKET);
  }

  private async ensureBucket(bucket: string) {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }

  async upload(key: string, buffer: Buffer, contentType?: string) {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      "Content-Type": contentType ?? "application/octet-stream",
    });
    return key;
  }

  async delete(key: string) {
    await this.client.removeObject(this.bucket, key);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async uploadAvatar(key: string, buffer: Buffer, contentType?: string) {
    await this.client.putObject(AVATAR_BUCKET, key, buffer, buffer.length, {
      "Content-Type": contentType ?? "application/octet-stream",
    });
    return `${this.publicUrl}/${AVATAR_BUCKET}/${key}`;
  }

  async uploadAttachment(key: string, buffer: Buffer, contentType?: string) {
    await this.client.putObject(ATTACHMENTS_BUCKET, key, buffer, buffer.length, {
      "Content-Type": contentType ?? "application/octet-stream",
    });
    return `${this.publicUrl}/${ATTACHMENTS_BUCKET}/${key}`;
  }

  async deleteAttachment(key: string) {
    await this.client.removeObject(ATTACHMENTS_BUCKET, key);
  }

  /** Evidências de casos nunca recebem URL pública nem política anônima. */
  async uploadCaseEvidence(key: string, buffer: Buffer, contentType?: string) {
    await this.client.putObject(CASE_EVIDENCE_BUCKET, key, buffer, buffer.length, {
      "Content-Type": contentType ?? "application/octet-stream",
    });
    return key;
  }

  async getCaseEvidence(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(CASE_EVIDENCE_BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async deleteCaseEvidence(key: string) {
    await this.client.removeObject(CASE_EVIDENCE_BUCKET, key);
  }

  /** Move anexos legados de casos para o bucket privado; mídias da timeline permanecem públicas. */
  async migrateLegacyCaseEvidence(key: string) {
    const privateStat = await this.statObjectIfExists(CASE_EVIDENCE_BUCKET, key);
    const publicStat = await this.statObjectIfExists(ATTACHMENTS_BUCKET, key);

    if (privateStat) {
      if (!publicStat) {
        return {
          size: privateStat.size,
          contentType: privateStat.metaData?.["content-type"] as string | undefined,
        };
      }
      if (privateStat.size !== publicStat.size) {
        throw new Error(`Cópia privada de ${key} diverge do anexo público; remoção abortada`);
      }
      await this.client.removeObject(ATTACHMENTS_BUCKET, key);
      return {
        size: privateStat.size,
        contentType: privateStat.metaData?.["content-type"] as string | undefined,
      };
    }
    if (!publicStat) throw new Error(`Evidência legada ${key} não foi encontrada em nenhum bucket`);

    const stream = await this.client.getObject(ATTACHMENTS_BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const buffer = Buffer.concat(chunks);
    if (buffer.length !== publicStat.size) {
      throw new Error(`Leitura incompleta da evidência legada ${key}`);
    }
    await this.client.putObject(CASE_EVIDENCE_BUCKET, key, buffer, buffer.length);
    const copiedStat = await this.client.statObject(CASE_EVIDENCE_BUCKET, key);
    if (copiedStat.size !== publicStat.size) {
      throw new Error(`Falha ao verificar a cópia privada da evidência ${key}`);
    }
    await this.client.removeObject(ATTACHMENTS_BUCKET, key);
    return {
      size: copiedStat.size,
      contentType: publicStat.metaData?.["content-type"] as string | undefined,
    };
  }

  private async statObjectIfExists(bucket: string, key: string) {
    try {
      return await this.client.statObject(bucket, key);
    } catch (error) {
      const storageError = error as { code?: string; statusCode?: number };
      if (
        storageError.statusCode === 404 ||
        storageError.code === "NotFound" ||
        storageError.code === "NoSuchKey" ||
        storageError.code === "NoSuchObject"
      ) {
        return null;
      }
      throw error;
    }
  }

  /** Remove o avatar a partir da URL pública, desde que pertença ao próprio usuário. */
  async deleteAvatarByUrl(url: string, userId: string) {
    const key = this.keyFromPublicUrl(url, AVATAR_BUCKET, `users/${userId}/`);
    if (key) await this.client.removeObject(AVATAR_BUCKET, key);
  }

  /** Remove uma mídia enviada pela gestão da timeline; as do seed ficam em outro bucket e são ignoradas. */
  async deleteTimelineMediaByUrl(url: string) {
    const key = this.keyFromPublicUrl(url, ATTACHMENTS_BUCKET, "timeline/");
    if (key) await this.client.removeObject(ATTACHMENTS_BUCKET, key);
  }

  private keyFromPublicUrl(url: string, bucket: string, prefix: string) {
    const base = `${this.publicUrl}/${bucket}/`;
    if (!url.startsWith(base)) return null;
    const key = url.slice(base.length);
    return key.startsWith(prefix) ? key : null;
  }
}
