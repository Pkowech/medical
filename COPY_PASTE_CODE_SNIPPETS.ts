/**
 * COPY-PASTE READY CODE SNIPPETS
 * For Courses & Materials Implementation
 * 
 * These are production-ready code samples from your working system
 * that can be directly adapted to new modules
 */

// ============================================
// 1. PRISMA SCHEMA - Material Model
// ============================================

/**
 * Add to your schema.prisma file:
 * 
 * @db.Text is used for longer content
 * @db.VarChar(255) for shorter strings
 * @@unique constraints prevent duplicates
 * @@index for query optimization
 */

model Material {
  id                  String               @id @default(uuid())
  title               String               @db.VarChar(255)
  type                MaterialType         // enum: PDF, VIDEO, PRESENTATION, etc.
  fileId              String?              @map("file_id")
  content             String?
  description         String?              @db.Text
  category            String?
  difficulty          Float?               @default(0.5)
  duration            Int?                 @default(0)
  metadata            Json?                // For flexible data storage
  courseId            String?              @map("course_id")
  unitId              String?              @map("unit_id")
  topicId             String?              @map("topic_id")
  userId              String?              @map("user_id")
  createdAt           DateTime             @default(now()) @map("created_at")
  updatedAt           DateTime             @updatedAt @map("updated_at")
  
  // Relations
  file                File?                @relation(fields: [fileId], references: [id])
  course              Course?              @relation(fields: [courseId], references: [id])
  unit                Unit?                @relation(fields: [unitId], references: [id])
  topic               Topic?               @relation(fields: [topicId], references: [id])
  user                User?                @relation(fields: [userId], references: [id])
  shares              MaterialShare[]
  progress            Progress[]

  @@index([fileId])
  @@index([courseId])
  @@index([unitId])
  @@index([topicId]) 
  @@index([type])
  @@index([userId])
  @@map("materials")
}

model MaterialShare {
  id         String   @id @default(uuid())
  materialId String   @map("material_id")
  userId     String   @map("user_id")
  sharedAt   DateTime @default(now()) @map("shared_at")
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([materialId, userId])  // Prevent duplicate shares
  @@map("material_shares")
}

model MaterialProgress {
  id             String    @id @default(uuid())
  userId         String    @map("user_id")
  materialId     String    @map("material_id")
  progress       Float     @default(0)      // 0-100%
  completedAt    DateTime? @map("completed_at")
  isCompleted    Boolean   @default(false) @map("is_completed")
  lastAccessedAt DateTime? @map("last_accessed_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, materialId], name: "user_material_unique")
  @@index([userId])
  @@index([materialId])
  @@map("material_progress")
}

// ============================================
// 2. ENUM DEFINITIONS
// ============================================

/**
 * Add to your schema.prisma or separate enums file
 */

enum MaterialType {
  PDF
  WORD
  VIDEO
  PRESENTATION
  IMAGE
  AUDIO
  LINK
  HTML
  MARKDOWN
}

enum ProgressStatus {
  notStarted
  inProgress
  completed
  paused
}

enum CourseDifficulty {
  beginner
  intermediate
  advanced
}

enum CourseStatus {
  draft
  published
  archived
}

// ============================================
// 3. DATA TRANSFER OBJECTS (DTOs)
// ============================================

// create-material.dto.ts
export class CreateMaterialDto {
  title: string;
  type: MaterialType;
  unitId: string;
  description?: string;
  category?: string;
  difficulty?: number;
  duration?: number;
  content?: string;
  metadata?: Record<string, any>;
}

// update-material.dto.ts
export class UpdateMaterialDto {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: number;
  duration?: number;
  content?: string;
  metadata?: Record<string, any>;
}

// ============================================
// 4. MATERIALS SERVICE
// ============================================

import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Material, MaterialType } from '@prisma/client';

@Injectable()
export class MaterialsService {
  private s3Client: S3Client;
  private readonly logger = new Logger(MaterialsService.name);

  constructor(private prisma: PrismaService) {
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
  }

  /**
   * Upload file to S3 and create material record
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    unitId: string,
    title: string,
    description?: string,
    type?: MaterialType,
  ): Promise<Material> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Generate unique key for S3
      const fileKey = `materials/${uuidv4()}/${file.originalname}`;
      
      // Calculate file hash for deduplication
      const hash = createHash('sha256').update(file.buffer).digest('hex');

      // Upload to S3
      const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(putCommand);

      // Create file record
      const fileRecord = await this.prisma.file.create({
        data: {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          key: fileKey,
          hash: hash,
          uploadedById: userId,
        },
      });

      // Create material record
      const material = await this.prisma.material.create({
        data: {
          title,
          type: type || MaterialType.PDF,
          description,
          fileId: fileRecord.id,
          unitId,
          userId,
          metadata: {
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          file: true,
        },
      });

      this.logger.log('Material uploaded', { materialId: material.id, userId });
      return material;
    } catch (error) {
      this.logger.error('Error uploading material', error);
      throw error;
    }
  }

  /**
   * Get all materials with optional filters
   */
  async findAll(filters: {
    unitId?: string;
    type?: MaterialType;
    userId?: string;
  }): Promise<Material[]> {
    return this.prisma.material.findMany({
      where: {
        ...(filters.unitId && { unitId: filters.unitId }),
        ...(filters.type && { type: filters.type }),
        ...(filters.userId && { userId: filters.userId }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        file: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single material by ID
   */
  async findOne(id: string): Promise<Material> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        file: true,
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${id} not found`);
    }

    return material;
  }

  /**
   * Get materials by unit ID
   */
  async findMaterialsByUnitId(unitId: string): Promise<Material[]> {
    return this.prisma.material.findMany({
      where: { unitId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        file: true,
      },
    });
  }

  /**
   * Delete material (file cleanup handled)
   */
  async remove(id: string, userId: string): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${id} not found`);
    }

    if (material.userId !== userId) {
      throw new ForbiddenException('You are not authorized to delete this material');
    }

    // Delete from S3 if file exists
    if (material.file?.key) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: material.file.key,
      });
      await this.s3Client.send(deleteCommand);
    }

    // Delete material record
    await this.prisma.material.delete({ where: { id } });
    this.logger.log('Material deleted', { materialId: id, userId });
  }

  /**
   * Get download URL (presigned S3 URL valid for 1 hour)
   */
  async getDownloadUrl(materialId: string, userId: string): Promise<string> {
    const material = await this.findOne(materialId);

    if (!material.file?.key) {
      throw new BadRequestException('Material has no associated file');
    }

    const getCommand = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: material.file.key,
    });

    const url = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 3600 });
    return url;
  }

  /**
   * Share material with another user
   */
  async shareMaterial(materialId: string, sharedWithUserId: string): Promise<void> {
    const material = await this.findOne(materialId);

    // Check if already shared
    const existingShare = await this.prisma.materialShare.findUnique({
      where: {
        materialId_userId: {
          materialId,
          userId: sharedWithUserId,
        },
      },
    });

    if (existingShare) {
      throw new BadRequestException('Material already shared with this user');
    }

    await this.prisma.materialShare.create({
      data: {
        materialId,
        userId: sharedWithUserId,
      },
    });

    this.logger.log('Material shared', { materialId, sharedWithUserId });
  }

  /**
   * Track material view
   */
  async trackView(materialId: string, userId: string): Promise<void> {
    await this.prisma.materialProgress.upsert({
      where: {
        userId_materialId: { userId, materialId },
      },
      update: {
        lastAccessedAt: new Date(),
        progress: { increment: 1 }, // Could be actual progress
      },
      create: {
        userId,
        materialId,
        progress: 1,
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * Get material statistics
   */
  async getMaterialStats(materialId: string): Promise<{
    views: number;
    downloads: number;
    usersAccessed: number;
  }> {
    const progress = await this.prisma.materialProgress.findMany({
      where: { materialId },
    });

    return {
      views: progress.length,
      downloads: progress.filter(p => p.isCompleted).length,
      usersAccessed: new Set(progress.map(p => p.userId)).size,
    };
  }
}

// ============================================
// 5. MATERIALS CONTROLLER
// ============================================

import { Controller, Get, Post, Delete, Body, Param, UseGuards, UploadedFile, UseInterceptors, BadRequestException, Query, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { GetUser } from '#common/decorators/get-user.decorator';
import { User as PrismaUser, MaterialType } from '@prisma/client';
import { MaterialsService } from '../services/materials.service';

@ApiTags('Materials')
@Controller('materials')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  @ApiOperation({ summary: 'Upload a course material' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        unitId: { type: 'string', description: 'ID of the unit' },
        title: { type: 'string', description: 'Material title' },
        description: { type: 'string' },
        type: { 
          enum: Object.values(MaterialType),
          description: 'Material type' 
        },
      },
      required: ['file', 'unitId', 'title'],
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('unitId') unitId: string,
    @Body('title') title: string,
    @GetUser() user: PrismaUser,
    @Body('description') description?: string,
    @Body('type') type?: MaterialType,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.materialsService.uploadFile(
      file,
      user.id,
      unitId,
      title,
      description,
      type,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all materials with filters' })
  async findAll(
    @Query('unitId') unitId?: string,
    @Query('type') type?: MaterialType,
    @Query('userId') userId?: string,
  ) {
    return this.materialsService.findAll({ unitId, type, userId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get material by ID' })
  async findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL' })
  async getDownloadUrl(@Param('id') id: string, @GetUser() user: PrismaUser) {
    return this.materialsService.getDownloadUrl(id, user.id);
  }

  @Post(':id/track/view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Track material view' })
  async trackView(@Param('id') id: string, @GetUser() user: PrismaUser) {
    await this.materialsService.trackView(id, user.id);
    return { success: true };
  }

  @Get(':id/stats')
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
  @ApiOperation({ summary: 'Share material with user' })
  async shareMaterial(
    @Param('id') materialId: string,
    @Body('userId') sharedWithUserId: string,
  ) {
    return this.materialsService.shareMaterial(materialId, sharedWithUserId);
  }

  @Get('unit/:unitId')
  @ApiOperation({ summary: 'Get materials for a unit' })
  async findMaterialsByUnitId(@Param('unitId') unitId: string) {
    return this.materialsService.findMaterialsByUnitId(unitId);
  }
}

// ============================================
// 6. MODULE SETUP
// ============================================

import { Module } from '@nestjs/common';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { MaterialsService } from '../services/materials.service';
import { MaterialsController } from '../controllers/materials.controller';
import { AuthModule } from '../../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}

// ============================================
// 7. FRONTEND SERVICE
// ============================================

import { apiService } from '../../auth/services/apiClient';

export interface Material {
  id: string;
  title: string;
  description?: string;
  type?: string;
  author?: string;
  uploadDate?: string;
  size?: string;
  url?: string;
}

const materialService = {
  async getMaterials(): Promise<Material[]> {
    const response = await apiService.get<Material[]>('/materials');
    return response.data;
  },

  async getMaterialById(id: string): Promise<Material> {
    const response = await apiService.get<Material>(`/materials/${id}`);
    return response.data;
  },

  async uploadMaterial(formData: FormData): Promise<Material> {
    const response = await apiService.post<Material>(
      '/materials/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  async deleteMaterial(id: string): Promise<void> {
    await apiService.delete(`/materials/${id}`);
  },

  async shareMaterial(id: string, userId: string): Promise<void> {
    await apiService.post(`/materials/${id}/share`, { userId });
  },

  async downloadMaterial(id: string): Promise<string> {
    const response = await apiService.get(`/materials/${id}/download`);
    return response.data;
  },

  async getMaterialStats(id: string) {
    const response = await apiService.get(`/materials/${id}/stats`);
    return response.data;
  },
};

export default materialService;

// ============================================
// 8. ZUSTAND STORE INTEGRATION
// ============================================

/**
 * Add to your existing Zustand store:
 */

interface Material {
  id: string;
  title: string;
  description?: string;
  type?: string;
  [key: string]: any;
}

interface AppState {
  // ... existing state ...
  
  // Material state
  materials: Record<string, Material>;
  setMaterials: (materials: Material[]) => void;
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, material: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ... existing implementations ...
      
      // Material state
      materials: {},
      setMaterials: (materials) =>
        set({
          materials: materials.reduce(
            (acc, material) => ({
              ...acc,
              [material.id]: material,
            }),
            {}
          ),
        }),
      addMaterial: (material) =>
        set((state) => ({
          materials: { ...state.materials, [material.id]: material },
        })),
      updateMaterial: (id, material) =>
        set((state) => ({
          materials: {
            ...state.materials,
            [id]: { ...state.materials[id], ...material },
          },
        })),
      removeMaterial: (id) =>
        set((state) => {
          const { [id]: removed, ...materials } = state.materials;
          return { materials };
        }),
    }),
    { name: 'app-store' }
  )
);

// ============================================
// 9. ENVIRONMENT VARIABLES
// ============================================

/**
 * Add to your .env file:
 */

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/database

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

// ============================================
// 10. MIGRATION COMMAND
// ============================================

/**
 * After adding models to schema.prisma:
 */

// Run this command
npx prisma migrate dev --name add_materials_module

// Or push directly to dev database
npx prisma db push

// Generate Prisma client
npx prisma generate
