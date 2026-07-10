import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { ForumService } from '../services/forum.service';
import {
  ForumResponseDto,
  TopicResponseDto,
  MessageResponseDto,
  CreateForumDto,
  UpdateForumDto,
  CreateTopicDto,
  CreatePostDto,
} from '../../../common/dto/forum.dto';
import type { AuthenticatedUser } from '../../../common/dto/user.dto';

@ApiTags('Forums')
@Controller('forums')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post()
  async createForum(
    @Body() forumData: CreateForumDto,
  ): Promise<ForumResponseDto> {
    const forum = await this.forumService.createForum(forumData);
    return new ForumResponseDto(forum);
  }

  @Get()
  async getForums(
    @Query() query: Record<string, any>,
  ): Promise<ForumResponseDto[]> {
    const forums = await this.forumService.getForums(query);
    return forums.map((forum) => new ForumResponseDto(forum));
  }

  @Get(':id')
  async getForum(@Param('id') id: string): Promise<ForumResponseDto> {
    const forum = await this.forumService.getForum(id);
    return new ForumResponseDto(forum);
  }

  @Put(':id')
  async updateForum(
    @Param('id') id: string,
    @Body() forumData: UpdateForumDto,
  ): Promise<ForumResponseDto> {
    const forum = await this.forumService.updateForum(id, forumData);
    return new ForumResponseDto(forum);
  }

  @Delete(':id')
  async deleteForum(@Param('id') id: string): Promise<void> {
    return await this.forumService.deleteForum(id);
  }

  @Post(':id/topics')
  async createTopic(
    @Param('id') forumId: string,
    @Body() topicData: CreateTopicDto,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<TopicResponseDto> {
    const userId = req.user.id;
    const topic = await this.forumService.createTopic(
      forumId,
      topicData,
      userId,
    );
    return new TopicResponseDto(topic);
  }

  @Get(':id/topics')
  async getTopics(
    @Param('id') forumId: string,
    @Query() query: Record<string, any>,
  ): Promise<TopicResponseDto[]> {
    const topics = await this.forumService.getTopics(forumId, query);
    return topics.map((topic) => new TopicResponseDto(topic));
  }

  @Post(':forumId/topics/:topicId/subscribe')
  async subscribeTopic(
    @Param('forumId') forumId: string,
    @Param('topicId') topicId: string,
  ): Promise<void> {
    return await this.forumService.subscribeTopic(forumId, topicId);
  }

  @Post(':id/posts')
  async createPost(
    @Param('id') forumId: string,
    @Body() postData: CreatePostDto,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<MessageResponseDto> {
    const userId = req.user.id;
    const message = await this.forumService.createPost(
      forumId,
      postData,
      userId,
    );
    return new MessageResponseDto(message);
  }

  @Get(':id/posts')
  async getPosts(
    @Param('id') forumId: string,
    @Query() query: Record<string, any>,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.forumService.getPosts(forumId, query);
    return messages.map((message) => new MessageResponseDto(message));
  }
}
