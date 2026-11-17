import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
export class TemplateMessageConfigDto {
  @IsString() @IsNotEmpty() @MaxLength(255) templateId: string;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(1024, { each: true }) params: string[];
  @IsOptional() @IsString() @MaxLength(2000) mediaUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) recipientField?: string;
}
