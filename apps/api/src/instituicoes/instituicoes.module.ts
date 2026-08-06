import { Module } from "@nestjs/common";
import { InstituicoesService } from "./instituicoes.service";
import { InstituicoesController } from "./instituicoes.controller";

@Module({
  providers: [InstituicoesService],
  controllers: [InstituicoesController],
})
export class InstituicoesModule {}
