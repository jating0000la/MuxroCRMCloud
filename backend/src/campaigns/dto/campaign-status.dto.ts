import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateCampaignStatusDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  whatsappMessage?: string;
}

export class UpdateCampaignStatusDto extends PartialType(CreateCampaignStatusDto, { skipNullProperties: false }) {
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
