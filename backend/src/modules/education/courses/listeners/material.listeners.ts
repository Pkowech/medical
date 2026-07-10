import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { handleServiceError } from '#common/utils/error.utils';
import { AiAnalyticsService } from '../../../ai-analytics/services/ai-analytics.service';
import { MaterialsService } from '../services/materials.service';
import * as path from 'path';

export interface MaterialViewEvent {
  materialId: string;
  userId: string;
  page?: number;
  timestamp: Date;
}

export interface MaterialDownloadEvent {
  materialId: string;
  userId: string;
  timestamp: Date;
}

export interface MaterialUploadEvent {
  materialId: string;
  userId: string;
  timestamp: Date;
}

@Injectable()
export class MaterialListeners {
  private readonly logger = new Logger(MaterialListeners.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAnalyticsService: AiAnalyticsService,
    @Inject(forwardRef(() => MaterialsService))
    private readonly materialsService: MaterialsService,
  ) {}

  @OnEvent('material.view', { async: true })
  async handleMaterialView(event: MaterialViewEvent) {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id: event.materialId },
      });

      if (!material) {
        this.logger.warn(`Material ${event.materialId} not found for view event`);
        return;
      }

      await this.prisma.materialEvent.upsert({
        where: {
          material_events_user_material_type_idx: {
            userId: event.userId,
            materialId: event.materialId,
            eventType: 'view',
          },
        },
        update: {
          lastOccurredAt: event.timestamp,
          viewCount: { increment: 1 },
          lastPage: event.page,
        },
        create: {
          userId: event.userId,
          materialId: event.materialId,
          eventType: 'view',
          viewCount: 1,
          lastPage: event.page,
          lastOccurredAt: event.timestamp,
        },
      });

      this.logger.debug(`Material view event recorded`, {
        materialId: event.materialId,
        userId: event.userId,
        page: event.page,
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'handleMaterialView');
    }
  }

  @OnEvent('material.download', { async: true })
  async handleMaterialDownload(event: MaterialDownloadEvent) {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id: event.materialId },
      });

      if (!material) {
        this.logger.warn(`Material ${event.materialId} not found for download event`);
        return;
      }

      await this.prisma.materialEvent.upsert({
        where: {
          material_events_user_material_type_idx: {
            userId: event.userId,
            materialId: event.materialId,
            eventType: 'download',
          },
        },
        update: {
          lastOccurredAt: event.timestamp,
          downloadCount: { increment: 1 },
        },
        create: {
          userId: event.userId,
          materialId: event.materialId,
          eventType: 'download',
          downloadCount: 1,
          lastOccurredAt: event.timestamp,
        },
      });

      this.logger.debug(`Material download event recorded`, {
        materialId: event.materialId,
        userId: event.userId,
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'handleMaterialDownload');
    }
  }

  @OnEvent('material.upload', { async: true })
  async handleMaterialUpload(event: MaterialUploadEvent) {
    try {
      // 1. Record upload event
      await this.prisma.materialEvent.create({
        data: {
          userId: event.userId,
          materialId: event.materialId,
          eventType: 'upload',
          lastOccurredAt: event.timestamp,
        },
      });

      // 2. Trigger AI processing (Quiz Extraction)
      const material = await this.prisma.material.findUnique({
        where: { id: event.materialId },
        include: { file: true },
      });

      if (material && material.file && material.file.key) {
        const ext = path.extname(material.file.filename).toLowerCase();
        if (ext === '.pdf') {
          const filePath = material.file.key; 
          this.logger.log(`Material ${material.id} is a PDF. Triggering AI quiz extraction...`);
          await this.aiAnalyticsService.extractQuizzesFromMaterial(material.id, filePath);
        }
      }

      this.logger.debug(`Material upload event recorded and AI processing triggered`, {
        materialId: event.materialId,
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error(`Error in handleMaterialUpload: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
