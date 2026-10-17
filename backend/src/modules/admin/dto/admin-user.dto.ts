import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateUserDto } from '#common/dto/user.dto';

const adminUserStatuses = ['active', 'inactive', 'suspended'] as const;

export class AdminCreateUserDto extends CreateUserDto {
  @IsOptional()
  @IsIn(adminUserStatuses)
  status?: (typeof adminUserStatuses)[number];
}

export class AdminUpdateUserDto extends PartialType(AdminCreateUserDto) {}
