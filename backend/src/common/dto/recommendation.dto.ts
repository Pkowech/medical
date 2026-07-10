import { ApiProperty } from '@nestjs/swagger';

export class LearningPathRecommendationDto {
  @ApiProperty({ description: 'Learning path id' })
  pathId!: string;

  @ApiProperty({ description: 'Recommendation score' })
  score!: number;

  @ApiProperty({ description: 'Reasons for the recommendation', isArray: true })
  reasons!: string[];

  @ApiProperty({
    description: 'Confidence for the recommendation',
    required: false,
  })
  confidence?: number;

  @ApiProperty({
    description: 'Estimated completion time (hours)',
    required: false,
  })
  estimatedCompletionTime?: number;
}

export class RecommendationDto {
  @ApiProperty({ description: 'Material ID' })
  materialId!: string;

  @ApiProperty({ description: 'Recommendation score' })
  score!: number;

  @ApiProperty({ description: 'Reason for recommendation' })
  reason!: string;
}
