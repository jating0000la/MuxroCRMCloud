import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AllocateLeadsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  leadIds: string[];
}
