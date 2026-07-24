import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FILE_STORAGE,
  IFileStorage,
} from '#infrastructure/storage/file-storage.interface';

import { createHash } from 'crypto';
import { Readable } from 'stream';
import {
  hashBuffer,
  hashStreamAndCollect,
} from '#infrastructure/storage/hash.util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { handleServiceError, getErrorMessage } from '#common/utils';
import {
  Material,
  MaterialShare,
  MaterialType,
  File,
  ProgressStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProgressService } from './progress.service';
import { AiAnalyticsService } from '../../../ai-analytics/services/ai-analytics.service';
import { FtsUtils } from '#common/utils/fts.utils';
// Local LibreOffice conversion removed. All document conversions are
// delegated to the Gotenberg service configured via `GOTENBERG_URL`.

import { GlobalSearchSyncService } from '#infrastructure/search/services/global-search-sync.service';

export interface RegisterExternalResourceDto {
  title: string;
  url: string;
  type: MaterialType;
  description?: string;
  unitId?: string;
  topicId?: string;
  userId?: string;
  category?: string;
  difficulty?: number;
  tags?: string[];
  metadata?: any;
}

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);
  private readonly storageProvider: 'local' | 's3';
  private readonly localStoragePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
    private readonly eventEmitter: EventEmitter2,
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly progressService: ProgressService,
    private readonly searchSync: GlobalSearchSyncService,
  ) {
    this.storageProvider =
      this.configService.get<string>('FILE_STORAGE_PROVIDER') === 'local'
        ? 'local'
        : 's3';
    this.localStoragePath =
      this.configService.get<string>('LOCAL_STORAGE_PATH') ||
      'C:\\Users\\user\\PHARMACY';

    this.logger.log(
      `Materials service initialized with ${this.storageProvider} storage`,
      {
        localPath:
          this.storageProvider === 'local' ? this.localStoragePath : undefined,
      },
    );
  }

  /**
   * Search for files in the local PHARMACY directory
   */
  async searchLocalFiles(query: string): Promise<
    Array<{
      path: string;
      name: string;
      size: number;
      extension: string;
      directory: string;
    }>
  > {
    if (this.storageProvider !== 'local') {
      throw new BadRequestException(
        'File search is only available in local storage mode',
      );
    }

    try {
      const results: Array<{
        path: string;
        name: string;
        size: number;
        extension: string;
        directory: string;
      }> = [];

      const searchInDirectory = async (dir: string): Promise<void> => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              await searchInDirectory(fullPath);
            } else if (entry.isFile()) {
              const lowerName = entry.name.toLowerCase();
              const lowerQuery = query.toLowerCase();

              if (lowerName.includes(lowerQuery)) {
                const stats = await fs.stat(fullPath);
                const ext = path.extname(entry.name).substring(1).toLowerCase();

                results.push({
                  path: fullPath,
                  name: entry.name,
                  size: stats.size,
                  extension: ext,
                  directory:
                    path.relative(this.localStoragePath, dir) || 'root',
                });
              }
            }
          }
        } catch (_error) {
          // Skip directories that can't be accessed
          this.logger.warn(`Cannot access directory: ${dir}`);
        }
      };

      await searchInDirectory(this.localStoragePath);

      this.logger.log('File search completed', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Error searching files', {
        error: (error as any)?.message,
      });
      throw new BadRequestException('Failed to search files');
    }
  }

  /**
   * Get file content from local storage
   */
  async getLocalFile(filePath: string): Promise<{
    content: Buffer;
    mimeType: string;
    fileName: string;
  }> {
    if (this.storageProvider !== 'local') {
      throw new BadRequestException(
        'Local file access is only available in local storage mode',
      );
    }

    try {
      // Security check: ensure the file is within the allowed storage path
      const resolvedStoragePath = path.resolve(this.localStoragePath);
      const resolvedPath = path.resolve(resolvedStoragePath, filePath);
      const relativeToStorage = path.relative(resolvedStoragePath, resolvedPath);

      if (
        !(
          relativeToStorage === '' ||
          (!relativeToStorage.startsWith('..') && !path.isAbsolute(relativeToStorage))
        )
      ) {
        throw new ForbiddenException(
          'Access to file outside storage directory is not allowed',
        );
      }

      const content = await fs.readFile(resolvedPath);
      const fileName = path.basename(resolvedPath);
      const extension = path.extname(fileName).substring(1).toLowerCase();

      // Map extensions to MIME types
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        txt: 'text/plain',
        md: 'text/markdown',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        zip: 'application/zip',
      };

      const mimeType = mimeTypes[extension] || 'application/octet-stream';

      this.logger.log('Local file accessed', {
        fileName,
        size: content.length,
        mimeType,
      });

      return {
        content,
        mimeType,
        fileName,
      };
    } catch (error) {
      this.logger.error('Error accessing local file', {
        filePath,
        error: (error as any)?.message,
      });

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new NotFoundException('File not found or cannot be accessed');
    }
  }

  /**
   * List files in a directory
   */
  async listLocalDirectory(relativePath: string = ''): Promise<
    Array<{
      name: string;
      type: 'file' | 'directory';
      size?: number;
      extension?: string;
      path: string;
    }>
  > {
    if (this.storageProvider !== 'local') {
      throw new BadRequestException(
        'Directory listing is only available in local storage mode',
      );
    }

    try {
      const dirPath = path.join(this.localStoragePath, relativePath);

      // Security check: ensure requested directory is inside storage path
      const resolvedStoragePath = path.resolve(this.localStoragePath);
      const resolvedPath = path.resolve(dirPath);
      const relativeToStorage = path.relative(resolvedStoragePath, resolvedPath);

      if (
        !(
          relativeToStorage === '' ||
          (!relativeToStorage.startsWith('..') && !path.isAbsolute(relativeToStorage))
        )
      ) {
        throw new ForbiddenException(
          'Access outside storage directory is not allowed',
        );
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const results: Array<{
        name: string;
        type: 'file' | 'directory';
        size?: number;
        extension?: string;
        path: string;
      }> = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.localStoragePath, fullPath);

        if (entry.isDirectory()) {
          results.push({
            name: entry.name,
            type: 'directory',
            path: relativePath,
          });
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const ext = path.extname(entry.name).substring(1).toLowerCase();

          results.push({
            name: entry.name,
            type: 'file',
            size: stats.size,
            extension: ext,
            path: relativePath,
          });
        }
      }

      this.logger.log('Directory listed', {
        path: relativePath || 'root',
        itemCount: results.length,
      });

      return results.sort((a, b) => {
        // Directories first, then files alphabetically
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      this.logger.error('Error listing directory', {
        relativePath,
        error: (error as any)?.message,
      });

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new NotFoundException('Directory not found or cannot be accessed');
    }
  }

  async create(material: Partial<Material>): Promise<Material> {
    try {
      const newMaterial = await this.prisma.material.create({
        data: {
          title: material.title || 'Untitled',
          type: material.type || MaterialType.other,
          fileId: material.fileId,
          unitId: material.unitId || '',
          userId: material.userId || '',
          content: material.content,
          category: material.category,
          difficulty: material.difficulty,
          duration: material.duration,
          version: 1,
          metadata: material.metadata || {},
        },
        include: {
          unit: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Explicitly update FTS vector (replacing DB trigger)
      await FtsUtils.updateFtsVector(this.prisma, 'materials', newMaterial.id);

      // Sync to global search index
      await this.searchSync.syncEntity('material', newMaterial.id);

      this.logger.log('Material created', { materialId: newMaterial.id });
      return newMaterial;
    } catch (error) {
      handleServiceError(error, this.logger, 'create');
    }
  }

  async update(id: string, data: Partial<Material>): Promise<Material> {
    try {
      const current = await this.prisma.material.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new NotFoundException(`Material with ID ${id} not found`);
      }

      const newVersion = current.version + 1;

      // Build update data, filtering out null/undefined values that conflict with Prisma types
      const updateData: any = { version: newVersion };
      Object.keys(data).forEach((key) => {
        if (
          data[key as keyof typeof data] !== null &&
          data[key as keyof typeof data] !== undefined
        ) {
          updateData[key] = data[key as keyof typeof data];
        }
      });

      const updated = await this.prisma.material.update({
        where: { id },
        data: updateData,
        include: {
          unit: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Mark old progress as stale
      await this.prisma.progress.updateMany({
        where: {
          materialId: id,
          materialVersion: { lt: newVersion },
        },
        data: {
          isStale: true,
        },
      });

      await FtsUtils.updateFtsVector(this.prisma, 'materials', updated.id);

      // Sync to global search index
      await this.searchSync.syncEntity('material', updated.id);

      this.logger.log('Material updated with new version', {
        materialId: id,
        newVersion,
      });
      return updated;
    } catch (error) {
      handleServiceError(error, this.logger, 'update');
    }
  }

  async findAll(options?: {
    courseId?: string;
    unitId?: string;
    topicId?: string;
    type?: MaterialType;
    userId?: string;
  }): Promise<Material[]> {
    try {
      const materials = await this.prisma.material.findMany({
        where: {
          courseId: options?.courseId,
          unitId: options?.unitId,
          topicId: options?.topicId,
          type: options?.type,
          userId: options?.userId,
        },
        include: {
          unit: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      this.logger.log('Materials fetched', {
        count: materials.length,
        ...options,
      });
      return materials;
    } catch (error) {
      handleServiceError(error, this.logger, 'findAll');
    }
  }

  async getDownloadUrl(id: string, userId: string): Promise<string> {
    try {
      const material = await this.findOne(id);
      if (!material) {
        throw new NotFoundException(`Material with ID ${id} not found`);
      }

      const signedUrl = await this.getMaterialDownloadUrl(id);

      // Track download event
      this.eventEmitter.emit('material.download', {
        materialId: id,
        userId,
        timestamp: new Date(),
      });

      return signedUrl;
    } catch (error) {
      handleServiceError(error, this.logger, 'getDownloadUrl');
    }
  }

  async trackView(
    materialId: string,
    userId: string,
    page?: number,
  ): Promise<void> {
    try {
      const material = await this.findOne(materialId);
      if (!material) {
        throw new NotFoundException(`Material with ID ${materialId} not found`);
      }

      // Emit view event for tracking
      this.eventEmitter.emit('material.view', {
        materialId,
        userId,
        page,
        timestamp: new Date(),
      });

      this.logger.log('Material view tracked', { materialId, userId, page });
    } catch (error) {
      handleServiceError(error, this.logger, 'trackView');
    }
  }

  async getMaterialStats(materialId: string): Promise<{
    views: number;
    downloads: number;
    uniqueViewers: number;
  }> {
    try {
      const material = await this.findOne(materialId);
      if (!material) {
        throw new NotFoundException(`Material with ID ${materialId} not found`);
      }

      // For now, return mock stats since we don't have a proper analytics store
      // In a real implementation, this would query a dedicated analytics store
      return {
        views: 0,
        downloads: 0,
        uniqueViewers: 0,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'getMaterialStats');
    }
  }

  async findOne(id: string): Promise<Material> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id },
        include: {
          unit: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (!material) {
        throw new NotFoundException(`Material with ID ${id} not found`);
      }
      this.logger.log('Material fetched', { materialId: id });
      return material;
    } catch (error) {
      handleServiceError(error, this.logger, 'findOne');
    }
  }

  async findMaterialsByUnitId(unitId: string): Promise<Material[]> {
    try {
      const materials = await this.prisma.material.findMany({
        where: { unitId },
        include: {
          unit: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      this.logger.log('Materials fetched by unitId', {
        unitId,
        count: materials.length,
      });
      return materials;
    } catch (error) {
      handleServiceError(error, this.logger, 'findMaterialsByUnitId');
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!material) {
        throw new NotFoundException(`Material with ID ${id} not found`);
      }

      if (material.userId !== userId) {
        // In a real app, also check for an 'ADMIN' role here
        throw new ForbiddenException(
          'You are not authorized to delete this material.',
        );
      }

      await this.prisma.material.delete({ where: { id } });
      this.logger.log('Material deleted', { materialId: id, userId });
    } catch (error) {
      handleServiceError(error, this.logger, 'remove');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    courseId?: string,
    unitId?: string,
    topicId?: string,
    title?: string,
    description?: string,
    type?: MaterialType,
    category?: string,
    difficulty?: number,
    tags?: string[],
  ): Promise<Material> {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      const allowedMimeTypes = [
        'application/pdf',
        'application/msword', // doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/vnd.ms-powerpoint', // ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Allowed: PDF, Office Documents, and Video files.`,
        );
      }

      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new BadRequestException('File too large. Maximum size is 50MB.');
      }

      // Optional: Check unit existence if unitId is provided and not empty
      if (courseId) {
        const course = await this.prisma.course.findUnique({
          where: { id: courseId },
        });
        if (!course) {
          throw new NotFoundException('Course not found');
        }
      }
      if (unitId) {
        const unit = await this.prisma.unit.findUnique({
          where: { id: unitId },
        });
        if (!unit) {
          throw new NotFoundException('Unit not found');
        }
      }
      if (topicId) {
        const topic = await this.prisma.topic.findUnique({
          where: { id: topicId },
        });
        if (!topic) {
          throw new NotFoundException('Topic not found');
        }
      }

      // Calculate file hash for deduplication (streaming-friendly)
      let fileHash: string;
      let uploadBuffer: Buffer | Uint8Array = file.buffer;

      if ((file as any).stream && !(file.buffer && file.buffer.length > 0)) {
        const result = await hashStreamAndCollect(
          (file as any).stream as Readable,
        );
        fileHash = result.hash;
        uploadBuffer = result.buffer;
      } else if (file.buffer) {
        fileHash = await hashBuffer(file.buffer);
      } else {
        fileHash = createHash('sha256').update(Buffer.from('')).digest('hex');
      }

      // Check if file already exists
      const existingFile = await this.prisma.file.findFirst({
        where: { hash: fileHash },
      });

      let fileRecord;

      if (existingFile) {
        this.logger.warn('Duplicate file detected, reusing existing file', {
          hash: fileHash,
          existingFileId: existingFile.id,
        });
        fileRecord = existingFile;
      } else {
        const sanitizedFilename = file.originalname.replace(/[^\w\s.-]/g, '');
        const fileKey = `materials/${fileHash}-${sanitizedFilename}`;

        const metadata: Record<string, string> = {
          'original-filename': sanitizedFilename,
          'upload-date': new Date().toISOString(),
          'user-id': userId,
          hash: fileHash,
        };

        await this.fileStorage.uploadBuffer(
          fileKey,
          uploadBuffer,
          file.mimetype,
          metadata,
        );

        this.logger.log('File uploaded to storage provider', {
          fileKey,
          userId,
          unitId,
        });

        fileRecord = await this.prisma.file.create({
          data: {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            hash: fileHash,
            key: fileKey,
            uploadedById: userId,
          },
        });
      }

      let previewFileRecord = null;
      // Convert Office documents to PDF via Gotenberg
      const officeMimeTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ];
      
      if (officeMimeTypes.includes(file.mimetype)) {
        this.logger.log('Sending document to Gotenberg for PDF conversion...');
        try {
          const formData = new FormData();
          formData.append('files', new Blob([uploadBuffer as any]), file.originalname);
          
          const gotenbergUrl = this.configService.get<string>('GOTENBERG_URL');
          const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            this.logger.error(`Gotenberg conversion failed: ${response.status} ${response.statusText}`);
          } else {
            const pdfArrayBuffer = await response.arrayBuffer();
            const pdfBuffer = Buffer.from(pdfArrayBuffer);
            const pdfHash = await hashBuffer(pdfBuffer);
            
            // Check if preview already exists
            const existingPreview = await this.prisma.file.findFirst({
              where: { hash: pdfHash },
            });
            
            if (existingPreview) {
              previewFileRecord = existingPreview;
            } else {
              const previewFilename = file.originalname.replace(/\.[^/.]+$/, "") + ".pdf";
              const sanitizedPreviewName = previewFilename.replace(/[^\w\s.-]/g, '');
              const previewKey = `materials/previews/${pdfHash}-${sanitizedPreviewName}`;
              
              await this.fileStorage.uploadBuffer(
                previewKey,
                pdfBuffer,
                'application/pdf',
                {
                  'original-filename': sanitizedPreviewName,
                  'upload-date': new Date().toISOString(),
                  'user-id': userId,
                  hash: pdfHash,
                },
              );
              
              previewFileRecord = await this.prisma.file.create({
                data: {
                  filename: previewFilename,
                  mimetype: 'application/pdf',
                  size: pdfBuffer.length,
                  hash: pdfHash,
                  key: previewKey,
                  uploadedById: userId,
                },
              });
              this.logger.log('Gotenberg conversion successful, saved preview file.');
            }
          }
        } catch (convertErr) {
          this.logger.error('Error connecting to Gotenberg', { error: (convertErr as Error).message });
        }
      }

      const material = await this.prisma.material.create({
        data: {
          title: title || file.originalname,
          description,
          type: type || MaterialType.other,
          fileId: fileRecord.id,
          previewFileId: previewFileRecord?.id || null,
          courseId: courseId || null,
          unitId: unitId || null, // Allow null if not attached to unit
          topicId: topicId || null,
          userId,
          category,
          difficulty: difficulty || 0.5,
          metadata: tags ? { tags } : {},
        },
        include: {
          file: true,
          previewFile: true,
          unit: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Explicitly update FTS vector (replacing DB trigger)
      await FtsUtils.updateFtsVector(this.prisma, 'materials', material.id);

      // Sync to global search index
      await this.searchSync.syncEntity('material', material.id);

      // Emit upload event for tracking
      this.eventEmitter.emit('material.upload', {
        materialId: material.id,
        userId,
        courseId,
        unitId,
        topicId,
        fileId: fileRecord.id,
        isNewFile: !existingFile,
        timestamp: new Date(),
      });

      this.logger.log('Material created', { materialId: material.id, userId });
      return material;
    } catch (error) {
      handleServiceError(error, this.logger, 'uploadFile');
    }
  }

  async findAllPaginated(options: {
    page: number;
    limit: number;
    search?: string;
    type?: string;
    scope?: 'all' | 'enrolled' | 'recommended' | 'owned';
    userId: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    unitId?: string;
  }) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        type,
        scope = 'owned',
        userId,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        unitId,
      } = options;

      const skip = (page - 1) * limit;
      const where: any = {};

      // 1. Scope Logic
      if (scope === 'owned') {
        // User's own materials
        where.userId = userId;
      } else if (scope === 'enrolled') {
        // Materials in units of courses the user is enrolled in
        where.unit = {
          course: {
            enrollments: {
              some: {
                userId,
                status: 'active',
              },
            },
          },
        };
      } else if (scope === 'recommended') {
        // Placeholder for recommended logic - for now, maybe featured courses or matching user interests
        // This likely needs a separate query or join with recommendations table
        // Falling back to 'all' accessible for now, or maybe 'public' if we had that concept
        where.OR = [
          { userId }, // Own
          { unit: { course: { isFeatured: true } } }, // Featured content
        ];
      } else if (scope === 'all') {
        // Maybe admin only? Or search everything?
        // Let's restrict 'all' to Own + Enrolled to be safe unless we want a public library
        where.OR = [
          { userId },
          {
            unit: {
              course: {
                enrollments: {
                  some: { userId },
                },
              },
            },
          },
        ];
      }

      // 2. Filters
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      if (unitId) {
        where.unitId = unitId;
      }

      if (type) {
        // Check if type matches enum
        if (Object.values(MaterialType).includes(type as MaterialType)) {
          where.type = type as MaterialType;
        } else {
          // It might be an 'intent' filter (category)
          where.category = { contains: type, mode: 'insensitive' };
        }
      }

      // 3. Execute Query
      const [items, total] = await Promise.all([
        this.prisma.material.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            unit: {
              select: {
                id: true,
                title: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            user: { select: { id: true, firstName: true, lastName: true } },
            file: true,
          },
        }),
        this.prisma.material.count({ where }),
      ]);

      // Add fileUrl to each material. For local files, return local serve URL; for S3/R2 files, generate presigned download URLs.
      const itemsWithUrls = await Promise.all(
        items.map(async (material) => {
          let fileUrl: string | undefined;

          let previewFileUrl: string | undefined;

          if (material.file) {
            if (material.file.key?.startsWith('local:')) {
              const fileHash = material.file.hash;
              if (fileHash) {
                fileUrl = `/api/materials/local/serve/${fileHash}`;
              }
            } else if (material.file.key) {
              try {
                // Use existing helper to generate a presigned URL
                fileUrl = await this.getMaterialDownloadUrl(material.id);
              } catch (err) {
                this.logger.warn('Failed to generate presigned URL for material', {
                  materialId: material.id,
                  error: (err as any)?.message,
                });
                // Fallback to returning the storage key so callers can decide
                fileUrl = material.file.key;
              }
            }
          }

          if (material.previewFileId) {
            try {
              previewFileUrl = await this.getMaterialPreviewUrl(material.id);
            } catch (err) {
              this.logger.warn('Failed to generate presigned preview URL for material', {
                materialId: material.id,
                error: (err as any)?.message,
              });
            }
          }

          return {
            ...material,
            fileUrl,
            previewFileUrl,
          };
        }),
      );

      return {
        items: itemsWithUrls,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'findAllPaginated');
    }
  }

  async convertToPdf(file: Express.Multer.File, userId: string) {
    try {
      const ext = file.originalname.split('.').pop() || '';
      if (!['ppt', 'pptx', 'odp'].includes(ext.toLowerCase())) {
        throw new BadRequestException(
          'Unsupported slide format for conversion',
        );
      }

      // Compute hash and reuse if exists
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      // Convert via Gotenberg (remote LibreOffice service)
      let pdfBuf: Buffer | undefined;
      try {
        const formData = new FormData();
        formData.append('files', new Blob([file.buffer as any]), file.originalname);

        const gotenbergUrl = this.configService.get<string>('GOTENBERG_URL')!;
        const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          this.logger.error(`Gotenberg conversion failed: ${response.status} ${response.statusText}`);
          throw new BadRequestException('Gotenberg conversion failed');
        }

        const pdfArrayBuffer = await response.arrayBuffer();
        pdfBuf = Buffer.from(pdfArrayBuffer);
      } catch (err) {
        this.logger.error('Conversion failed via Gotenberg', { error: (err as any)?.message });
        throw new BadRequestException('Conversion failed');
      }

      // Store PDF to S3 and create file + material record
      const sanitizedFilename = `${path.basename(file.originalname, path.extname(file.originalname))}.pdf`;
      const fileKey = `materials/${fileHash}-${sanitizedFilename}`;

      await this.fileStorage.uploadBuffer(fileKey, pdfBuf, 'application/pdf', {
        convertedFrom: file.originalname,
      });

      // Create file record
      const fileRecord = await this.prisma.file.create({
        data: {
          filename: sanitizedFilename,
          mimetype: 'application/pdf',
          size: pdfBuf.length,
          hash: fileHash,
          key: fileKey,
          uploadedById: userId,
        },
      });

      const material = await this.prisma.material.create({
        data: {
          title: sanitizedFilename,
          description: `Converted from ${file.originalname}`,
          type: MaterialType.pdf,
          fileId: fileRecord.id,
          userId,
        },
      });

      // Sync to global search index
      await this.searchSync.syncEntity('material', material.id);

      return { material, fileRecord };
    } catch (error) {
      handleServiceError(error, this.logger, 'convertToPdf');
    }
  }


  /**
   * Create a material linked to an external URL (e.g. YouTube, Wikipedia)
   */
  async createExternalResource(dto: RegisterExternalResourceDto) {
    try {
      const { title, url, type, description, unitId, topicId, userId, category, difficulty, tags, metadata } = dto;
      
      const material = await this.prisma.material.create({
        data: {
          title,
          content: url, // Store URL in content
          type,
          description,
          unitId,
          topicId,
          userId,
          category,
          difficulty,
          metadata: {
            ...metadata,
            externalUrl: url,
            isExternal: true,
            tags: tags || []
          }
        },
      });

      this.logger.log(`Created external resource: ${title} (${url})`);
      return material;
    } catch (error) {
      handleServiceError(error, this.logger, 'createExternalResource');
    }
  }

  /** Hash-aware material registration (no duplicate files) */
  async registerLocalMaterial(opts: {
    hash: string;
    filename: string;
    mimetype: string;
    size?: number;
    unitId?: string;
    topicId?: string;
    userId?: string;
  }) {
    try {
      const { hash, filename, mimetype, size, unitId, topicId, userId } = opts;
      const existing = await this.prisma.file.findFirst({ where: { hash } });
      let fileRecord = existing;
      if (!existing) {
        // Store a placeholder file record with key set to local:<hash>
        fileRecord = await this.prisma.file.create({
          data: {
            filename,
            mimetype,
            size: size || 0,
            hash,
            key: `local:${hash}`,
            uploadedById: userId,
          },
        });
      }

      // Create material pointing to fileRecord and unit if provided
      const material = await this.prisma.material.create({
        data: {
          title: filename,
          type:
            mimetype === 'application/pdf'
              ? MaterialType.pdf
              : mimetype.startsWith('video/')
                ? MaterialType.video
                : mimetype.includes('presentation') ||
                    mimetype.includes('powerpoint')
                  ? MaterialType.slide
                  : MaterialType.notes,
          fileId: fileRecord!.id,
          unitId: unitId || null,
          topicId: topicId || null,
          userId: userId || undefined,
        },
      });

      // Sync to global search index
      await this.searchSync.syncEntity('material', material.id);

      return { material, fileRecord };
    } catch (error) {
      handleServiceError(error, this.logger, 'registerLocalMaterial');
    }
  }

  async registerLocalProgress(opts: {
    hash?: string;
    materialId?: string;
    percent: number;
    timeSpentSeconds?: number;
    lastPage?: number;
    unitId?: string;
    userId?: string;
  }) {
    try {
      const {
        hash,
        materialId: providedMaterialId,
        percent,
        timeSpentSeconds,
        lastPage,
        unitId,
        userId,
      } = opts;
      if (!userId) {
        throw new BadRequestException('userId is required');
      }
      let materialId = providedMaterialId;
      // Try to resolve by hash if materialId not provided
      if (!materialId && hash) {
        const file = await this.prisma.file.findFirst({ where: { hash } });
        if (file) {
          const material = await this.prisma.material.findFirst({
            where: { fileId: file.id, unitId: unitId || undefined },
          });
          if (material) {
            materialId = material.id;
          }
        }
      }

      const elapsedMinutes = Math.max(
        0,
        Math.round((timeSpentSeconds || 0) / 60),
      );

      // If provided with a unitId, update unit progress
      if (unitId) {
        await this.progressService.updateUnitMaterialTopicProgress(userId, {
          unitId,
          status:
            percent >= 100
              ? ProgressStatus.completed
              : ProgressStatus.inProgress,
          progressPercentage: Math.max(0, Math.min(100, percent)),
          timeSpent: elapsedMinutes,
        } as any);
      } else if (materialId) {
        // If we only have a materialId
        if (percent >= 100) {
          await this.progressService.markMaterialAsRead(userId, materialId);
        } else {
          // update partial progress for the material (topic/unit-less case)
          await this.progressService.updateUnitMaterialTopicProgress(userId, {
            materialId,
            status: ProgressStatus.inProgress,
            progressPercentage: Math.max(0, Math.min(100, percent)),
            timeSpent: elapsedMinutes,
          } as any);
        }
      } else {
        throw new NotFoundException(
          'Material not found for provided hash or id',
        );
      }

      // Emit view event for analytics (lastPage if provided)
      if (materialId) {
        this.eventEmitter.emit('material.view', {
          materialId,
          userId,
          page: lastPage,
          timestamp: new Date(),
        });
      }

      this.logger.log('Local material progress registered', {
        materialId,
        userId,
        percent,
        elapsedMinutes,
      });
      return { success: true };
    } catch (error) {
      handleServiceError(error, this.logger, 'registerLocalProgress');
    }
  }

  async getFileMetadata(fileId: string): Promise<File> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });
      if (!file) {
        throw new NotFoundException(`File with ID ${fileId} not found`);
      }
      return file;
    } catch (error) {
      handleServiceError(error, this.logger, 'getFileMetadata');
    }
  }

  async deleteFile(fileId: string): Promise<File> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new NotFoundException(`File with ID ${fileId} not found`);
      }

      // Delete from S3 if exists
      if (file.key) {
        await this.fileStorage.deleteObject(file.key);
      }

      return await this.prisma.file.delete({
        where: { id: fileId },
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'deleteFile');
    }
  }

  async updateFileMetadata(
    fileId: string,
    metadata: Partial<File>,
  ): Promise<File> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new NotFoundException(`File with ID ${fileId} not found`);
      }

      return await this.prisma.file.update({
        where: { id: fileId },
        data: metadata,
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'updateFileMetadata');
    }
  }

  async getMaterialDownloadUrl(materialId: string): Promise<string> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id: materialId },
      });

      if (!material || !material.fileId) {
        throw new NotFoundException('Material or file not found');
      }

      const file = await this.prisma.file.findUnique({
        where: { id: material.fileId },
      });

      if (!file || !file.key) {
        throw new NotFoundException('File or file key not found');
      }

      // Ask storage infra for a presigned download URL that is readable in the browser
      return await this.fileStorage.getPresignedDownloadUrl(file.key, {
        filename: file.filename || file.key.split('/').pop(),
        contentType: file.mimetype || 'application/octet-stream',
        inline: true,
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'getMaterialDownloadUrl');
    }
  }

  async shareMaterial(
    materialId: string,
    sharedWithUserId: string,
  ): Promise<MaterialShare> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id: materialId },
      });
      if (!material) {
        throw new NotFoundException('Material not found');
      }

      const sharedWithUser = await this.prisma.user.findUnique({
        where: { id: sharedWithUserId },
      });
      if (!sharedWithUser) {
        throw new NotFoundException('Shared with user not found');
      }

      const share = await this.prisma.materialShare.create({
        data: {
          materialId,
          userId: sharedWithUserId, // userId represents the user with whom the material is shared
        },
        include: {
          material: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      this.logger.log('Material shared', { materialId, sharedWithUserId });
      return share;
    } catch (error) {
      handleServiceError(error, this.logger, 'shareMaterial');
    }
  }

  async findSharedMaterials(userId: string): Promise<MaterialShare[]> {
    try {
      const shares = await this.prisma.materialShare.findMany({
        where: { userId }, // userId represents the user with whom materials are shared
        include: {
          material: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } }, // Include the uploader from Material
            },
          },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      this.logger.log('Shared materials fetched', {
        userId,
        count: shares.length,
      });
      return shares;
    } catch (error) {
      handleServiceError(error, this.logger, 'findSharedMaterials');
    }
  }

  /**
   * Get recommended materials for a user using AI Analytics
   * Falls back to recent materials if recommendations unavailable
   */
  async getRecommendedMaterialsForUser(
    userId: string,
    limit: number = 5,
  ): Promise<Material[]> {
    try {
      // Get recommendations from Rust analytics
      const recommendations =
        await this.aiAnalyticsService.getRecommendationsAI(userId);

      if (!recommendations || recommendations.length === 0) {
        this.logger.warn(
          `No material recommendations found for user ${userId}, using recent materials`,
        );
        return this.prisma.material.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
      }

      // Extract material IDs from recommendations
      const recommendedMaterialIds = recommendations
        .map((rec: any) => rec.materialId || rec.material_id)
        .filter(Boolean)
        .slice(0, limit);

      if (recommendedMaterialIds.length === 0) {
        return this.prisma.material.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
      }

      // Fetch actual material details
      const materials = await this.prisma.material.findMany({
        where: { id: { in: recommendedMaterialIds } },
        take: limit,
      });

      this.logger.log(
        `Found ${materials.length} recommended materials for user ${userId}`,
      );
      return materials;
    } catch (error: any) {
      this.logger.error(
        `Error getting recommended materials for user ${userId}:`,
        {
          error: error?.message,
        },
      );
      // Graceful fallback
      return this.prisma.material.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  /**
   * Serve local PDF file by hash from seed-data
   */
  async serveLocalPdfByHash(fileHash: string) {
    try {
      // Find file record by hash
      const file = await this.prisma.file.findFirst({
        where: { hash: fileHash },
      });

      if (!file || !file.key?.startsWith('local:')) {
        throw new NotFoundException(
          `File with hash ${fileHash} not found or is not a local file`,
        );
      }

      // Construct path to seed-data
      const seedDataPath = path.resolve(
        __dirname,
        '../../..',
        'seed-data',
        'pdfs',
      );
      const filePath = path.resolve(seedDataPath, file.filename);

      // Also check if file is in parent directory (for kenya-national-medicines-formulary)
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(filePath);
      } catch {
        // Try parent directory
        const parentPath = path.resolve(
          __dirname,
          '../../..',
          '..',
          file.filename,
        );
        try {
          fileBuffer = await fs.readFile(parentPath);
        } catch {
          throw new NotFoundException(`PDF file not found: ${file.filename}`);
        }
      }

      this.logger.log('Serving local PDF', {
        filename: file.filename,
        hash: fileHash,
      });

      return {
        content: fileBuffer,
        mimeType: 'application/pdf',
        fileName: file.filename,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'serveLocalPdfByHash');
    }
  }

  async getMaterialPreviewUrl(materialId: string): Promise<string | undefined> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id: materialId },
      });

      if (!material || !material.previewFileId) {
        return undefined;
      }

      const file = await this.prisma.file.findUnique({
        where: { id: material.previewFileId },
      });

      if (!file || !file.key) {
        return undefined;
      }

      if (file.key.startsWith('local:')) {
        const fileHash = file.hash;
        if (fileHash) {
          return `/api/materials/local/serve/${fileHash}`;
        }
        return undefined;
      }

      return await this.fileStorage.getPresignedDownloadUrl(file.key, {
        filename: file.filename || file.key.split('/').pop(),
        contentType: file.mimetype || 'application/pdf',
        inline: true,
      });
    } catch (error) {
      this.logger.warn(`Could not generate preview URL for material ${materialId}`, error);
      return undefined;
    }
  }

  /**
   * Get material with file content URL for frontend
   */
  async getMaterialWithFileUrl(
    materialId: string,
  ): Promise<Material & { fileUrl?: string; previewFileUrl?: string }> {
    try {
      const material = await this.findOne(materialId);
      if (!material) {
        throw new NotFoundException(`Material with ID ${materialId} not found`);
      }

      // If file is local (key starts with 'local:'), construct a URL to fetch it
      const file = await this.prisma.file.findUnique({
        where: { id: material.fileId || '' },
      });

      let fileUrl: string | undefined;
      if (file && file.key?.startsWith('local:')) {
        // Construct URL for local file retrieval
        // Format: /api/materials/local/serve/{fileHash}
        const fileHash = file.hash;
        if (fileHash) {
          fileUrl = `/api/materials/local/serve/${fileHash}`;
        }
      } else if (file && file.key) {
        // For S3 files, generate signed URL
        try {
          fileUrl = await this.getMaterialDownloadUrl(materialId);
        } catch (_err) {
          this.logger.warn(
            `Could not generate S3 URL for material ${materialId}`,
          );
        }
      }

      let previewFileUrl: string | undefined;
      if (material.previewFileId) {
        previewFileUrl = await this.getMaterialPreviewUrl(materialId);
      }

      return { ...material, fileUrl, previewFileUrl };
    } catch (error) {
      handleServiceError(error, this.logger, 'getMaterialWithFileUrl');
    }
  }

  /**
   * Get materials by difficulty level based on user profile
   */
  async getMaterialsByDifficultyForUser(
    userId: string,
    limit: number = 10,
  ): Promise<Material[]> {
    try {
      // Get user's performance profile from AI Analytics
      const profile =
        await this.aiAnalyticsService.getUserPerformanceProfile(userId);

      // Determine difficulty range based on user's overall ability (0-1 scale)
      let difficultyMin = 0.3;
      let difficultyMax = 0.7;

      if (profile && profile.overallAbility > 0.8) {
        // High performer - advanced materials
        difficultyMin = 0.7;
        difficultyMax = 1.0;
      } else if (profile && profile.overallAbility < 0.5) {
        // Lower performer - easier materials
        difficultyMin = 0.0;
        difficultyMax = 0.4;
      }

      const materials = await this.prisma.material.findMany({
        where: {
          difficulty: {
            gte: difficultyMin,
            lte: difficultyMax,
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(
        `Found ${materials.length} materials with difficulty ${difficultyMin}-${difficultyMax} for user ${userId}`,
      );
      return materials;
    } catch (error: any) {
      this.logger.error(
        `Error getting materials by difficulty for user ${userId}:`,
        {
          error: getErrorMessage(error),
        },
      );
      // Fallback to all materials
      return this.prisma.material.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    }
  }
}
