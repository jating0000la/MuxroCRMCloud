import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsIn } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'URL-encode the message text (for special characters)' })
  @IsOptional()
  @IsBoolean()
  encode?: boolean;
}

export class SendGupshupMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ enum: ['image', 'video', 'document', 'audio', 'location'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['image', 'video', 'document', 'audio', 'location'])
  mediaType: string;

  @ApiProperty({ description: 'Public URL of the media file' })
  @IsString()
  @IsNotEmpty()
  mediaUrl: string;

  @ApiPropertyOptional({ description: 'Optional caption (text, image, video, document only)' })
  @IsOptional()
  @IsString()
  caption?: string;
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
