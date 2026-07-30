import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { LayersService } from "./layers.service";
import { CreateLayerDto } from "./dto/create-layer.dto";
import { UpdateLayerDto } from "./dto/update-layer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";

@Controller("layers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LayersController {
  constructor(private layersService: LayersService) {}

  @Get()
  @RequirePermissions("layer:read")
  findAll() {
    return this.layersService.findAll();
  }

  @Get(":id")
  @RequirePermissions("layer:read")
  findOne(@Param("id") id: string) {
    return this.layersService.findOne(id);
  }

  @Post()
  @RequirePermissions("layer:write")
  create(@Body() dto: CreateLayerDto) {
    return this.layersService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("layer:write")
  update(@Param("id") id: string, @Body() dto: UpdateLayerDto) {
    return this.layersService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("layer:delete")
  remove(@Param("id") id: string) {
    return this.layersService.remove(id);
  }
}
