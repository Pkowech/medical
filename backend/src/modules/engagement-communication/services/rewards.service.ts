import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async grantReward(userId: string, reward: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { rewards: { push: reward } },
    });
  }

  async getRewards(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.rewards ?? [];
  }
}
