import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class FormFieldDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  max?: number;

  @ApiPropertyOptional()
  @IsOptional()
  rows?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  columns?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  meta?: any;
}

export class CreateFormDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];
}
