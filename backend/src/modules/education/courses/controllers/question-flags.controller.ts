import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { QuestionModerationStatus } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '#common/decorators/get-user.decorator';
import { Roles } from '#common/decorators/roles.decorator';
import { RoleGuard } from '#common/guards/roles.guard';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { Role } from '#modules/auth/constants/role.constants';
import { getUserPrimaryRole } from '#common/utils/role.util';
import type { User } from '@prisma/client';
import {
  CreateQuestionFlagDto,
  DecideQuestionModerationDto,
} from '../dto/question-flag.dto';
import { QuestionFlagService } from '../services/question-flag.service';

const MODERATION_STATUSES = Object.values(QuestionModerationStatus);

@ApiTags('question-flags')
@ApiBearerAuth()
@Controller('question-flags')
@UseGuards(JwtAuthGuard, RoleGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class QuestionFlagsController {
  constructor(private readonly questionFlagService: QuestionFlagService) {}

  @Post()
  @Roles(Role.student)
  @ApiOperation({ summary: 'Report a problematic assessment question' })
  createFlag(@Body() dto: CreateQuestionFlagDto, @GetUser() user: User) {
    return this.questionFlagService.createFlag({
      ...dto,
      userId: user.id,
    });
  }

  @Get('moderation-queue')
  @Roles(Role.moderator)
  @ApiOperation({ summary: 'List assessment-question cases for moderation' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [...MODERATION_STATUSES, 'all'],
  })
  getModerationQueue(
    @Query('status') status: string | undefined,
    @GetUser() user: User,
  ) {
    this.assertModeratorRole(user);

    if (!status || status === 'all') {
      return this.questionFlagService.getModerationQueue(undefined, status === 'all');
    }

    if (!MODERATION_STATUSES.includes(status as QuestionModerationStatus)) {
      throw new BadRequestException('Invalid moderation status.');
    }

    return this.questionFlagService.getModerationQueue(
      status as QuestionModerationStatus,
    );
  }

  @Patch(':questionId/claim')
  @Roles(Role.moderator)
  @ApiOperation({ summary: 'Claim an open question-moderation case' })
  claimCase(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @GetUser() user: User,
  ) {
    this.assertModeratorRole(user);
    return this.questionFlagService.claimCase(questionId, user.id);
  }

  @Patch(':questionId/decision')
  @Roles(Role.moderator)
  @ApiOperation({ summary: 'Resolve or dismiss a claimed moderation case' })
  decideCase(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: DecideQuestionModerationDto,
    @GetUser() user: User,
  ) {
    this.assertModeratorRole(user);
    return this.questionFlagService.decideCase(questionId, user.id, dto);
  }

  private assertModeratorRole(user: User): void {
    const role = getUserPrimaryRole(user);
    if (role !== Role.moderator && role !== Role.admin) {
      throw new ForbiddenException('Moderator or admin access is required.');
    }
  }
}
