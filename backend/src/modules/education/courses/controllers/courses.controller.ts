// src/modules/education/courses/controllers/courses.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { CoursesService } from '../services/courses.service';
import {
  CourseSearchDto,
  CreateCourseDto,
  UpdateCourseDto,
  CourseResponseDto,
  ExtendedCourse,
} from '../../../../common/dto/course.dto';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import {
  CourseDifficulty,
  CourseStatus,
  EnrollmentStatus,
} from '@prisma/client';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RoleGuard } from '../../../../common/guards/roles.guard';
import { Role } from '#modules/auth/constants/role.constants';
import { BadRequestException } from '@nestjs/common';
import { Resource } from '../../../../common/decorators/resource.decorator';
import { Action } from '../../../../common/decorators/action.decorator';

interface UserRequest extends ExpressRequest {
  user: { id: string };
}

@ApiTags('courses')
@Controller('courses')
@Resource('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  private isUserRequest(req: ExpressRequest): req is UserRequest {
    return !!req.user && typeof (req.user as any).id === 'string';
  }

  private isValidStringParam(param: string): param is string {
    return typeof param === 'string' && param.trim().length > 0;
  }

  private isValidNumberQuery(value: any): value is number {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @Action('create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden resource' })
  async create(
    @Request() req: ExpressRequest,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    if (!createCourseDto || typeof createCourseDto !== 'object') {
      throw new BadRequestException('Invalid course data');
    }
    return await this.coursesService.create(createCourseDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses with filtering and pagination' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in name, title, description, and tags',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
  })
  @ApiQuery({ name: 'difficulty', required: false, enum: CourseDifficulty })
  @ApiQuery({ name: 'status', required: false, enum: CourseStatus })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiQuery({
    name: 'instructorId',
    required: false,
    description: 'Filter by instructor ID',
  })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field (default: createdAt)',
    enum: [
      'name',
      'title',
      'rating',
      'enrollmentCount',
      'createdAt',
      'updatedAt',
    ],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order: ASC or DESC (default: DESC)',
  })
  async findAll(@Request() req: ExpressRequest, @Query() filters: CourseSearchDto) {
    const pagination = new PaginationDto();
    pagination.page = this.isValidNumberQuery(filters.page)
      ? Number(filters.page)
      : 1;
    pagination.limit = this.isValidNumberQuery(filters.limit)
      ? Number(filters.limit)
      : 20;
    
    const userId = this.isUserRequest(req) ? req.user.id : undefined;
    return await (this.coursesService as any).findAll(filters, pagination, userId);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured courses' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of courses to return (default: 10)',
  })
  async getFeaturedCourses(
    @Request() req: ExpressRequest,
    @Query('limit') limit?: number,
  ) {
    const parsedLimit = this.isValidNumberQuery(limit) ? Number(limit) : 10;
    const userId = this.isUserRequest(req) ? req.user.id : undefined;
    return await (this.coursesService as any).getFeaturedCourses(parsedLimit, userId);
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommended courses for current user' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of courses to return (default: 10)',
  })
  async getRecommendedCourses(
    @Request() req: ExpressRequest,
    @Query('limit') limit?: number,
  ) {
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    const parsedLimit = this.isValidNumberQuery(limit) ? Number(limit) : 10;
    return await this.coursesService.getRecommendedCourses(
      req.user.id,
      parsedLimit,
    );
  }

  @Get('my-courses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user enrolled courses' })
  @ApiQuery({ name: 'status', required: false, enum: EnrollmentStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyCourses(
    @Request() req: ExpressRequest,
    @Query('status') status?: EnrollmentStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    if (status && !Object.values(EnrollmentStatus).includes(status)) {
      throw new BadRequestException('Invalid enrollment status');
    }
    const pageNum = this.isValidNumberQuery(page) ? Number(page) : 1;
    const limitNum = this.isValidNumberQuery(limit) ? Number(limit) : 20;
    
    return await (this.coursesService as any).getEnrollments(req.user.id, status, pageNum, limitNum);
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user course statistics' })
  @ApiResponse({
    status: 200,
    description: 'Course statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCourseStats(@Request() req: ExpressRequest) {
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    return await this.coursesService.getUserCourseStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by ID' })
  @ApiResponse({
    status: 200,
    description: 'Course found',
    type: () => CourseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
  ): Promise<ExtendedCourse> {
    if (!this.isValidStringParam(id)) {
      throw new BadRequestException('Invalid course ID');
    }
    const userId = this.isUserRequest(req) ? req.user.id : undefined;
    return await this.coursesService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @Action('update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update course' })
  @ApiResponse({ status: 200, description: 'Course updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Only instructor can update course',
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Request() req: ExpressRequest,
  ) {
    if (!this.isValidStringParam(id)) {
      throw new BadRequestException('Invalid course ID');
    }
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    if (!updateCourseDto || typeof updateCourseDto !== 'object') {
      throw new BadRequestException('Invalid update data');
    }
    return await this.coursesService.update(id, updateCourseDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  @Action('delete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete course' })
  @ApiResponse({ status: 204, description: 'Course deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Only instructor can delete course',
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async remove(@Param('id') id: string, @Request() req: ExpressRequest) {
    if (!this.isValidStringParam(id)) {
      throw new BadRequestException('Invalid course ID');
    }
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    await this.coursesService.remove(id, req.user.id);
  }

  @Get(':id/prerequisites')
  @ApiOperation({ summary: 'Get course prerequisites' })
  @ApiResponse({ status: 200, description: 'Prerequisites retrieved' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async getPrerequisites(@Param('id') courseId: string) {
    if (!this.isValidStringParam(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }
    return await this.coursesService.getPrerequisites(courseId);
  }

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enroll in a course' })
  @ApiResponse({ status: 201, description: 'Successfully enrolled in course' })
  @ApiResponse({
    status: 400,
    description: 'Already enrolled or course not available',
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async enroll(@Param('id') courseId: string, @Request() req: ExpressRequest) {
    if (!this.isValidStringParam(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    return await this.coursesService.enrollUser(courseId, req.user.id);
  }

  @Delete(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unenroll from a course' })
  @ApiResponse({
    status: 204,
    description: 'Successfully unenrolled from course',
  })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async unenroll(
    @Param('id') courseId: string,
    @Request() req: ExpressRequest,
  ) {
    if (!this.isValidStringParam(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }
    if (!this.isUserRequest(req)) {
      throw new BadRequestException('Invalid user in request');
    }
    await this.coursesService.unenroll(courseId, req.user.id);
  }

  @Post(':id/assign-instructor')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.instructor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign an instructor to a course' })
  @ApiResponse({ status: 201, description: 'Instructor assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden resource' })
  @ApiResponse({ status: 404, description: 'Course or user not found' })
  @HttpCode(HttpStatus.CREATED)
  async assignInstructor(
    @Param('id') courseId: string,
    @Body('instructorId') instructorId: string,
  ) {
    if (!this.isValidStringParam(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }
    if (!this.isValidStringParam(instructorId)) {
      throw new BadRequestException('Invalid instructor ID');
    }
    return await this.coursesService.assignInstructor(courseId, instructorId);
  }

  @Get(':id/units/:unitId/topics/:topicId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific topic within a unit' })
  @ApiResponse({ status: 200, description: 'Topic found' })
  @ApiResponse({ status: 404, description: 'Course, unit, or topic not found' })
  async getTopic(
    @Param('id') courseId: string,
    @Param('unitId') unitId: string,
    @Param('topicId') topicId: string,
    @Request() req: ExpressRequest,
  ) {
    if (!this.isValidStringParam(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }
    if (!this.isValidStringParam(unitId)) {
      throw new BadRequestException('Invalid unit ID');
    }
    if (!this.isValidStringParam(topicId)) {
      throw new BadRequestException('Invalid topic ID');
    }
    const userId = this.isUserRequest(req) ? req.user.id : undefined;
    return await this.coursesService.getTopic(courseId, unitId, topicId, userId);
  }


}
