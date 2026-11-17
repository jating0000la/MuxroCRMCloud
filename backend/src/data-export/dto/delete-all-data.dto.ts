import { Equals, IsString } from 'class-validator';

export class DeleteAllDataDto {
  @IsString()
  @Equals('DELETE ALL')
  confirmation: string;
}
