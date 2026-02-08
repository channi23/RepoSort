import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  prompt!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Type(() => String)
  selectedNodeIds!: string[];
}
