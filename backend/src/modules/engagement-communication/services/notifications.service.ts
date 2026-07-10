import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

type NotificationSeverity = 'critical' | 'important' | 'suggestion';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * UX-001: Check if notification exceeds daily severity limit
   */
  private async checkThrottleLimit(
    userId: string,
    severity: NotificationSeverity,
  ): Promise<boolean> {
    const limits: Record<NotificationSeverity, number> = {
      critical: 1,
      important: 3,
      suggestion: Infinity,
    };

    const limit = limits[severity];
    if (limit === Infinity) {
      return true; // No throttling for suggestions
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const count = await (this.prisma as any).notification.count({
      where: {
        userId,
        severity,
        createdAt: { gte: todayStart },
        throttled: false,
      },
    });

    return count < limit;
  }

  async create(
    userId: string,
    content: string,
    type?: string,
    metadata?: any,
    severity: NotificationSeverity = 'suggestion',
    sentViaPush = false,
  ) {
    // UX-001: Check throttle
    const canSend = await this.checkThrottleLimit(userId, severity);

    if (!canSend) {
      this.logger.warn(
        `Notification throttled for user ${userId}, severity: ${severity}`,
      );

      // Still create notification but mark as throttled
      return await (this.prisma as any).notification.create({
        data: {
          userId,
          message: content,
          type: type || 'info',
          metadata: metadata || {},
          severity,
          throttled: true,
          sentViaPush: false, // Don't send throttled notifications
        },
      });
    }

    return await (this.prisma as any).notification.create({
      data: {
        userId,
        message: content,
        type: type || 'info',
        metadata: metadata || {},
        severity,
        throttled: false,
        sentViaPush, // UX-002: Track if sent via push
      },
    });
  }

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async markAsRead(notificationId: string, _userId: string) {
    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async delete(notificationId: string, userId: string): Promise<void> {
    // Use deleteMany to ensure we only delete if the notification belongs to the user
    const result = await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Notification not found or not owned by user',
      );
    }
  }
}
