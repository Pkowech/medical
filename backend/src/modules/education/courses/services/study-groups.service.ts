import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AiAnalyticsService } from '../../../ai-analytics/services/ai-analytics.service';
import {
  StudyGroupType,
  StudyGroupPrivacy,
  StudyGroupStatus,
  MemberRole,
  MemberStatus,
  DiscussionStatus,
  MessageType,
  StudyGroup,
  StudyGroupMember,
  GroupDiscussion,
  DiscussionMessage,
  Prisma,
} from '@prisma/client';
import {
  CreateStudyGroupDto,
  JoinGroupDto,
  CreateDiscussionDto,
  CreateMessageDto,
  StudyGroupDetails,
  StudyGroupMetadata,
  GroupDiscussionMetadata,
} from '#common/dto';

@Injectable()
export class StudyGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly aiAnalyticsService: AiAnalyticsService,
  ) {}

  private readonly CACHE_TTL = 3600;

  async create(
    createStudyGroupDto: CreateStudyGroupDto,
    creatorId: string,
  ): Promise<StudyGroup> {
    if (
      !createStudyGroupDto.name ||
      !createStudyGroupDto.type ||
      !createStudyGroupDto.privacy
    ) {
      throw new BadRequestException('Name, type, and privacy are required');
    }

    const metadata: StudyGroupMetadata = {
      tags: createStudyGroupDto.tags || [],
      studyTopics: createStudyGroupDto.studyTopics || [],
      goals: createStudyGroupDto.goals || {},
      schedule: createStudyGroupDto.schedule || {},
      rules: createStudyGroupDto.rules || {},
      memberCount: 1,
    };

    const studyGroup = await this.prisma.studyGroup.create({
      data: {
        name: createStudyGroupDto.name,
        description: createStudyGroupDto.description || '',
        type: createStudyGroupDto.type,
        privacy: createStudyGroupDto.privacy,
        inviteCode: uuidv4(),
        maxMembers: createStudyGroupDto.maxMembers || 50,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        status: StudyGroupStatus.active,
      },
    });

    await this.addMember(studyGroup.id, creatorId, MemberRole.admin);

    await this.invalidateCache('study_groups');

    // Track analytics event (fire and forget)
    this.aiAnalyticsService
      .trackEvent(
        creatorId,
        'study_group_created',
        {
          groupId: studyGroup.id,
          name: studyGroup.name,
          type: studyGroup.type,
          privacy: studyGroup.privacy,
        },
        new Date().toISOString(),
      )
      .catch(() => {
        // Silent fail - not critical
      });

    return studyGroup;
  }

  async findAll(
    filters: {
      type?: StudyGroupType;
      privacy?: StudyGroupPrivacy;
      courseId?: string;
      search?: string;
      userId?: string;
    } = {},
  ): Promise<StudyGroup[]> {
    const cacheKey = `study_groups:${JSON.stringify(filters)}`;
    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (
        cached &&
        typeof cached === 'string' &&
        cached !== 'undefined' &&
        cached !== 'null'
      ) {
        return JSON.parse(cached) as StudyGroup[];
      }
    } catch (error) {
      console.warn('Redis get failed:', error);
    }

    const where: Prisma.StudyGroupWhereInput = {
      status: StudyGroupStatus.active,
    };

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.privacy) {
      where.privacy = filters.privacy;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.userId) {
      where.members = {
        some: { userId: filters.userId, status: MemberStatus.active },
      };
    } else {
      where.privacy = { not: StudyGroupPrivacy.private };
    }

    const studyGroups = await this.prisma.studyGroup.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImage: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(studyGroups, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        this.CACHE_TTL,
      );
    } catch (error) {
      console.warn('Redis set failed:', error);
    }

    return studyGroups;
  }

  async findOne(id: string, userId?: string): Promise<StudyGroupDetails> {
    const cacheKey = `study_group:${id}:${userId || 'no-user'}`;
    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (
        cached &&
        typeof cached === 'string' &&
        cached !== 'undefined' &&
        cached !== 'null'
      ) {
        return JSON.parse(cached) as StudyGroupDetails;
      }
    } catch (error) {
      console.warn('Redis get failed:', error);
    }

    const studyGroup = await this.prisma.studyGroup.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        discussions: true,
      },
    });

    if (!studyGroup) {
      throw new NotFoundException('Study group not found');
    }

    if (studyGroup.privacy === StudyGroupPrivacy.private && userId) {
      const membership = await this.prisma.studyGroupMember.findFirst({
        where: { studyGroupId: id, userId, status: MemberStatus.active },
      });
      if (!membership) {
        throw new ForbiddenException('Access denied to private group');
      }
    }

    const result: StudyGroupDetails = {
      ...studyGroup,
      userMembership: null,
      isMember: false,
    };
    if (userId) {
      const membership = await this.prisma.studyGroupMember.findFirst({
        where: { studyGroupId: id, userId, status: MemberStatus.active },
      });
      result.userMembership = membership;
      result.isMember = !!membership;
    }

    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        this.CACHE_TTL,
      );
    } catch (error) {
      console.warn('Redis set failed:', error);
    }

    return result;
  }

  async join(
    groupId: string,
    userId: string,
    joinGroupDto: JoinGroupDto = {},
  ): Promise<StudyGroupMember> {
    const studyGroup = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
    });

    if (!studyGroup) {
      throw new NotFoundException('Study group not found');
    }

    if (studyGroup.status !== StudyGroupStatus.active) {
      throw new BadRequestException('Study group is not active');
    }

    const existingMember = await this.prisma.studyGroupMember.findFirst({
      where: { studyGroupId: groupId, userId, status: MemberStatus.active },
    });

    if (existingMember) {
      throw new BadRequestException('Already a member of this group');
    }

    const metadata =
      (studyGroup.metadata as unknown as StudyGroupMetadata) ||
      ({} as Partial<StudyGroupMetadata>);
    const currentMemberCount = metadata.memberCount || 0;

    if (currentMemberCount >= studyGroup.maxMembers) {
      throw new BadRequestException('Study group is full');
    }

    if (studyGroup.privacy === StudyGroupPrivacy.private) {
      throw new ForbiddenException(
        'Cannot join private group without invitation',
      );
    }

    if (studyGroup.privacy === StudyGroupPrivacy.invite_only) {
      if (
        !joinGroupDto.inviteCode ||
        joinGroupDto.inviteCode !== studyGroup.inviteCode
      ) {
        throw new BadRequestException('Invalid invite code');
      }
    }

    const member = await this.addMember(groupId, userId, MemberRole.member);

    await this.prisma.studyGroup.update({
      where: { id: groupId },
      data: {
        metadata: {
          ...metadata,
          memberCount: currentMemberCount + 1,
        },
        updatedAt: new Date(),
      },
    });

    await this.invalidateCache(`study_group_${groupId}`);
    await this.invalidateCache('study_groups');

    return member;
  }

  async leave(groupId: string, userId: string): Promise<void> {
    const member = await this.prisma.studyGroupMember.findFirst({
      where: { studyGroupId: groupId, userId, status: MemberStatus.active },
    });

    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    if (member.role === MemberRole.admin) {
      const otherMembers = await this.prisma.studyGroupMember.findMany({
        where: { studyGroupId: groupId, status: MemberStatus.active },
      });

      if (otherMembers.length > 1) {
        throw new BadRequestException(
          'Transfer ownership before leaving the group',
        );
      }
    }

    await this.prisma.studyGroupMember.delete({
      where: { id: member.id },
    });

    const studyGroup = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
    });
    if (studyGroup) {
      const metadata =
        (studyGroup.metadata as unknown as StudyGroupMetadata) ||
        ({} as Partial<StudyGroupMetadata>);
      const currentMemberCount = metadata.memberCount || 0;

      await this.prisma.studyGroup.update({
        where: { id: groupId },
        data: {
          metadata: {
            ...metadata,
            memberCount: Math.max(0, currentMemberCount - 1),
          },
        },
      });
    }

    await this.invalidateCache(`study_group_${groupId}`);
    await this.invalidateCache('study_groups');
  }

  async createDiscussion(
    groupId: string,
    createDiscussionDto: CreateDiscussionDto,
    userId: string,
  ): Promise<GroupDiscussion> {
    await this.verifyMembership(groupId, userId);

    const metadata: GroupDiscussionMetadata = {
      content: createDiscussionDto.content,
      tags: createDiscussionDto.tags,
      pollData: createDiscussionDto.pollData,
      attachments: createDiscussionDto.attachments,
      messageCount: 0,
    };

    const discussion = await this.prisma.groupDiscussion.create({
      data: {
        title: createDiscussionDto.title,
        type: createDiscussionDto.type,
        studyGroupId: groupId,
        status: DiscussionStatus.active,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.studyGroup.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    });

    await this.invalidateCache(`study_group_${groupId}`);
    await this.invalidateCache(`discussions_${groupId}`);

    return discussion;
  }

  async getDiscussions(
    groupId: string,
    userId?: string,
  ): Promise<GroupDiscussion[]> {
    if (userId) {
      await this.verifyMembership(groupId, userId);
    }

    const cacheKey = `discussions:${groupId}:${userId || 'no-user'}`;
    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (
        cached &&
        typeof cached === 'string' &&
        cached !== 'undefined' &&
        cached !== 'null'
      ) {
        return JSON.parse(cached) as GroupDiscussion[];
      }
    } catch (error) {
      console.warn('Redis get failed:', error);
    }

    const discussions = await this.prisma.groupDiscussion.findMany({
      where: { studyGroupId: groupId },
      include: {
        messages: { include: { user: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(discussions, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        this.CACHE_TTL,
      );
    } catch (error) {
      console.warn('Redis set failed:', error);
    }

    return discussions;
  }

  async createMessage(
    discussionId: string,
    createMessageDto: CreateMessageDto,
    userId: string,
  ): Promise<DiscussionMessage> {
    const discussion = await this.prisma.groupDiscussion.findUnique({
      where: { id: discussionId },
      include: { studyGroup: true },
    });

    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }

    await this.verifyMembership(discussion.studyGroupId, userId);

    const message = await this.prisma.discussionMessage.create({
      data: {
        content: createMessageDto.content,
        type: createMessageDto.type || MessageType.text,
        discussionId,
        userId,
        metadata: {
          attachments: createMessageDto.attachments,
          replyToId: createMessageDto.replyToId,
        },
      },
    });

    const discussionMetadata =
      (discussion.metadata as unknown as GroupDiscussionMetadata) ||
      ({} as Partial<GroupDiscussionMetadata>);
    await this.prisma.groupDiscussion.update({
      where: { id: discussionId },
      data: {
        metadata: {
          ...discussionMetadata,
          messageCount: (discussionMetadata.messageCount || 0) + 1,
          lastMessageBy: userId,
        },
        updatedAt: new Date(),
      },
    });

    await this.prisma.studyGroup.update({
      where: { id: discussion.studyGroupId },
      data: { updatedAt: new Date() },
    });

    await this.invalidateCache(`discussions_${discussion.studyGroupId}`);
    await this.invalidateCache(`messages_${discussionId}`);
    await this.invalidateCache(`study_group_${discussion.studyGroupId}`);

    return message;
  }

  async getMessages(
    discussionId: string,
    userId?: string,
  ): Promise<DiscussionMessage[]> {
    const discussion = await this.prisma.groupDiscussion.findUnique({
      where: { id: discussionId },
      include: { studyGroup: true },
    });

    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }

    if (userId) {
      await this.verifyMembership(discussion.studyGroupId, userId);
    }

    const cacheKey = `messages:${discussionId}:${userId || 'no-user'}`;
    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (
        cached &&
        typeof cached === 'string' &&
        cached !== 'undefined' &&
        cached !== 'null'
      ) {
        return JSON.parse(cached) as DiscussionMessage[];
      }
    } catch (error) {
      console.warn('Redis get failed:', error);
    }

    const messages = await this.prisma.discussionMessage.findMany({
      where: { discussionId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(messages, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        this.CACHE_TTL,
      );
    } catch (error) {
      console.warn('Redis set failed:', error);
    }

    return messages;
  }

  private async addMember(
    groupId: string,
    userId: string,
    role: MemberRole,
  ): Promise<StudyGroupMember> {
    const member = await this.prisma.studyGroupMember.create({
      data: {
        studyGroupId: groupId,
        userId,
        role,
        status: MemberStatus.active,
        joinedAt: new Date(),
        metadata: {
          statistics: {
            messagesSent: 0,
            resourcesShared: 0,
            questionsAsked: 0,
            questionsAnswered: 0,
            studyHoursLogged: 0,
            peerRatings: {
              helpfulness: 0,
              knowledge: 0,
              collaboration: 0,
              reliability: 0,
            },
          },
        },
      },
    });

    // Track analytics event (fire and forget)
    this.aiAnalyticsService
      .trackEvent(
        userId,
        'study_group_joined',
        {
          groupId,
          role,
        },
        new Date().toISOString(),
      )
      .catch(() => {
        // Silent fail - not critical
      });

    return member;
  }

  private async verifyMembership(
    groupId: string,
    userId: string,
  ): Promise<StudyGroupMember> {
    const member = await this.prisma.studyGroupMember.findFirst({
      where: {
        studyGroupId: groupId,
        userId,
        status: MemberStatus.active,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'You must be an active member to access this resource',
      );
    }

    return member;
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async updateMemberRole(
    groupId: string,
    memberId: string,
    newRole: MemberRole,
    requesterId: string,
  ): Promise<StudyGroupMember> {
    const requesterMember = await this.verifyMembership(groupId, requesterId);
    if (
      requesterMember.role !== MemberRole.admin &&
      requesterMember.role !== MemberRole.moderator
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const member = await this.prisma.studyGroupMember.findFirst({
      where: { id: memberId, studyGroupId: groupId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const updatedMember = await this.prisma.studyGroupMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    await this.invalidateCache(`study_group_${groupId}`);
    await this.invalidateCache('study_groups');

    return updatedMember;
  }

  async removeMember(
    groupId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    const requesterMember = await this.verifyMembership(groupId, requesterId);
    if (
      requesterMember.role !== MemberRole.admin &&
      requesterMember.role !== MemberRole.moderator
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const member = await this.prisma.studyGroupMember.findFirst({
      where: { id: memberId, studyGroupId: groupId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === MemberRole.admin) {
      throw new BadRequestException('Cannot remove group owner');
    }

    await this.prisma.studyGroupMember.delete({
      where: { id: memberId },
    });

    const studyGroup = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
    });
    if (studyGroup) {
      const metadata =
        (studyGroup.metadata as unknown as StudyGroupMetadata) ||
        ({} as Partial<StudyGroupMetadata>);
      const currentMemberCount = metadata.memberCount || 0;

      await this.prisma.studyGroup.update({
        where: { id: groupId },
        data: {
          metadata: {
            ...metadata,
            memberCount: Math.max(0, currentMemberCount - 1),
          },
        },
      });
    }

    await this.invalidateCache(`study_group_${groupId}`);
    await this.invalidateCache('study_groups');
  }

  async update(
    id: string,
    updateData: Partial<CreateStudyGroupDto>,
    requesterId: string,
  ): Promise<StudyGroup> {
    const requesterMember = await this.verifyMembership(id, requesterId);
    if (
      requesterMember.role !== MemberRole.admin &&
      requesterMember.role !== MemberRole.moderator
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const studyGroup = await this.prisma.studyGroup.findUnique({
      where: { id },
    });
    if (!studyGroup) {
      throw new NotFoundException('Study group not found');
    }

    const metadata =
      (studyGroup.metadata as unknown as StudyGroupMetadata) ||
      ({} as Partial<StudyGroupMetadata>);

    const newMetadata = {
      tags: updateData.tags ?? metadata.tags ?? [],
      studyTopics: updateData.studyTopics ?? metadata.studyTopics ?? [],
      goals: updateData.goals ?? metadata.goals ?? {},
      schedule: updateData.schedule ?? metadata.schedule ?? {},
      rules: updateData.rules ?? metadata.rules ?? {},
      memberCount: metadata.memberCount ?? 0,
    } as unknown as Prisma.InputJsonValue;

    const data = {
      name: updateData.name ?? studyGroup.name,
      description: updateData.description ?? studyGroup.description,
      type: updateData.type ?? studyGroup.type,
      privacy: updateData.privacy ?? studyGroup.privacy,
      maxMembers: updateData.maxMembers ?? studyGroup.maxMembers,
      metadata: newMetadata,
      updatedAt: new Date(),
    };

    const updated = await this.prisma.studyGroup.update({
      where: { id },
      data,
    });

    await this.invalidateCache(`study_group_${id}`);
    await this.invalidateCache('study_groups');

    return updated;
  }

  async delete(id: string, requesterId: string): Promise<void> {
    const requesterMember = await this.verifyMembership(id, requesterId);
    if (requesterMember.role !== MemberRole.admin) {
      throw new ForbiddenException('Only group owner can delete group');
    }

    await this.prisma.studyGroup.update({
      where: { id },
      data: { status: StudyGroupStatus.archived, updatedAt: new Date() },
    });

    await this.invalidateCache(`study_group_${id}`);
    await this.invalidateCache('study_groups');
  }

  async getMembers(groupId: string): Promise<StudyGroupMember[]> {
    return this.prisma.studyGroupMember.findMany({
      where: { studyGroupId: groupId },
      include: { user: true },
    });
  }

  private async invalidateCache(pattern: string): Promise<void> {
    try {
      if (
        'delPattern' in this.redisService &&
        typeof (this.redisService as any).delPattern === 'function'
      ) {
        await (this.redisService as any).delPattern(`*${pattern}*`);
      } else {
        await this.redisService.del(pattern);
      }
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }
}
