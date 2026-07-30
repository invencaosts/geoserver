import { Module } from "@nestjs/common";
import { LayersService } from "./layers.service";
import { LayersController } from "./layers.controller";

@Module({
  providers: [LayersService],
  controllers: [LayersController],
})
export class LayersModule {}
