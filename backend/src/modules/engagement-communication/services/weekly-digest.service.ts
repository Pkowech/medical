import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  WeeklyDigest,
  CPDActivity,
  Material,
  User,
  CPDActivityType,
} from '@prisma/client';

interface WeeklyDigestContent {
  new_materials: {
    material: Material;
    relevance: number;
  }[];
  recommended_topics: any[];
  cpd_progress: {
    points_earned: number;
    points_required: number;
    activities: {
      type: CPDActivityType;
      points: number;
      date: Date;
    }[];
  };
  upcoming_deadlines: any[];
}

interface MaterialMetadata {
  cpd_points?: number;
}

@Injectable()
export class WeeklyDigestService {
  constructor(private readonly prisma: PrismaService) {}

  async generateWeeklyDigest(userId: string): Promise<WeeklyDigest> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const activities = await this.prisma.cPDActivity.findMany({
      where: { userId, activityDate: { gte: startDate, lte: endDate } },
      include: { material: true },
    });

    const newMaterials = await this.prisma.material.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const totalPoints = activities.reduce(
      (sum: number, activity: CPDActivity) => sum + activity.points,
      0,
    );

    const content: WeeklyDigestContent = {
      new_materials: newMaterials.map((m: Material) => ({
        material: m,
        relevance: 1.0,
      })),
      recommended_topics: [],
      cpd_progress: {
        points_earned: totalPoints,
        points_required: 50,
        activities: activities.map((a: CPDActivity) => ({
          type: a.activityType,
          points: a.points,
          date: a.activityDate,
        })),
      },
      upcoming_deadlines: [],
    };

    const digest = await this.prisma.weeklyDigest.create({
      data: {
        userId,
        weekStartDate: startDate,
        weekEndDate: endDate,
        isSent: false,
        status: 'pending',
        content: content as any,
      },
    });

    return digest;
  }

  async getLatestDigest(userId: string): Promise<WeeklyDigest | null> {
    return this.prisma.weeklyDigest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markDigestAsRead(digestId: string): Promise<WeeklyDigest> {
    const digest = await this.prisma.weeklyDigest.findUnique({
      where: { id: digestId },
    });
    if (!digest) {
      throw new Error('Digest not found');
    }

    return this.prisma.weeklyDigest.update({
      where: { id: digestId },
      data: { status: 'read', readAt: new Date() },
    });
  }

  async getUnreadDigestCount(userId: string): Promise<number> {
    return this.prisma.weeklyDigest.count({
      where: { userId, status: 'pending' },
    });
  }

  private async getRelevantMaterials(_user: User): Promise<Material[]> {
    return this.prisma.material.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  private calculatePoints(materials: Material[]): number {
    return materials.reduce(
      (acc: number, material: Material) =>
        acc + ((material.metadata as MaterialMetadata)?.cpd_points || 0),
      0,
    );
  }
}
