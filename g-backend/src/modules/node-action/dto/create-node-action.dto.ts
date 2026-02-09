import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNodeActionDto {
  @IsUUID()
  projectId!: string;

  @IsUUID()
  graphSnapshotId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Type(() => String)
  selectedNodeIds!: string[];

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  autoApply?: boolean;
}
