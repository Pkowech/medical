import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { DirectMessagesService } from '../services/direct-messages.service';

class CreateConversationDto {
  @IsUUID()
  targetUserId!: string;
}

class SendDirectMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}

interface AuthenticatedRequest {
  user: { id: string };
}

@ApiTags('Direct Messages')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(private readonly directMessagesService: DirectMessagesService) {}

  @Get('users')
  searchUsers(
    @Request() request: AuthenticatedRequest,
    @Query('search') search = '',
  ) {
    return this.directMessagesService.searchUsers(request.user.id, search);
  }

  @Post('conversations')
  createConversation(
    @Request() request: AuthenticatedRequest,
    @Body() body: CreateConversationDto,
  ) {
    return this.directMessagesService.createConversation(
      request.user.id,
      body.targetUserId,
    );
  }

  @Get('conversations')
  getConversations(@Request() request: AuthenticatedRequest) {
    return this.directMessagesService.getConversations(request.user.id);
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @Request() request: AuthenticatedRequest,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.directMessagesService.getMessages(
      request.user.id,
      conversationId,
      limit,
    );
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @Request() request: AuthenticatedRequest,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: SendDirectMessageDto,
  ) {
    return this.directMessagesService.sendMessage(
      request.user.id,
      conversationId,
      body.content,
    );
  }

  @Post('conversations/:conversationId/read')
  markAsRead(
    @Request() request: AuthenticatedRequest,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.directMessagesService.markAsRead(
      request.user.id,
      conversationId,
    );
  }
}
