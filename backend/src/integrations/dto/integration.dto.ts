import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveIntegrationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indiamartApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webappUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  websiteLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processSutraApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processSutraSystemName?: string;
}

export class StartFlowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  systemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  initialFormData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyAssignee?: boolean;
}

export class FetchIndiamartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;
}

export class AutoImportIndiamartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;
}
