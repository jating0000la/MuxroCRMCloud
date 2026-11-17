import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'newuser' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/^(?=.*[A-Z])/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/^(?=.*\d)/, { message: 'Password must contain at least one number' })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'john@crm.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'USER'], default: 'USER' })
  @IsOptional()
  @IsEnum(['ADMIN', 'USER'])
  role?: 'ADMIN' | 'USER';
}
