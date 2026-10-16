import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class IvrOperatorDto {
  @IsString() @Matches(/^\d{1,30}$/) agentId: string;
  @IsString() @MaxLength(100) name: string;
}
export class CloudConnectConfigDto {
  @Transform(({ obj }) => obj.enabled) @IsBoolean() enabled: boolean;
  @IsString() @Matches(/^\d{1,30}$/) tenantId: string;
  @IsUUID() crmCampaignId: string;
  @IsArray() @ArrayMaxSize(100) @ArrayUnique() @Matches(/^\d{1,30}$/, { each: true }) inboundCampaignIds: string[];
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => IvrOperatorDto) operators: IvrOperatorDto[];
}
export class IvrListQueryDto {
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
