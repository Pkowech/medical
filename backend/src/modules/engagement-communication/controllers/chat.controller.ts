import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import {
  ChatService,
  ChatRequest,
  ChatResponse,
} from '../services/chat.service';
import { ChatMessage, ChatSession, MessageRole } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
}

@ApiTags('Engagement')
@ApiBearerAuth()
@Controller('engagement/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI tutor' })
  @ApiResponse({
    status: 200,
    description: 'AI response generated successfully',
    type: Object, // Consider creating a DTO for the response
  })
  async sendMessage(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() chatRequest: ChatRequest,
  ): Promise<ChatResponse> {
    return await this.chatService.chat(req.user.id, chatRequest);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get user chat sessions' })
  @ApiResponse({
    status: 200,
    description: 'User sessions retrieved successfully',
    type: Object, // Consider creating a DTO for the response
  })
  async getUserSessions(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
  ): Promise<ChatSession[]> {
    return await this.chatService.getUserSessions(req.user.id);
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get messages from a specific session' })
  @ApiResponse({
    status: 200,
    description: 'Session messages retrieved successfully',
    type: Object, // Consider creating a DTO for the response
  })
  async getSessionMessages(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('sessionId') sessionId: string,
  ): Promise<ChatMessage[]> {
    return await this.chatService.getSessionMessages(sessionId, req.user.id);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a chat session' })
  @ApiResponse({
    status: 204,
    description: 'Session deleted successfully',
  })
  async deleteSession(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    return await this.chatService.deleteSession(sessionId, req.user.id);
  }

  @Post('sessions/:sessionId/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate the last AI response' })
  @ApiResponse({
    status: 200,
    description: 'Response regenerated successfully',
  })
  async regenerateResponse(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('sessionId') sessionId: string,
  ): Promise<ChatResponse> {
    const messages = await this.chatService.getSessionMessages(
      sessionId,
      req.user.id,
    );
    const lastUserMessage = messages
      .filter((msg) => msg.role === MessageRole.user)
      .pop();

    if (!lastUserMessage) {
      throw new Error('No user message found to regenerate response for');
    }

    return await this.chatService.chat(req.user.id, {
      message: lastUserMessage.content,
      sessionId,
    });
  }
}
