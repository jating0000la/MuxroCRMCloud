import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';
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

export class SendGupshupMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disablePreview?: boolean;
}

export class SendGupshupTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  templateParams?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  mediaMessage?: { type: string; link: string };
}

export class TestGupshupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  testPhone: string;
}
