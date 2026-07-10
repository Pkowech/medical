// backend/src/modules/education/events/controllers/deadlines.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeadlinesService } from '../services/deadlines.service';
import { CreateDeadlineDto, UpdateDeadlineDto } from '../dto/create-deadline.dto';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '#common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('Deadlines')
@Controller('deadlines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new system deadline' })
  create(@CurrentUser() user: User, @Body() createDeadlineDto: CreateDeadlineDto) {
    return this.deadlinesService.create(user.id, createDeadlineDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all deadlines for the current user' })
  findAll(@CurrentUser() user: User) {
    return this.deadlinesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific deadline' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.deadlinesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a deadline' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateDeadlineDto: UpdateDeadlineDto,
  ) {
    return this.deadlinesService.update(id, user.id, updateDeadlineDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a deadline' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.deadlinesService.remove(id, user.id);
  }

  @Post('auto-generate')
  @ApiOperation({ summary: 'Auto-generate deadlines for a course' })
  async autoGenerate(
    @Body('courseId') courseId: string,
    @CurrentUser() user: User,
  ) {
    return this.deadlinesService.autoGenerateCourseDeadlines(user.id, courseId);
  }
}
