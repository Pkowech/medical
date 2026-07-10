import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { GroupDiscussion, DiscussionMessage, Prisma } from '@prisma/client';
import {
  CreateForumDto,
  UpdateForumDto,
  CreateTopicDto,
  CreatePostDto,
  ForumResponseDto,
} from '../../../common/dto/forum.dto';

// Interfaces for metadata to ensure type safety
interface GroupDiscussionMetadata {
  description?: string;
  category?: string;
  tags?: string[];
  isPrivate?: boolean;
}

interface DiscussionMessageMetadata {
  title?: string;
  tags?: string[];
  isTopicStarter?: boolean;
  attachments?: Prisma.JsonValue[];
}

@Injectable()
export class ForumService {
  constructor(private prisma: PrismaService) {}

  async createForum(data: CreateForumDto): Promise<ForumResponseDto> {
    const studyGroup = await this.prisma.studyGroup.create({
      data: {
        name: data.name,
        description: data.description,
        type: 'general', // Forums are a general type of study group
        privacy: data.isPrivate ? 'private' : 'public',
        maxMembers: 1000,
        status: 'active',
        inviteCode: `forum-${Date.now()}`,
        metadata: {
          category: data.category,
          tags: data.tags,
        },
      },
    });

    const metadata: GroupDiscussionMetadata = {
      description: data.description,
      category: data.category,
      tags: data.tags,
      isPrivate: data.isPrivate,
    };

    const forum = await this.prisma.groupDiscussion.create({
      data: {
        title: data.name,
        type: 'general',
        status: 'active',
        studyGroupId: studyGroup.id,
        metadata: metadata as any,
      },
    });

    return this.mapToForumResponse(forum);
  }

  async getForums(query: { category?: string }): Promise<ForumResponseDto[]> {
    const forums = await this.prisma.groupDiscussion.findMany({
      where: {
        type: 'general',
        status: 'active',
        ...(query.category && {
          metadata: {
            path: ['category'],
            equals: query.category,
          },
        }),
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return forums.map((forum) => this.mapToForumResponse(forum));
  }

  async getForum(id: string): Promise<ForumResponseDto> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id },
      include: {
        messages: {
          select: {
            id: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
    });

    if (!forum) {
      throw new NotFoundException(`Forum with ID ${id} not found`);
    }

    return this.mapToForumResponse(forum);
  }

  async updateForum(
    id: string,
    data: UpdateForumDto,
  ): Promise<ForumResponseDto> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id },
    });
    if (!forum) {
      throw new NotFoundException(`Forum with ID ${id} not found`);
    }

    const meta = (forum.metadata as GroupDiscussionMetadata) || {};

    const updatedForum = await this.prisma.groupDiscussion.update({
      where: { id },
      data: {
        title: data.name ?? forum.title,
        metadata: {
          ...meta,
          description: data.description ?? meta.description,
          category: data.category ?? meta.category,
          tags: data.tags ?? meta.tags,
          isPrivate: data.isPrivate ?? meta.isPrivate,
        } as any,
      },
    });
    return this.mapToForumResponse(updatedForum);
  }

  async deleteForum(id: string): Promise<void> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id },
    });

    if (!forum) {
      throw new NotFoundException(`Forum with ID ${id} not found`);
    }

    await this.prisma.groupDiscussion.update({
      where: { id },
      data: {
        status: 'closed',
      },
    });
  }

  async createTopic(
    forumId: string,
    data: CreateTopicDto,
    userId?: string,
  ): Promise<DiscussionMessage> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id: forumId },
    });

    if (!forum) {
      throw new NotFoundException(`Forum with ID ${forumId} not found`);
    }

    const metadata: DiscussionMessageMetadata = {
      title: data.title,
      tags: data.tags,
      isTopicStarter: true,
    };

    if (!userId) {
      throw new NotFoundException('User ID is required to create a topic');
    }

    const topic = await this.prisma.discussionMessage.create({
      data: {
        discussion: { connect: { id: forumId } },
        user: { connect: { id: userId } },
        content: data.content || data.title,
        type: 'text',
        metadata: metadata as any,
      },
    });
    return topic;
  }

  async getTopics(forumId: string, _query: any): Promise<DiscussionMessage[]> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id: forumId },
    });

    if (!forum) {
      throw new NotFoundException(`Forum with ID ${forumId} not found`);
    }

    return this.prisma.discussionMessage.findMany({
      where: {
        discussionId: forumId,
        metadata: {
          path: ['isTopicStarter'],
          equals: true,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createPost(
    forumId: string,
    data: CreatePostDto,
    userId?: string,
  ): Promise<DiscussionMessage> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id: forumId },
    });

    if (!forum) {
      throw new NotFoundException(`Forum with ID ${forumId} not found`);
    }

    const metadata: DiscussionMessageMetadata = {
      attachments: data.attachments,
    };

    if (!userId) {
      throw new NotFoundException('User ID is required to create a post');
    }

    return this.prisma.discussionMessage.create({
      data: {
        discussion: { connect: { id: forumId } },
        user: { connect: { id: userId } },
        content: data.content,
        type: 'text',
        ...(data.parentId
          ? { replyTo: { connect: { id: data.parentId } } }
          : {}),
        metadata: metadata as any,
      },
    });
  }

  async getPosts(forumId: string, _query: any): Promise<DiscussionMessage[]> {
    const forum = await this.prisma.groupDiscussion.findUnique({
      where: { id: forumId },
    });

    if (!forum) {
      throw new NotFoundException(`Forum with ID ${forumId} not found`);
    }

    return this.prisma.discussionMessage.findMany({
      where: {
        discussionId: forumId,
        metadata: {
          path: ['isTopicStarter'],
          not: true,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });
  }

  subscribeTopic(_forumId: string, _topicId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  private mapToForumResponse(
    forum: GroupDiscussion & { messages?: { metadata: Prisma.JsonValue }[] },
  ): ForumResponseDto {
    const metadata = (forum.metadata as GroupDiscussionMetadata) || {};
    return {
      id: forum.id,
      name: forum.title,
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags || [],
      isPrivate: metadata.isPrivate || false,
      topicCount:
        forum.messages?.filter(
          (m) => (m.metadata as DiscussionMessageMetadata)?.isTopicStarter,
        )?.length || 0,
      postCount: forum.messages?.length || 0,
      lastActivity: forum.updatedAt,
      createdAt: forum.createdAt,
      updatedAt: forum.updatedAt,
    };
  }
}
