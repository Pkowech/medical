import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { FlashcardsService } from '../services/flashcards.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '#common/decorators/current-user.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { getUserPrimaryRole } from '#common/utils/role.util';

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('create')
  async createFlashcard(
    @Body('questionId') questionId: string,
    @CurrentUser() currentUser: User,
  ) {
    // construct a CreateFlashcardDto shape so the service signature is satisfied
    const dto = { questionId } as any;
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

  @Post('update/:cardId')
  async updateCard(
    @Param('cardId') cardId: string,
    @Body('quality') quality: number,
  ) {
    return this.flashcardsService.updateCard(cardId, quality);
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
