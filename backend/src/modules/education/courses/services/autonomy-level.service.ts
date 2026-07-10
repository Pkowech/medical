import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { GuidanceLevel } from '@prisma/client';

@Injectable()
export class AutonomyLevelService {
  private readonly logger = new Logger(AutonomyLevelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine the effective guidance level for a user.
   * Logic:
   * 1. Check for manual override.
   * 2. If no override, calculate based on account age (tenure).
   *    - < 30 days: HIGH
   *    - 30-180 days: MEDIUM
   *    - > 180 days: LOW
   */
  async getEffectiveGuidanceLevel(userId: string): Promise<GuidanceLevel> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        guidanceLevel: true,
        guidanceLevelOverride: true,
      },
    });

    if (!user) {
      this.logger.warn(
        `User ${userId} not found, defaulting to HIGH guidance.`,
      );
      return GuidanceLevel.HIGH;
    }

    // 1. Manual Override
    if (user.guidanceLevelOverride && user.guidanceLevel) {
      return user.guidanceLevel;
    }

    // 2. Tenure-based calculation
    const tenureDays = this.calculateTenureDays(user.createdAt);

    if (tenureDays < 30) {
      return GuidanceLevel.HIGH;
    } else if (tenureDays < 180) {
      return GuidanceLevel.MEDIUM;
    } else {
      return GuidanceLevel.LOW;
    }
  }

  private calculateTenureDays(createdAt: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
