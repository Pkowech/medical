import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpCode,
  Query,
  BadRequestException,
  Res,
  StreamableFile,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from '../services/materials.service';
import { MaterialType, User as PrismaUser, File } from '@prisma/client';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { GetUser } from '#common/decorators/get-user.decorator';
import { Public } from '#common/decorators/public.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('Materials')
@Controller('materials')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaterialsController {
  private readonly logger = new Logger(MaterialsController.name);

  constructor(
    private readonly materialsService: MaterialsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('upload')
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  )
  @ApiOperation({ summary: 'Upload a course material' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        courseId: {
          type: 'string',
          description: 'Optional course placement. A course alone is appropriate for course-level resources such as textbooks.',
        },
        unitId: {
          type: 'string',
          description: 'Optional unit placement within the selected course.',
        },
        topicId: {
          type: 'string',
          description: 'Optional topic within the selected unit.',
        },
        title: {
          type: 'string',
          description: 'Title of the material',
        },
        description: {
          type: 'string',
          description: 'Optional description of the material',
        },
        type: {
          type: 'string',
          enum: Object.values(MaterialType),
          description: 'Type of material (PDF, WORD, etc)',
        },
        category: {
          type: 'string',
          description: 'Category or Intent (e.g., Lecture Notes, Clinical)',
        },
        difficulty: {
          type: 'number',
          description: 'Difficulty level (0-1)',
        },
        tags: {
          type: 'string',
          description: 'Comma separated tags',
        },
        shareWithCourse: {
          type: 'boolean',
          description: 'Share this material with enrolled students in its course. Defaults to false.',
        },
      },
      required: ['file', 'title'],
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('courseId') courseId?: string,
    @Body('unitId') unitId?: string,
    @Body('topicId') topicId?: string,
    @Body('title') title?: string,
    @GetUser() user?: PrismaUser,
    @Body('description') description?: string,
    @Body('type') type?: MaterialType,
    @Body('category') category?: string,
    @Body('difficulty') difficulty?: number,
    @Body('tags') tags?: string,
    @Body('shareWithCourse') shareWithCourse?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const tagsArray = tags ? tags.split(',').map((t) => t.trim()) : undefined;

    return this.materialsService.uploadFile(
      file,
      user?.id || '',
      courseId,
      unitId,
      topicId,
      title || file.originalname,
      description,
      type,
      category,
      difficulty ? Number(difficulty) : undefined,
      tagsArray,
      shareWithCourse === 'true',
    );
  }

  @Post('drive')
  @ApiOperation({ summary: 'Attach a material from the configured course Shared Drive' })
  async registerDriveMaterial(
    @Body() dto: {
      url: string;
      title: string;
      description?: string;
      courseId?: string;
      unitId?: string;
      topicId?: string;
      shareWithCourse?: boolean;
    },
    @GetUser() user: PrismaUser,
  ) {
    return this.materialsService.registerGoogleDriveMaterial({ ...dto, userId: user.id });
  }

  @Get('drive/connection')
  @ApiOperation({ summary: 'Check whether the signed-in user connected Google Drive' })
  async getDriveConnection(@GetUser() user: PrismaUser) {
    return this.materialsService.getGoogleDriveConnectionStatus(user.id);
  }

  @Get('drive/oauth-url')
  @ApiOperation({ summary: 'Start read-only Google Drive authorization' })
  getDriveAuthorizationUrl(@GetUser() user: PrismaUser) {
    return {
      authorizationUrl: this.materialsService.getGoogleDriveAuthorizationUrl(user.id),
    };
  }

  @Delete('drive/connection')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disconnect Google Drive from the signed-in account' })
  async disconnectDrive(@GetUser() user: PrismaUser): Promise<void> {
    await this.materialsService.disconnectGoogleDrive(user.id);
  }

  @Get('drive/oauth/callback')
  @Public()
  @ApiOperation({ summary: 'Complete Google Drive authorization' })
  async completeDriveAuthorization(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      if (oauthError || !code || !state) {
        throw new BadRequestException('Google Drive authorization was not completed.');
      }
      await this.materialsService.completeGoogleDriveAuthorization(code, state);
      this.redirectAfterDriveAuthorization(response, true);
    } catch {
      this.logger.warn('Google Drive authorization failed.');
      this.redirectAfterDriveAuthorization(response, false);
    }
  }

  @Post('drive/folder-preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Preview supported files in a folder the signed-in Google account can access' })
  async previewDriveFolder(
    @Body('folderUrl') folderUrl: string,
    @GetUser() user: PrismaUser,
  ) {
    if (!folderUrl?.trim()) {
      throw new BadRequestException('Enter a Google Drive folder URL.');
    }
    return this.materialsService.previewGoogleDriveFolder(folderUrl, user.id);
  }

  @Post('drive/folder-link')
  @ApiOperation({ summary: 'Link selected Drive folder files to course units and topics' })
  async importDriveFolder(
    @Body('items')
    items: Array<{
      fileId: string;
      title: string;
      description?: string;
      courseId?: string;
      unitId?: string;
      topicId?: string;
      shareWithCourse?: boolean;
    }>,
    @GetUser() user: PrismaUser,
  ) {
    return this.materialsService.linkGoogleDriveFolderFiles(items, user.id);
  }

  private redirectAfterDriveAuthorization(response: Response, connected: boolean): void {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      response.status(500).send('Google Drive authorization completed, but FRONTEND_URL is not configured.');
      return;
    }
    const redirectUrl = new URL('/study-planner/materials/upload', frontendUrl);
    redirectUrl.searchParams.set(
      connected ? 'driveConnected' : 'driveError',
      connected ? '1' : 'authorization_failed',
    );
    response.redirect(redirectUrl.toString());
  }

  @Post('attach')
  @ApiOperation({ summary: 'Attach an existing R2 library material to a new topic/unit/course (zero re-upload)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sourceMaterialId', 'title'],
      properties: {
        sourceMaterialId: { type: 'string', description: 'ID of the existing material whose file to reuse' },
        title:           { type: 'string' },
        description:     { type: 'string' },
        topicId:         { type: 'string', description: 'Optional topic within the selected unit.' },
        unitId:          { type: 'string', description: 'Optional unit placement within the course.' },
        courseId:        { type: 'string', description: 'Optional course placement.' },
        type:            { type: 'string' },
      },
    },
  })
  async attachExisting(
    @Body('sourceMaterialId') sourceMaterialId: string,
    @Body('title') title: string,
    @Body('topicId') topicId?: string,
    @Body('unitId') unitId?: string,
    @Body('courseId') courseId?: string,
    @Body('description') description?: string,
    @Body('type') type?: MaterialType,
    @GetUser() user?: PrismaUser,
  ) {
    if (!sourceMaterialId) {
      throw new BadRequestException('sourceMaterialId is required');
    }
    return this.materialsService.attachExistingMaterial({
      sourceMaterialId,
      title: title || '',
      topicId,
      unitId,
      courseId,
      description,
      type,
      userId: user?.id || '',
    });
  }

  @Post('external')
  @ApiOperation({ summary: 'Register an external resource (link, video, etc)' })
  async registerExternalResource(
    @Body() dto: {
      title: string;
      url: string;
      type: MaterialType;
      unitId?: string;
      topicId?: string;
      description?: string;
    },
    @GetUser() user: PrismaUser,
  ) {
    return this.materialsService.createExternalResource({
      ...dto,
      userId: user.id,
    });
  }

  @Get('recommended')
  @ApiOperation({
    summary: 'Get material recommendations based on the authenticated user’s quiz performance',
  })
  async getRecommendedMaterials(@GetUser() user: PrismaUser) {
    return this.materialsService.getRecommendedMaterialsForUser(user.id);
  }

  @Get('paginated')
  @ApiOperation({ summary: 'Get paginated materials with scoping' })
  async getPaginated(
    @GetUser() user: PrismaUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('scope') scope?: 'all' | 'enrolled' | 'recommended' | 'owned' | 'shared',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('unitId') unitId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.materialsService.findAllPaginated({
      page: Number(page),
      limit: Number(limit),
      search,
      type,
      scope,
      userId: user.id,
      sortBy,
      sortOrder,
      unitId,
      courseId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all materials with optional filters' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'unitId', required: false })
  @ApiQuery({ name: 'topicId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async findAll(
    @Query('courseId') courseId?: string,
    @Query('unitId') unitId?: string,
    @Query('topicId') topicId?: string,
    @Query('type') type?: MaterialType,
    @Query('userId') userId?: string,
  ) {
    return this.materialsService.findAll({ courseId, unitId, topicId, type, userId });
  }

  // Moving static and prefixed routes before parameterized routes to avoid conflicts
  @Get('shared/:userId')
  @ApiOperation({ summary: 'Get materials shared with user' })
  async findSharedMaterials(@Param('userId') userId: string) {
    return this.materialsService.findSharedMaterials(userId);
  }

  @Get('unit/:unitId')
  @ApiOperation({ summary: 'Get all materials for a unit' })
  async findMaterialsByUnitId(@Param('unitId') unitId: string, @GetUser() user: PrismaUser) {
    return this.materialsService.findMaterialsByUnitId(unitId, user.id);
  }

  @Get('files/:fileId/metadata')
  @ApiOperation({ summary: 'Get file metadata' })
  async getFileMetadata(@Param('fileId') fileId: string) {
    return this.materialsService.getFileMetadata(fileId);
  }

  @Get('local/search')
  @Public()
  @ApiOperation({
    summary: 'Search files in local PHARMACY directory (dev mode only)',
  })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  async searchLocalFiles(@Query('query') query: string) {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }
    return this.materialsService.searchLocalFiles(query);
  }

  @Get('local/browse')
  @Public()
  @ApiOperation({ summary: 'Browse local directory (dev mode only)' })
  @ApiQuery({
    name: 'path',
    required: false,
    description: 'Relative path to browse',
  })
  async listLocalDirectory(@Query('path') relativePath?: string) {
    return this.materialsService.listLocalDirectory(relativePath || '');
  }

  @Get('local/file')
  @Public()
  @ApiOperation({ summary: 'Get file from local storage (dev mode only)' })
  @ApiQuery({ name: 'path', required: true, description: 'File path' })
  async getLocalFile(
    @Query('path') filePath: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!filePath) {
      throw new BadRequestException('File path is required');
    }

    const { content, mimeType, fileName } =
      await this.materialsService.getLocalFile(filePath);

    response.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': content.length,
    });

    return new StreamableFile(content);
  }

  @Get('local/download')
  @Public()
  @ApiOperation({ summary: 'Download file from local storage (dev mode only)' })
  @ApiQuery({ name: 'path', required: true, description: 'File path' })
  async downloadLocalFile(
    @Query('path') filePath: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!filePath) {
      throw new BadRequestException('File path is required');
    }

    const { content, mimeType, fileName } =
      await this.materialsService.getLocalFile(filePath);

    response.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': content.length,
    });

    return new StreamableFile(content);
  }

  @Get('local/serve/:fileHash')
  @ApiOperation({ summary: 'Serve a local PDF file by hash' })
  async serveLocalPdf(
    @Param('fileHash') fileHash: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!fileHash) {
      throw new BadRequestException('File hash is required');
    }

    const { content, mimeType, fileName } =
      await this.materialsService.serveLocalPdfByHash(fileHash);

    response.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': content.length,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    });

    return new StreamableFile(content);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get material by ID' })
  async findOne(@Param('id') id: string, @GetUser() user: PrismaUser) {
    return this.materialsService.findOne(id, user.id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get material download URL' })
  async getDownloadUrl(@Param('id') id: string, @GetUser() user: PrismaUser) {
    return this.materialsService.getDownloadUrl(id, user.id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Get material preview content' })
  async getPreviewContent(
    @Param('id') id: string,
    @GetUser() user: PrismaUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { content, mimeType, fileName } =
      await this.materialsService.getMaterialPreviewContent(id, user.id);
    const safeFileName = fileName.replace(/["\r\n]/g, '_');

    response.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${safeFileName}"`,
      'Content-Length': content.length,
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(content);
  }

  @Post(':id/track/view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Track material view with optional page number' })
  async trackView(
    @Param('id') id: string,
    @GetUser() user: PrismaUser,
    @Body('page') page?: number,
  ) {
    await this.materialsService.trackView(id, user.id, page);
    return { success: true };
  }

  @Get(':id/with-url')
  @ApiOperation({ summary: 'Get material with file URL for frontend' })
  async getMaterialWithFileUrl(@Param('id') id: string, @GetUser() user: PrismaUser) {
    return this.materialsService.getMaterialWithFileUrl(id, user.id);
  }


  @Get(':id/overview')
  @ApiOperation({ summary: 'Get material statistics' })
  async getMaterialStats(@Param('id') id: string) {
    return this.materialsService.getMaterialStats(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete material' })
  async remove(@Param('id') id: string, @GetUser() user: PrismaUser) {
    await this.materialsService.remove(id, user.id);
    return { success: true };
  }

  @Patch(':id/share-with-course')
  @ApiOperation({ summary: 'Share or unshare a material with enrolled course students' })
  async setCourseSharing(
    @Param('id') materialId: string,
    @Body('shared') shared: boolean,
    @GetUser() user: PrismaUser,
  ) {
    return this.materialsService.setCourseSharing(materialId, user.id, shared);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Share material with another user' })
  async shareMaterial(
    @Param('id') materialId: string,
    @Body('userId') sharedWithUserId: string,
    @GetUser() user: PrismaUser,
  ) {
    return this.materialsService.shareMaterial(materialId, user.id, sharedWithUserId);
  }



  @Delete('files/:fileId')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(@Param('fileId') fileId: string) {
    await this.materialsService.deleteFile(fileId);
    return { success: true };
  }

  @Post('convert')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Convert a PPTX/slide file to PDF (async or sync)' })
  @ApiConsumes('multipart/form-data')
  async convertToPdf(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: PrismaUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.materialsService.convertToPdf(file, user.id);
  }

  @Post('local/register')
  @ApiOperation({
    summary: 'Register a local file material (for mapping and tracking)',
  })
  async registerLocalMaterial(
    @Body('hash') hash: string,
    @Body('filename') filename: string,
    @Body('mimetype') mimetype: string,
    @Body('size') size: number,
    @Body('unitId') unitId?: string,
    @GetUser() user?: PrismaUser,
  ) {
    if (!hash || !filename || !mimetype) {
      throw new BadRequestException(
        'hash, filename, and mimetype are required',
      );
    }
    return this.materialsService.registerLocalMaterial({
      hash,
      filename,
      mimetype,
      size,
      unitId,
      userId: user?.id,
    });
  }

  @Post('local/progress')
  @ApiOperation({
    summary: 'Register progress for a local (client-side) material',
  })
  async registerLocalProgress(
    @Body('hash') hash: string | undefined,
    @Body('materialId') materialId: string | undefined,
    @Body('percent') percent: number,
    @Body('timeSpentSeconds') timeSpentSeconds?: number,
    @Body('lastPage') lastPage?: number,
    @Body('unitId') unitId?: string,
    @GetUser() user?: PrismaUser,
  ) {
    if (!hash && !materialId) {
      throw new BadRequestException('hash or materialId is required');
    }
    // Normalize inputs
    const payload = {
      hash,
      materialId,
      percent,
      timeSpentSeconds: timeSpentSeconds || 0,
      lastPage,
      unitId,
      userId: user?.id,
    };
    return this.materialsService.registerLocalProgress(payload);
  }

  @Post('files/:fileId/metadata')
  @ApiOperation({ summary: 'Update file metadata' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        mimetype: { type: 'string' },
        size: { type: 'number' },
        hash: { type: 'string' },
      },
    },
  })
  async updateFileMetadata(
    @Param('fileId') fileId: string,
    @Body() metadata: Partial<File>,
  ) {
    return this.materialsService.updateFileMetadata(fileId, metadata);
  }

  // ========================================
  // LOCAL FILE SYSTEM ENDPOINTS (DEV MODE)
  // ========================================

}
