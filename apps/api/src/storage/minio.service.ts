import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";

const AVATAR_BUCKET = "avatars";

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
    this.bucket = this.config.get<string>("MINIO_BUCKET")!;
    this.publicUrl =
      this.config.get<string>("MINIO_PUBLIC_URL") ??
      `http://${this.config.get<string>("MINIO_ENDPOINT")}:${this.config.get<string>("MINIO_PORT")}`;
  }

  async onModuleInit() {
    await this.ensureBucket(this.bucket);
    await this.ensureBucket(AVATAR_BUCKET);
    await this.client.setBucketPolicy(
      AVATAR_BUCKET,
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${AVATAR_BUCKET}/*`],
          },
        ],
      }),
    );
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
}
