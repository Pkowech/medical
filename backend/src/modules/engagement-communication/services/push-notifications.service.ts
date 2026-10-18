import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import webPush from 'web-push';
import { PushSubscriptionDto } from '#common/dto/push-subscription.dto';

export interface WebPushMessage {
  title: string;
  body: string;
  url: string;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly vapidPublicKey: string | undefined;
  private readonly configured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
    const configuredValues = [publicKey, privateKey, subject].filter(Boolean).length;

    if (configuredValues !== 0 && configuredValues !== 3) {
      throw new Error(
        'WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_VAPID_SUBJECT must be configured together.',
      );
    }

    this.configured = configuredValues === 3;
    this.vapidPublicKey = publicKey;

    if (this.configured && publicKey && privateKey && subject) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn(
        'Web Push is disabled because VAPID keys are not configured.',
      );
    }
  }

  getPublicKey(): string {
    if (!this.configured || !this.vapidPublicKey) {
      throw new ServiceUnavailableException(
        'Web Push is not configured on this server.',
      );
    }
    return this.vapidPublicKey;
  }

  async registerSubscription(
    userId: string,
    subscription: PushSubscriptionDto,
  ): Promise<void> {
    await this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      if (!user) throw new NotFoundException('User not found');

      const preferences = this.jsonObject(user.preferences);
      const notifications = this.jsonObject(preferences.notifications);
      await tx.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...preferences,
            notifications: { ...notifications, push: true },
          },
        },
      });

      await tx.pushSubscription.upsert({
        where: { userId_endpoint: { userId, endpoint: subscription.endpoint } },
        create: { userId, ...subscription },
        update: { p256dh: subscription.p256dh, auth: subscription.auth },
      });
    });
  }

  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    if (!endpoint) {
      throw new NotFoundException('Push subscription endpoint is required');
    }
    await this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      if (!user) throw new NotFoundException('User not found');

      const preferences = this.jsonObject(user.preferences);
      const notifications = this.jsonObject(preferences.notifications);
      await tx.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...preferences,
            notifications: { ...notifications, push: false },
          },
        },
      });
      await tx.pushSubscription.deleteMany({ where: { userId, endpoint } });
    });
  }

  async sendToUser(userId: string, message: WebPushMessage): Promise<boolean> {
    if (!this.configured) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const notifications = this.jsonObject(
      this.jsonObject(user?.preferences ?? null).notifications,
    );
    if (notifications.push !== true) return false;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return false;

    const payload = JSON.stringify({
      title: message.title.slice(0, 80),
      body: message.body.slice(0, 240),
      url: this.safePath(message.url),
    });
    const results = await Promise.all(
      subscriptions.map(async subscription => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: 60 * 60, urgency: 'normal' },
          );
          return true;
        } catch (error) {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'statusCode' in error &&
            typeof error.statusCode === 'number'
              ? error.statusCode
              : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({
              where: { id: subscription.id },
            });
            this.logger.warn(
              `Removed expired push subscription for user ${userId}.`,
            );
            return false;
          }
          this.logger.error(
            `Web Push delivery failed for user ${userId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return false;
        }
      }),
    );

    return results.some(Boolean);
  }

  private jsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): Prisma.InputJsonObject {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value)
      ? (value as Prisma.InputJsonObject)
      : {};
  }

  private safePath(path: string): string {
    return path.startsWith('/') && !path.startsWith('//')
      ? path
      : '/notifications';
  }
}
