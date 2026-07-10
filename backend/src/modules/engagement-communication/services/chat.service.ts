import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { ChatMessage, ChatSession, MessageRole } from '@prisma/client';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  topic?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  messageId: string;
  tokensUsed?: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic!: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ai.claude.apiKey');
    if (!apiKey) {
      this.logger.warn(
        'Claude API key not configured. Chat functionality will be disabled.',
      );
      return;
    }

    this.anthropic = new Anthropic({
      apiKey,
    });
  }

  async chat(userId: string, request: ChatRequest): Promise<ChatResponse> {
    if (!this.anthropic) {
      throw new BadRequestException('AI chat is not configured');
    }

    try {
      const session = await this.getOrCreateSession(
        userId,
        request.sessionId,
        request.topic,
      );

      const _userMessage = await this.saveMessage(
        session.id,
        userId,
        request.message,
        MessageRole.user,
      );

      const messages = await this.getConversationHistory(session.id);

      const aiResponse = await this.generateResponse(messages, request.topic);

      const aiMessage = await this.saveMessage(
        session.id,
        userId,
        aiResponse.content,
        MessageRole.assistant,
        { tokensUsed: aiResponse.tokensUsed },
      );

      return {
        message: aiResponse.content,
        sessionId: session.id,
        messageId: aiMessage.id,
        tokensUsed: aiResponse.tokensUsed,
      };
    } catch (error) {
      this.logger.error('Error in chat service:', error);
      throw new BadRequestException('Failed to generate response');
    }
  }

  private async getOrCreateSession(
    userId: string,
    sessionId?: string,
    topic?: string,
  ): Promise<ChatSession> {
    if (sessionId) {
      const existing = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (existing) {
        return existing;
      }
    }

    return await this.prisma.chatSession.create({
      data: {
        title: this.generateSessionTitle(topic),
        topic: topic || 'general',
        userId,
        context: this.getTopicContext(topic),
      },
    });
  }

  private async saveMessage(
    sessionId: string,
    userId: string,
    content: string,
    role: MessageRole,
    metadata?: Record<string, any>,
  ): Promise<ChatMessage> {
    return await this.prisma.chatMessage.create({
      data: { content, role, sessionId, userId, metadata },
    });
  }

  private async getConversationHistory(
    sessionId: string,
  ): Promise<ChatMessage[]> {
    return await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
  }

  private async generateResponse(
    messages: ChatMessage[],
    topic?: string,
  ): Promise<{ content: string; tokensUsed: number }> {
    const systemPrompt = this.getSystemPrompt(topic);

    const anthropicMessages = messages.map((msg) => ({
      role:
        msg.role === MessageRole.assistant
          ? ('assistant' as const)
          : ('user' as const),
      content: msg.content,
    }));

    const response = await this.anthropic.messages.create({
      model:
        this.configService.get<string>('ai.claude.model') ||
        'claude-3-5-sonnet-20241022',
      max_tokens: this.configService.get<number>('ai.claude.maxTokens') || 4096,
      temperature:
        this.configService.get<number>('ai.claude.temperature') || 0.7,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    return {
      content:
        response.content[0].type === 'text' ? response.content[0].text : '',
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  private getSystemPrompt(topic?: string): string {
    const basePrompt = `You are MedBot, an AI tutor for medical students using MedTrack Hub. You are knowledgeable, encouraging, and focused on helping students learn medicine effectively.

Key guidelines:
- Provide clear, accurate medical information
- Break down complex concepts into understandable parts
- Use medical terminology appropriately but explain when needed
- Encourage active learning and critical thinking
- Suggest study strategies and mnemonics when helpful
- Always emphasize the importance of clinical correlation
- If unsure about something, acknowledge limitations

Remember: You're a study assistant, not a replacement for clinical judgment or medical advice.`;

    const topicPrompts = {
      anatomy: `Focus on anatomical structures, relationships, and clinical correlations. Use spatial descriptions and suggest visualization techniques.`,
      physiology: `Emphasize mechanisms, processes, and how body systems work together. Use analogies to explain complex processes.`,
      pharmacology: `Focus on drug mechanisms, interactions, side effects, and clinical applications. Emphasize safety and contraindications.`,
      pathology: `Explain disease processes, causes, and manifestations. Connect pathophysiology to clinical presentations.`,
      clinical: `Focus on clinical reasoning, differential diagnosis, and evidence-based medicine. Encourage systematic thinking.`,
    };

    if (topic && topic in topicPrompts) {
      return `${basePrompt}\n\nSpecial focus for ${topic}: ${topicPrompts[topic as keyof typeof topicPrompts]}`;
    }

    return basePrompt;
  }

  private generateSessionTitle(topic?: string): string {
    const topicTitles = {
      anatomy: 'Anatomy Study Session',
      physiology: 'Physiology Discussion',
      pharmacology: 'Pharmacology Review',
      pathology: 'Pathology Study',
      clinical: 'Clinical Reasoning',
    };

    if (topic && topic in topicTitles) {
      return topicTitles[topic as keyof typeof topicTitles];
    }
    return `Study Session - ${new Date().toLocaleDateString()}`;
  }

  private getTopicContext(topic?: string): string {
    const contexts = {
      anatomy: 'Studying anatomical structures and relationships',
      physiology: 'Learning about body functions and mechanisms',
      pharmacology: 'Understanding drugs and their effects',
      pathology: 'Exploring disease processes',
      clinical: 'Developing clinical reasoning skills',
    };

    if (topic && topic in contexts) {
      return contexts[topic as keyof typeof contexts];
    }
    return 'General medical education discussion';
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return await this.prisma.chatSession.findMany({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
  }

  async getSessionMessages(
    sessionId: string,
    userId: string,
  ): Promise<ChatMessage[]> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    return await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }
}
