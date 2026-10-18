import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';
import { CreateNotificationDto } from '#common/dto/notification.dto';
import type { AuthenticatedRequest } from '#common/dto/user.dto';
import { PushSubscriptionDto } from '#common/dto/push-subscription.dto';
import { PushNotificationsService } from '../services/push-notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Get('push/public-key')
  getPushPublicKey() {
    return { publicKey: this.pushNotificationsService.getPublicKey() };
  }

  @Post('push/subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerPushSubscription(
    @Request() req: AuthenticatedRequest,
    @Body() subscription: PushSubscriptionDto,
  ): Promise<void> {
    await this.pushNotificationsService.registerSubscription(
      req.user.id,
      subscription,
    );
  }

  @Delete('push/subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePushSubscription(
    @Request() req: AuthenticatedRequest,
    @Query('endpoint') endpoint?: string,
  ): Promise<void> {
    await this.pushNotificationsService.removeSubscription(
      req.user.id,
      endpoint,
    );
  }

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateNotificationDto,
  ) {
    const userId = dto.userId || req.user?.id;
    return this.notificationsService.create(userId, dto.content, dto.type, {
      title: dto.title,
      actionUrl: dto.actionUrl,
    });
  }

  @Get()
  findByUser(
    @Request() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user?.id;
    return this.notificationsService.findByUser(userId, page, limit);
  }

  @Patch(':id/read')
  async markAsRead(
    @Request() req: AuthenticatedRequest,
    @Param('id') notificationId: string,
  ) {
    const userId = req.user?.id;
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  @Delete(':id')
  async deleteNotification(
    @Request() req: AuthenticatedRequest,
    @Param('id') notificationId: string,
  ) {
    const userId = req.user?.id;
    return this.notificationsService.delete(notificationId, userId);
  }
}
