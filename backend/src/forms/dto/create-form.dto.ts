import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class FormFieldDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty({ enum: ['text', 'email', 'phone', 'number', 'textarea', 'select', 'date'] })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  options?: string[];
}

export class CreateFormDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  fields?: FormFieldDto[];
}
