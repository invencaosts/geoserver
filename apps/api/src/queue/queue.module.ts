import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>("REDIS_URL")!);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port),
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
