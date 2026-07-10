import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingStepDto {
  @ApiProperty({ example: 'profile' })
  @IsString()
  step!: string;

  @ApiProperty({ example: true })
  completed!: boolean;
}

export class OnboardingResponseDto {
  @ApiProperty({ type: () => OnboardingStepDto, isArray: true })
  @Type(() => OnboardingStepDto)
  steps!: OnboardingStepDto[];

  @ApiProperty({ example: 75 })
  progress!: number;
}
