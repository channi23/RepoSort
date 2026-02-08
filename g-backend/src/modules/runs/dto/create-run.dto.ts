import { IsUUID } from 'class-validator';

export class CreateRunDto {
  @IsUUID()
  projectId!: string;
  
  @IsUUID()
  repoSnapshotId!: string;

  @IsUUID()
  planId!: string;
}
