import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/common';
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
  constructor(private readonly materialsService: MaterialsService) {}

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
          description: 'ID of the course to attach material to',
        },
        unitId: {
          type: 'string',
          description: 'ID of the unit to attach material to',
        },
        topicId: {
          type: 'string',
          description: 'ID of the topic to attach material to',
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
    );
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

  @Get('paginated')
  @ApiOperation({ summary: 'Get paginated materials with scoping' })
  async getPaginated(
    @GetUser() user: PrismaUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('scope') scope?: 'all' | 'enrolled' | 'recommended' | 'owned',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('unitId') unitId?: string,
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
  async findMaterialsByUnitId(@Param('unitId') unitId: string) {
    return this.materialsService.findMaterialsByUnitId(unitId);
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
  async findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get material download URL' })
  async getDownloadUrl(@Param('id') id: string, @GetUser() user: PrismaUser) {
    return this.materialsService.getDownloadUrl(id, user.id);
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
  async getMaterialWithFileUrl(@Param('id') id: string) {
    return this.materialsService.getMaterialWithFileUrl(id);
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

  @Post(':id/share')
  @ApiOperation({ summary: 'Share material with another user' })
  async shareMaterial(
    @Param('id') materialId: string,
    @Body('userId') sharedWithUserId: string,
  ) {
    return this.materialsService.shareMaterial(materialId, sharedWithUserId);
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
