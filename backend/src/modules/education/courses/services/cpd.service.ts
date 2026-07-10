import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CPDActivity, CPDCycle, CPDActivityType, Prisma } from '@prisma/client';

@Injectable()
export class CPDService {
  constructor(private prisma: PrismaService) {}

  async createCPDActivity(
    userId: string,
    data: {
      activityType: CPDActivityType;
      points: number;
      description: string;
      title: string;
      materialId?: string;
      metadata?: Prisma.JsonValue;
    },
  ): Promise<CPDActivity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const activityData: any = {
      description: data.description,
      points: data.points,
      activityDate: new Date(),
      verified: false,
      user: { connect: { id: userId } },
      activityType: data.activityType,
      metadata:
        data.metadata === null
          ? Prisma.JsonNull
          : ({
              ...((data.metadata as object) || {}),
              title: data.title,
            } as Prisma.InputJsonValue),
    };

    if (data.materialId) {
      const material = await this.prisma.material.findUnique({
        where: { id: data.materialId },
      });
      if (material) {
        activityData.material = { connect: { id: data.materialId } };
      }
    }

    return this.prisma.cPDActivity.create({ data: activityData });
  }

  async getCurrentCPDCycle(userId: string): Promise<CPDCycle> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const currentDate = new Date();
    let cycle = await this.prisma.cPDCycle.findFirst({
      where: {
        userId,
        startDate: { lte: currentDate },
        endDate: { gte: currentDate },
      },
    });

    if (!cycle) {
      cycle = await this.prisma.cPDCycle.create({
        data: {
          name: 'CPD Cycle',
          user: { connect: { id: userId } },
          startDate: new Date(),
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1),
          ),
          requiredPoints: 0,
          isActive: true,
        },
      });
    }

    return cycle;
  }

  async getCPDActivities(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      activityType?: CPDActivityType;
      isVerified?: boolean;
    } = {},
  ): Promise<CPDActivity[]> {
    const where: Prisma.CPDActivityWhereInput = { userId };

    if (options.startDate) {
      where.activityDate = { gte: options.startDate };
    }
    if (options.endDate) {
      where.activityDate = {
        ...(where.activityDate as Prisma.DateTimeFilter),
        lte: options.endDate,
      };
    }
    if (options.activityType) {
      where.activityType = options.activityType;
    }
    if (options.isVerified !== undefined) {
      where.verified = options.isVerified;
    }

    return this.prisma.cPDActivity.findMany({ where });
  }

  async verifyCPDActivity(
    activityId: string,
    verified: boolean,
    notes?: string,
  ): Promise<CPDActivity> {
    const activity = await this.prisma.cPDActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity) {
      throw new Error('Activity not found');
    }

    return this.prisma.cPDActivity.update({
      where: { id: activityId },
      data: {
        verified,
        metadata: notes
          ? ({
              ...((activity.metadata as Prisma.JsonObject) || {}),
              verificationNotes: notes,
            } as Prisma.JsonObject)
          : activity.metadata === null
            ? Prisma.JsonNull
            : (activity.metadata as Prisma.InputJsonValue),
      },
    });
  }

  async updateCPDCycle(
    cycleId: string,
    data: {
      requiredPoints?: number;
    },
  ): Promise<CPDCycle> {
    const cycle = await this.prisma.cPDCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) {
      throw new Error('Cycle not found');
    }

    return this.prisma.cPDCycle.update({
      where: { id: cycleId },
      data: { requiredPoints: data.requiredPoints },
    });
  }
}
