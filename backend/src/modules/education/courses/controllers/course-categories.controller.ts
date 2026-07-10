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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { CourseCategoriesService } from '../../courses/services/course-categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../../../common/dto/course.dto';

@ApiTags('course-categories')
@Controller('course-categories')
export class CourseCategoriesController {
  constructor(private readonly categoriesService: CourseCategoriesService) {}

  @Post()
  @Roles(Role.admin, Role.instructor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Category slug already exists' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return await this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all course categories' })
  @ApiQuery({
    name: 'include_inactive',
    required: false,
    type: Boolean,
    description: 'Include inactive categories',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async findAll(@Query('include_inactive') includeInactive?: boolean) {
    return await this.categoriesService.findAll(includeInactive);
  }

  @Get('hierarchy')
  @ApiOperation({ summary: 'Get category hierarchy tree' })
  @ApiResponse({
    status: 200,
    description: 'Category hierarchy retrieved successfully',
  })
  async getHierarchy() {
    return await this.categoriesService.getHierarchy();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findBySlug(@Param('slug') slug: string) {
    return await this.categoriesService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string) {
    return await this.categoriesService.findOne(id);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get category statistics' })
  @ApiResponse({ status: 200, description: 'Category statistics retrieved' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getStats(@Param('id') id: string) {
    return await this.categoriesService.getCategoryStats(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.instructor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Category slug already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return await this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 204, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete category with courses or subcategories',
  })
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
  }
}
