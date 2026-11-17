import { Transform } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, ValidateIf } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password', 'role'] as const), { skipNullProperties: false }) {
	@ApiPropertyOptional({ enum: ['ADMIN', 'USER'] })
	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(['ADMIN', 'USER'])
	role?: 'ADMIN' | 'USER';

	@ApiPropertyOptional()
	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	@Transform(({ obj }) => obj.isActive)
	isActive?: boolean;
}
