import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FlashcardsService } from '../services/flashcards.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('create')
  async createFlashcard(
    @Body('userId') userId: string,
    @Body('questionId') questionId: string,
  ) {
    // construct a CreateFlashcardDto shape so the service signature is satisfied
    const dto = { questionId } as any;
    return this.flashcardsService.createFlashcard(userId, dto);
  }

  @Get('due/:userId')
  async getDueCards(@Param('userId', ParseUUIDPipe) userId: string) {
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
  async getCardStats(@Param('userId') userId: string) {
    return this.flashcardsService.getCardStats(userId);
  }

  @Get('high-risk-topics/:userId')
  async getHighRiskTopics(@Param('userId') userId: string) {
    return this.flashcardsService.getHighRiskTopics(userId);
  }

  @Post('sync/:userId')
  async syncCards(
    @Param('userId') userId: string,
    @Body('cards') cards: any[],
  ) {
    return this.flashcardsService.syncCards(userId, cards);
  }
}
