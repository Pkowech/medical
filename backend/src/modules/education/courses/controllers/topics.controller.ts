import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from '#common/decorators/get-user.decorator';
import { Roles } from '#common/decorators/roles.decorator';
import { RoleGuard } from '#common/guards/roles.guard';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { Role } from '#modules/auth/constants/role.constants';
import { User } from '@prisma/client';
import { TopicsService, TopicMutationInput } from '../services/topics.service';

@ApiTags('topics')
@ApiBearerAuth()
@Controller('topics')
@UseGuards(JwtAuthGuard)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  @ApiOperation({ summary: 'List topics, optionally filtered by unit' })
  findAll(@Query('unitId') unitId?: string) {
    return this.topicsService.findAll(unitId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a topic by ID' })
  findOne(@Param('id') id: string) {
    return this.topicsService.findOne(id);
  }

  @Post()
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiOperation({ summary: 'Create a topic in an instructor-owned unit' })
  create(@Body() input: TopicMutationInput, @GetUser() user: User) {
    return this.topicsService.create(input, user.id);
  }

  @Patch(':id')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiOperation({ summary: 'Update a topic in an instructor-owned course' })
  update(
    @Param('id') id: string,
    @Body() input: TopicMutationInput,
    @GetUser() user: User,
  ) {
    return this.topicsService.update(id, input, user.id);
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiOperation({ summary: 'Delete a topic in an instructor-owned course' })
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.topicsService.remove(id, user.id);
  }
}