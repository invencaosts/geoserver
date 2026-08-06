import { Controller, Get, Query } from "@nestjs/common";
import { InstituicoesService } from "./instituicoes.service";

@Controller("instituicoes")
export class InstituicoesController {
  constructor(private instituicoesService: InstituicoesService) {}

  @Get()
  search(@Query("q") q: string) {
    return this.instituicoesService.search(q);
  }
}
