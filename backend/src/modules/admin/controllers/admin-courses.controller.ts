import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { CourseSearchDto } from '#common/dto/course.dto';
import { PaginationDto } from '#common/dto/pagination.dto';
import { CoursesService } from '#modules/education/courses/services/courses.service';

interface AdminRequest extends ExpressRequest {
  user: { id: string };
}

@ApiTags('Admin Courses')
@ApiBearerAuth()
@Controller('admin/courses')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.admin)
export class AdminCoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List all courses and statuses for admin review' })
  async findAll(
    @Request() req: ExpressRequest,
    @Query() filters: CourseSearchDto,
  ) {
    if (!req.user || typeof (req.user as AdminRequest['user']).id !== 'string') {
      throw new BadRequestException('Invalid user in request');
    }

    const pagination = new PaginationDto();
    pagination.page = this.toPositiveInteger(filters.page, 1);
    pagination.limit = Math.min(this.toPositiveInteger(filters.limit, 20), 100);
    return this.coursesService.findManageable(
      filters,
      pagination,
      (req.user as AdminRequest['user']).id,
    );
  }

  private toPositiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
