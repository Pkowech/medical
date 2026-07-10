import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardPoints(userId: string, points: number) {
    // Example logic: add points to user
    return this.prisma.user.update({
      where: { id: userId },
      data: { points: { increment: points } },
    });
  }

  async getUserPoints(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.points ?? 0;
  }
}
