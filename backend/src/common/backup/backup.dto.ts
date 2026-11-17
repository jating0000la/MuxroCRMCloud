import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class TriggerBackupDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 7 })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays?: number;
}

export class RestoreBackupDto {
  @ApiProperty({ enum: ['RESTORE'] })
  @Equals('RESTORE')
  confirmation: 'RESTORE';
}
