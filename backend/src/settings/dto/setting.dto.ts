import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateSettingDto {
  @IsString()
  value: string;

  @IsOptional()
  lastTestedAt?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class SettingResponseDto {
  key: string;
  value: string;
  isMasked: boolean;
  lastTestedAt?: Date | null;
  updatedAt: Date;
}
