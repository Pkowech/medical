import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '#common/decorators/roles.decorator';
import { RoleGuard } from '#common/guards/roles.guard';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { Role } from '#modules/auth/constants/role.constants';
import { QuestionFlagService } from '../services/question-flag.service';

@ApiTags('question-flags')
@ApiBearerAuth()
@Controller('question-flags')
@UseGuards(JwtAuthGuard, RoleGuard)
export class QuestionFlagsController {
  constructor(private readonly questionFlagService: QuestionFlagService) {}

  @Get('moderation-queue')
  @Roles(Role.moderator)
  @ApiOperation({ summary: 'List flagged assessment questions for moderation' })
  getModerationQueue() {
    return this.questionFlagService.getModerationQueue();
  }
}
