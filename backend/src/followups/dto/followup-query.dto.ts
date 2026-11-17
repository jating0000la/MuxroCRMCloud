import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class FollowupQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsISO8601()
  cursor?: string;
}
