import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

export function parseRedisUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL deve usar o protocolo redis:// ou rediss://");
  }
  if (!url.hostname) throw new Error("REDIS_URL deve informar um host");

  const databaseText = url.pathname.replace(/^\//, "");
  const database = databaseText === "" ? 0 : Number(databaseText);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL contém um número de banco inválido");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: database } : {}),
    ...(url.protocol === "rediss:" ? { tls: { servername: url.hostname } } : {}),
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisUrl(config.getOrThrow<string>("REDIS_URL")),
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
