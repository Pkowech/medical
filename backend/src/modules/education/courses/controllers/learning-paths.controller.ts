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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { LearningPathsService } from '../services/learning-paths.service';
import { LearningPathProgressService } from '../services/learning-path-progress.service';
import { LearningPathRecommendationsService } from '#modules/ai-analytics/services/learning-path-recommendations.service';
import {
  CreateLearningPathDto,
  UpdateLearningPathDto,
  LearningPathFiltersDto,
} from '../../../../common/dto/learning-paths.dto';
import { ProgressUpdateDto } from '../../../../common/dto/progress.dto';
import { LearningPathCategory } from '@prisma/client';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@ApiTags('Learning Paths')
@Controller('learning-paths')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LearningPathsController {
  constructor(
    private readonly learningPathsService: LearningPathsService,
    private readonly progressService: LearningPathProgressService,
    private readonly recommendationsService: LearningPathRecommendationsService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
  ) {}

  // ==================== CRUD Operations ====================
  @Post()
  @ApiOperation({ summary: 'Create a new learning path' })
  @ApiResponse({
    status: 201,
    description: 'Learning path created successfully',
  })
  async create(
    @Body() createDto: CreateLearningPathDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningPathsService.create(createDto, req.user.id);
  }

  // ==================== FILTERING & DISCOVERY ====================
  @Get('categories/:category')
  @ApiOperation({ summary: 'Get learning paths by category' })
  @ApiResponse({
    status: 200,
    description: 'Category paths retrieved successfully',
  })
  async getByCategory(@Param('category') category: LearningPathCategory) {
    return await this.learningPathsService.getByCategory(category);
  }

  // ==================== ANALYTICS - gRPC-based Recommendations ====================
  @Get('discovery/trending')
  @ApiOperation({
    summary: 'Get trending learning paths across the system (gRPC-based)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trending paths with enrollment counts',
  })
  async getTrendingPaths(@Query('limit') limit: number = 5) {
    return await this.learningPathsService.getTrendingPaths(limit);
  }

  @Get('discovery/collaborative')
  @ApiOperation({
    summary:
      'Get collaborative learning path recommendations for user (gRPC-based)',
  })
  @ApiResponse({
    status: 200,
    description: 'Collaborative recommendations with similarity scores',
  })
  async getCollaborativePaths(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 5,
  ) {
    return await this.learningPathsService.getCollaborativePaths(
      req.user.id,
      limit,
    );
  }

  @Get('discovery/personalized')
  @ApiOperation({
    summary: 'Get personalized learning path recommendations (gRPC-based)',
  })
  @ApiResponse({
    status: 200,
    description: 'Personalized recommendations based on learning history',
  })
  async getRecommendedPaths(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 5,
  ) {
    return await this.learningPathsService.getRecommendedPaths(
      req.user.id,
      limit,
    );
  }

  @Get('discovery/user-insights')
  @ApiOperation({ summary: 'Get user learning insights for paths' })
  @ApiResponse({
    status: 200,
    description: 'User insights retrieved successfully',
  })
  async getUserInsights(@Request() req: AuthenticatedRequest) {
    return await this.learningAnalyticsService.getUserInsights(req.user.id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get analytics for a specific learning path' })
  @ApiResponse({
    status: 200,
    description: 'Path analytics retrieved successfully',
  })
  async getPathAnalytics(@Param('id') id: string) {
    return await this.learningAnalyticsService.getPathAnalytics(id);
  }

  // ==================== LEGACY Recommendations (fallback) ====================
  @Get('recommendations')
  @ApiOperation({
    summary: 'Get personalized learning path recommendations (fallback)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommendations retrieved successfully',
  })
  async getRecommendations(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
  ) {
    return await this.recommendationsService.getRecommendations(
      req.user.id,
      limit,
    );
  }

  @Get('recommendations/collaborative')
  @ApiOperation({
    summary: 'Get collaborative filtering recommendations (fallback)',
  })
  @ApiResponse({
    status: 200,
    description: 'Collaborative recommendations retrieved successfully',
  })
  async getLegacyCollaborativeRecommendations(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
  ) {
    return await this.recommendationsService.getCollaborativeRecommendations(
      req.user.id,
      limit,
    );
  }

  @Get('trending-legacy')
  @ApiOperation({ summary: 'Get trending learning paths (fallback)' })
  @ApiResponse({
    status: 200,
    description: 'Trending paths retrieved successfully',
  })
  async getTrendingLegacy(@Query('limit') limit?: number) {
    return await this.recommendationsService.getTrendingPaths(limit);
  }

  // ==================== PROGRESS TRACKING ====================
  @Get('my-progress')
  @ApiOperation({ summary: "Get user's learning path progress overview" })
  @ApiResponse({
    status: 200,
    description: 'User progress retrieved successfully',
  })
  async getMyProgress(@Request() req: AuthenticatedRequest) {
    return await this.progressService.getUserProgress(req.user.id);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: "Get user's progress on a specific learning path" })
  @ApiResponse({
    status: 200,
    description: 'Progress retrieved successfully',
  })
  async getProgress(
    @Param('id') pathId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.progressService.getProgress(req.user.id, pathId);
  }

  @Post(':id/progress')
  @ApiOperation({ summary: 'Update progress on a learning path' })
  @ApiResponse({
    status: 200,
    description: 'Progress updated successfully',
  })
  async updateProgress(
    @Param('id') pathId: string,
    @Body() progressUpdate: ProgressUpdateDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.progressService.updateProgress(
      req.user.id,
      pathId,
      progressUpdate,
    );
  }

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll in a learning path' })
  @ApiResponse({
    status: 201,
    description: 'Successfully enrolled in learning path',
  })
  async enroll(@Param('id') pathId: string, @Request() req: AuthenticatedRequest) {
    return await this.learningPathsService.enroll(req.user.id, pathId);
  }

  // ==================== PATH LIFECYCLE ====================
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a learning path' })
  @ApiResponse({
    status: 200,
    description: 'Learning path published successfully',
  })
  async publish(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.learningPathsService.publish(id, req.user.id);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a learning path' })
  @ApiResponse({
    status: 200,
    description: 'Learning path unpublished successfully',
  })
  async unpublish(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningPathsService.unpublish(id, req.user.id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a learning path' })
  @ApiResponse({
    status: 201,
    description: 'Learning path duplicated successfully',
  })
  async duplicate(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() customizations?: Partial<CreateLearningPathDto>,
  ) {
    return await this.learningPathsService.duplicate(
      id,
      req.user.id,
      customizations,
    );
  }
  // ==================== CRUD Operations (Generic Routes LAST) ====================
  @Get()
  @ApiOperation({ summary: 'Get all learning paths with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Learning paths retrieved successfully',
  })
  async findAll(@Query() filters: LearningPathFiltersDto) {
    return await this.learningPathsService.findAll(filters as any);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a learning path by ID' })
  @ApiResponse({
    status: 200,
    description: 'Learning path retrieved successfully',
  })
  async findOne(@Param('id') id: string) {
    return await this.learningPathsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a learning path' })
  @ApiResponse({
    status: 200,
    description: 'Learning path updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLearningPathDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningPathsService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a learning path' })
  @ApiResponse({
    status: 204,
    description: 'Learning path deleted successfully',
  })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.learningPathsService.remove(id, req.user.id);
  }
}
