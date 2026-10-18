import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { FlashcardsService } from '../services/flashcards.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '#common/decorators/current-user.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { getUserPrimaryRole } from '#common/utils/role.util';
import { CreateFlashcardDto } from '#common/dto';

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('create')
  async createFlashcard(
    @Body() dto: CreateFlashcardDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.flashcardsService.createFlashcard(currentUser.id, dto);
  }

  @Get('due/:userId')
  async getDueCards(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanAccessUser(currentUser, userId);
    return this.flashcardsService.getDueCards(userId);
  }

  @Get('schedule/:userId')
  async getScheduledReviews(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanAccessUser(currentUser, userId);
    return this.flashcardsService.getScheduledReviews(
      userId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('update/:cardId')
  async updateCard(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body('quality') quality: number,
    @CurrentUser() currentUser: User,
  ) {
    return this.flashcardsService.updateCard(cardId, quality, currentUser.id);
  }

  @Get('overview/:userId')
  async getCardStats(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanAccessUser(currentUser, userId);
    return this.flashcardsService.getCardStats(userId);
  }

  @Get('high-risk-topics/:userId')
  async getHighRiskTopics(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanAccessUser(currentUser, userId);
    return this.flashcardsService.getHighRiskTopics(userId);
  }

  @Post('sync/:userId')
  async syncCards(
    @Param('userId') userId: string,
    @Body('cards') cards: any[],
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanAccessUser(currentUser, userId);
    return this.flashcardsService.syncCards(userId, cards);
  }

  private assertCanAccessUser(currentUser: User, requestedUserId: string): void {
    if (currentUser.id !== requestedUserId && getUserPrimaryRole(currentUser) !== Role.admin) {
      throw new ForbiddenException('You can only access your own flashcards');
    }
  }
}
