import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

interface DirectMessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sender?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

interface DirectConversationParticipantRecord {
  userId: string;
  lastReadAt: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

interface DirectConversationRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  participants: DirectConversationParticipantRecord[];
  messages: DirectMessageRecord[];
}

@Injectable()
export class DirectMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(userId: string, search: string) {
    const term = search.trim();
    if (term.length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
        OR: [
          { username: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 10,
    });

    return users.map(user => ({
      id: user.id,
      name: this.displayName(user),
      username: user.username,
    }));
  }

  async createConversation(userId: string, targetUserId: string) {
    if (targetUserId === userId) {
      throw new BadRequestException('You cannot start a conversation with yourself.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, isActive: true },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found.');

    const pairKey = [userId, targetUserId].sort().join(':');
    const conversation = await this.prisma.directConversation.upsert({
      where: { pairKey },
      create: {
        pairKey,
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      update: {},
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: true },
        },
      },
    });

    return this.mapConversation(conversation, userId);
  }

  async getConversations(userId: string) {
    const conversations = (await this.prisma.directConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })) as DirectConversationRecord[];

    return Promise.all(
      conversations.map(conversation =>
        this.mapConversation(conversation, userId),
      ),
    );
  }

  async getMessages(userId: string, conversationId: string, limit?: string) {
    const participant = await this.getParticipant(conversationId, userId);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 50;
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new BadRequestException('Message limit must be between 1 and 100.');
    }

    const messages = (await this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: parsedLimit,
      include: { sender: true },
    })) as DirectMessageRecord[];

    await this.prisma.directConversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });

    const recipients = (await this.prisma.directConversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true, lastReadAt: true },
    })) as Array<{ userId: string; lastReadAt: Date | null }>;
    const recipientReadAt = recipients.find(
      recipient => recipient.userId !== userId,
    )?.lastReadAt;

    return messages.map(message =>
      this.mapMessage(
        message,
        message.senderId === userId ||
          (!!recipientReadAt && message.createdAt <= recipientReadAt),
      ),
    );
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    await this.getParticipant(conversationId, userId);
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      throw new BadRequestException('Message content cannot be empty.');
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.directMessage.create({
        data: { conversationId, senderId: userId, content: normalizedContent },
        include: { sender: true },
      }),
      this.prisma.directConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return this.mapMessage(message as DirectMessageRecord, false);
  }

  async markAsRead(userId: string, conversationId: string) {
    await this.getParticipant(conversationId, userId);
    await this.prisma.directConversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }

  private async getParticipant(conversationId: string, userId: string) {
    const participant =
      await this.prisma.directConversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
    if (!participant) {
      const conversation = await this.prisma.directConversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found.');
      throw new ForbiddenException('You are not a participant in this conversation.');
    }
    return participant;
  }

  private async mapConversation(
    conversation: DirectConversationRecord,
    userId: string,
  ) {
    const currentParticipant = conversation.participants.find(
      participant => participant.userId === userId,
    );
    const otherParticipant = conversation.participants.find(
      participant => participant.userId !== userId,
    );
    if (!currentParticipant || !otherParticipant) {
      throw new NotFoundException('Conversation participants are incomplete.');
    }
    const unreadCount = await this.prisma.directMessage.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        createdAt: { gt: currentParticipant.lastReadAt },
      },
    });

    const latest = conversation.messages[0] as DirectMessageRecord | undefined;
    return {
      id: conversation.id,
      participants: conversation.participants.map(participant => ({
        id: participant.user.id,
        name: this.displayName(participant.user),
      })),
      lastMessage: latest
        ? this.mapMessage(
            latest,
            latest.senderId === userId ||
              latest.createdAt <= otherParticipant.lastReadAt,
          )
        : undefined,
      unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private mapMessage(message: DirectMessageRecord, read: boolean) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: {
        id: message.senderId,
        name: message.sender ? this.displayName(message.sender) : '',
      },
      content: message.content,
      timestamp: message.createdAt,
      read,
    };
  }

  private displayName(user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  }) {
    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || user.username || 'MedTrack user';
  }
}
