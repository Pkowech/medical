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
} from '@nestjs/common';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';
import { CreateNotificationDto } from '#common/dto/notification.dto';
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
