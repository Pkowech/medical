// src/modules/engagement/dto/engagement-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class BadgeDto {
  @ApiProperty({ description: 'Badge ID' })
  id!: string;

  @ApiProperty({ description: 'Badge name' })
  name!: string;

  @ApiProperty({ description: 'Badge description' })
  description!: string;

  @ApiProperty({ description: 'Date when badge was earned' })
  earnedAt!: string;
}

export class StreakStatisticsDto {
  @ApiProperty({ description: 'Current streak count' })
  current!: number;

  @ApiProperty({ description: 'Longest streak achieved' })
  longest!: number;
}

export class RankingsDto {
  @ApiProperty({ description: 'Overall rank' })
  overall!: number;

  @ApiProperty({ description: 'Monthly rank' })
  monthly!: number;
}

export class UserEngagementResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Total engagement points' })
  totalPoints!: number;

  @ApiProperty({ description: 'User level based on points' })
  level!: number;

  @ApiProperty({
    description: 'User badges',
    type: () => [BadgeDto],
  })
  badges!: BadgeDto[];

  @ApiProperty({
    description: 'Streak statistics',
    type: () => StreakStatisticsDto,
  })
  streaks!: StreakStatisticsDto;

  @ApiProperty({
    description: 'User rankings',
    type: () => RankingsDto,
  })
  rankings!: RankingsDto;
}
