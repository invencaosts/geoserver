import { PartialType } from "@nestjs/mapped-types";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";
import { CreateTimelineEventDto } from "./create-timeline-event.dto";

export class UpdateTimelineEventDto extends PartialType(CreateTimelineEventDto) {
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  removeMedia?: boolean;
}
