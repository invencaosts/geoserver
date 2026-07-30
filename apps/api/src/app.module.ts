import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { QueueModule } from "./queue/queue.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { LayersModule } from "./layers/layers.module";
import { DatasetsModule } from "./datasets/datasets.module";
import { CasesModule } from "./cases/cases.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    QueueModule,
    AuthModule,
    UsersModule,
    LayersModule,
    DatasetsModule,
    CasesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
