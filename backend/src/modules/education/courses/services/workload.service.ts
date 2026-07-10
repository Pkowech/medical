import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { EnrollmentType, EnrollmentStatus } from '@prisma/client';

@Injectable()
export class WorkloadService {
  private readonly logger = new Logger(WorkloadService.name);

  // Limits in credits (1 credit ≈ 10 estimated hours)
  private readonly LIMITS = {
    [EnrollmentType.full_time]: 60,
    [EnrollmentType.part_time]: 30,
    [EnrollmentType.self_paced]: 45, // Further increased from 24
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates if a user can enroll in another course without exceeding their workload limit.
   */
  async validateWorkload(userId: string, courseId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { enrollmentType: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const nextCourse = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { estimatedHours: true, name: true },
    });

    if (!nextCourse) {
      throw new BadRequestException('Course not found');
    }

    const currentWorkload = await this.calculateCurrentWorkload(userId);
    const nextCourseCredits = this.hoursToCredits(
      nextCourse.estimatedHours || 0,
    );
    const totalPotentialWorkload = currentWorkload + nextCourseCredits;
    const limit = this.LIMITS[user.enrollmentType];

    if (totalPotentialWorkload > limit) {
      this.logger.warn(
        `Workload limit exceeded for user ${userId}. Current: ${currentWorkload}, Next: ${nextCourseCredits}, Limit: ${limit}`,
      );
      throw new BadRequestException(
        `Workload limit exceeded for your enrollment type (${user.enrollmentType.replace('_', ' ')}). ` +
          `Current workload: ${currentWorkload.toFixed(1)} credits. ` +
          `Course "${nextCourse.name}" requires ${nextCourseCredits.toFixed(1)} credits. ` +
          `Maximum allowed: ${limit} credits.`,
      );
    }
  }

  /**
   * Calculates the current workload in credits for a user based on active enrollments.
   */
  async calculateCurrentWorkload(userId: string): Promise<number> {
    const activeEnrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        userId,
        status: EnrollmentStatus.active,
      },
      include: {
        course: {
          select: { estimatedHours: true },
        },
      },
    });

    return activeEnrollments.reduce((total, enrollment) => {
      return total + this.hoursToCredits(enrollment.course.estimatedHours || 0);
    }, 0);
  }

  private hoursToCredits(hours: number): number {
    return hours / 10;
  }
}
