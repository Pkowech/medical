import { Injectable } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Progress } from '@prisma/client';
import { StudyGroupStats, PeerStats } from '#common/dto';

@Injectable()
export class PeerBenchmarkingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPeerStats(userId: string, topicId: string): Promise<PeerStats> {
    const userProgress = await this.prisma.progress.findFirst({
      where: { userId, topicId },
    });

    if (!userProgress) {
      return {
        userProgress: {
          completionPercentage: 0,
          timeSpent: 0,
          streakDays: 0,
        },
        peerAverages: {
          completionPercentage: 0,
          timeSpent: 0,
          streakDays: 0,
        },
        percentile: 0,
      };
    }

    const peerProgress = await this.prisma.progress.findMany({
      where: { topicId, NOT: { userId } },
    });

    return {
      userProgress: {
        completionPercentage: userProgress.completionPercentage ?? 0,
        timeSpent: userProgress.timeSpent ?? 0,
        streakDays: userProgress.streakDays ?? 0,
      },
      peerAverages: {
        completionPercentage: this.calculateAverage(
          peerProgress,
          'completionPercentage',
        ),
        timeSpent: this.calculateAverage(peerProgress, 'timeSpent'),
        streakDays: this.calculateAverage(peerProgress, 'streakDays'),
      },
      percentile: this.calculatePercentile(userProgress, peerProgress),
    };
  }

  async getLeaderboard(topicId: string, limit = 10) {
    return this.prisma.progress.findMany({
      where: { topicId },
      orderBy: [{ completionPercentage: 'desc' }, { streakDays: 'desc' }],
      take: limit,
      include: { user: { select: { id: true, username: true } } },
    });
  }

  async getStudyGroupStats(groupId: string): Promise<StudyGroupStats> {
    const members = await this.prisma.studyGroupMember.findMany({
      where: { studyGroupId: groupId },
      include: { user: { select: { id: true } } },
    });

    const memberIds = members.map((m) => m.user.id);
    if (!memberIds.length) {
      return {
        averageCompletion: 0,
        averageStreak: 0,
        totalStudyTime: 0,
        memberCount: 0,
      };
    }

    const groupProgress = await this.prisma.progress.findMany({
      where: { userId: { in: memberIds } },
    });

    return {
      averageCompletion: this.calculateAverage(
        groupProgress,
        'completionPercentage',
      ),
      averageStreak: this.calculateAverage(groupProgress, 'streakDays'),
      totalStudyTime: groupProgress.reduce(
        (sum, p) => sum + (p.timeSpent ?? 0),
        0,
      ),
      memberCount: members.length,
    };
  }

  private calculateAverage(
    progress: Progress[],
    field: 'completionPercentage' | 'timeSpent' | 'streakDays',
  ): number {
    if (!progress.length) {
      return 0;
    }
    const sum = progress.reduce((acc, p) => acc + (p[field] || 0), 0);
    return sum / progress.length;
  }

  private calculatePercentile(
    userProgress: Progress,
    peerProgress: Progress[],
  ): number {
    if (!userProgress || !peerProgress.length) {
      return 0;
    }
    const all = [...peerProgress, userProgress].sort(
      (a, b) => (b.completionPercentage ?? 0) - (a.completionPercentage ?? 0),
    );
    const index = all.findIndex((p) => p.id === userProgress.id);
    return ((index + 1) / all.length) * 100;
  }
}
