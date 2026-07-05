import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { CreateFormDto } from './create-form.dto';

export class UpdateFormDto extends PartialType(CreateFormDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
