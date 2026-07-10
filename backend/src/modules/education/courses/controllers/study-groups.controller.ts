import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { StudyGroupsService } from '../services/study-groups.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import {
  CreateStudyGroupDto,
  JoinGroupDto,
  CreateDiscussionDto,
  CreateMessageDto,
} from '../../../../common/dto';
import { StudyGroupType, StudyGroupPrivacy } from '@prisma/client';

@ApiTags('study-groups')
@Controller('study-groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudyGroupsController {
  constructor(private readonly studyGroupsService: StudyGroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new study group' })
  @ApiResponse({ status: 201, description: 'Study group created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createStudyGroupDto: CreateStudyGroupDto,
    @Request() req: any,
  ) {
    return this.studyGroupsService.create(createStudyGroupDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all study groups with optional filters' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: StudyGroupType,
    description: 'Filter by group type',
  })
  @ApiQuery({
    name: 'privacy',
    required: false,
    enum: StudyGroupPrivacy,
    description: 'Filter by privacy setting',
  })
  @ApiQuery({
    name: 'courseId',
    required: false,
    description: 'Filter by course ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Study groups retrieved successfully',
  })
  async findAll(
    @Query('type') type?: StudyGroupType,
    @Query('privacy') privacy?: StudyGroupPrivacy,
    @Query('courseId') courseId?: string,
  ) {
    return this.studyGroupsService.findAll({ type, privacy, courseId });
  }

  @Get('my-groups')
  @ApiOperation({ summary: 'Get current user study groups' })
  @ApiResponse({
    status: 200,
    description: 'User study groups retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyGroups(@Request() req: any) {
    return this.studyGroupsService.findAll({ userId: req.user.id });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get study group by ID' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({ status: 200, description: 'Study group found' })
  @ApiResponse({ status: 404, description: 'Study group not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studyGroupsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update study group' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({
    status: 200,
    description: 'Study group updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Study group not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateStudyGroupDto>,
    @Request() req: any,
  ) {
    return this.studyGroupsService.update(id, updateData, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete study group' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({
    status: 204,
    description: 'Study group deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Study group not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.studyGroupsService.delete(id, req.user.id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a study group' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({ status: 201, description: 'Successfully joined study group' })
  @ApiResponse({ status: 400, description: 'Already a member' })
  @ApiResponse({ status: 404, description: 'Study group not found' })
  async join(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() joinDto: JoinGroupDto,
    @Request() req: any,
  ) {
    return this.studyGroupsService.join(id, req.user.id, joinDto);
  }

  @Delete(':id/leave')
  @ApiOperation({ summary: 'Leave a study group' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({
    status: 204,
    description: 'Successfully left study group',
  })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.studyGroupsService.leave(id, req.user.id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get study group members' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({
    status: 200,
    description: 'Members retrieved successfully',
  })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.studyGroupsService.getMembers(id);
  }

  @Post(':id/discussions')
  @ApiOperation({ summary: 'Create a discussion in study group' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({
    status: 201,
    description: 'Discussion created successfully',
  })
  async createDiscussion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createDiscussionDto: CreateDiscussionDto,
    @Request() req: any,
  ) {
    return this.studyGroupsService.createDiscussion(
      id,
      createDiscussionDto,
      req.user.id,
    );
  }

  @Get(':id/discussions')
  @ApiOperation({ summary: 'Get study group discussions' })
  @ApiParam({ name: 'id', description: 'Study group ID' })
  @ApiResponse({
    status: 200,
    description: 'Discussions retrieved successfully',
  })
  async getDiscussions(@Param('id', ParseUUIDPipe) id: string) {
    return this.studyGroupsService.getDiscussions(id);
  }

  @Post('discussions/:discussionId/messages')
  @ApiOperation({ summary: 'Add message to discussion' })
  @ApiParam({ name: 'discussionId', description: 'Discussion ID' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  async addMessage(
    @Param('discussionId', ParseUUIDPipe) discussionId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: any,
  ) {
    return this.studyGroupsService.createMessage(
      discussionId,
      createMessageDto,
      req.user.id,
    );
  }

  @Get('discussions/:discussionId/messages')
  @ApiOperation({ summary: 'Get discussion messages' })
  @ApiParam({ name: 'discussionId', description: 'Discussion ID' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
  })
  async getMessages(
    @Param('discussionId', ParseUUIDPipe) discussionId: string,
  ) {
    return this.studyGroupsService.getMessages(discussionId);
  }
}
