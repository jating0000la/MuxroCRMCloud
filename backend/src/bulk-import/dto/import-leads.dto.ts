import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsObject, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const MAX_IMPORT_ROWS = 5000;

// Parse only explicit true/false literals, avoiding Boolean('false') coercion.
export class ImportOptionsDto {
  @IsOptional()
  @Transform(({ obj }) => obj.allocateRoundRobin === 'true' ? true : obj.allocateRoundRobin === 'false' ? false : obj.allocateRoundRobin)
  @IsBoolean()
  allocateRoundRobin?: boolean;
}

export class ImportLeadsDto extends ImportOptionsDto {
  @Type(() => Object)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @IsObject({ each: true })
  data: Record<string, unknown>[];
}
