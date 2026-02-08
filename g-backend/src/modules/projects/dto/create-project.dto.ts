import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateProjectDto {
  @IsUrl({ require_tld: false })
  repoUrl!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
