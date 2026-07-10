import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { FtsUtils } from '#common/utils/fts.utils';

export type SearchEntityType = 'course' | 'unit' | 'topic' | 'material' | 'quiz' | 'clinical_case' | 'user';

@Injectable()
export class GlobalSearchSyncService implements OnModuleInit {
  private readonly logger = new Logger(GlobalSearchSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.globalSearchIndex.count();
      if (count === 0) {
        this.logger.log('Global Search Index is empty. Performing initial sync...');
        // Run in background to not block startup
        this.syncAll().catch(err => this.logger.error('Initial sync failed', err));
      }
    } catch (error) {
      this.logger.error('Failed to check search index status', error);
    }
  }

  /**
   * Syncs a single entity to the global search index
   */
  async syncEntity(type: SearchEntityType, id: string): Promise<void> {
    try {
      // 1. Update the local FTS vector first (legacy support)
      if (['course', 'unit', 'topic', 'material'].includes(type)) {
        await FtsUtils.updateFtsVector(this.prisma, type as any, id);
      }

      // 2. Fetch data based on type
      const data = await this.fetchEntityData(type, id);
      if (!data) return;

      // 3. Upsert into GlobalSearchIndex
      await this.prisma.globalSearchIndex.upsert({
        where: { id: `${type}_${id}` }, // Deterministic ID for upsert
        create: {
          id: `${type}_${id}`,
          entityId: id,
          entityType: type,
          title: data.title,
          description: data.description,
          content: data.content,
          tags: data.tags || [],
          metadata: data.metadata || {},
        },
        update: {
          title: data.title,
          description: data.description,
          content: data.content,
          tags: data.tags || [],
          metadata: data.metadata || {},
          updatedAt: new Date(),
        },
      });

      // 4. Update the FTS vector on the GlobalSearchIndex table itself
      await this.updateGlobalFtsVector(`${type}_${id}`);

    } catch (error) {
      this.logger.error(`Failed to sync ${type} ${id} to global index`, error);
    }
  }

  /**
   * Performs a full sync of all searchable entities
   */
  async syncAll(): Promise<void> {
    this.logger.log('Starting full search index sync...');
    const start = Date.now();

    const entities: SearchEntityType[] = ['course', 'unit', 'topic', 'material', 'quiz', 'clinical_case', 'user'];
    
    for (const type of entities) {
      const ids = await this.getAllIds(type);
      this.logger.log(`Syncing ${ids.length} ${type}s...`);
      
      for (const id of ids) {
        await this.syncEntity(type, id);
      }
    }

    this.logger.log(`Full search index sync completed in ${Date.now() - start}ms`);
  }

  private async fetchEntityData(type: SearchEntityType, id: string): Promise<any> {
    switch (type) {
      case 'course':
        return this.prisma.course.findUnique({ 
          where: { id }, 
          select: { title: true, description: true, tags: true } 
        });
      case 'unit':
        return this.prisma.unit.findUnique({ 
          where: { id }, 
          select: { title: true, description: true, content: true, courseId: true } 
        }).then(u => u ? { ...u, metadata: { courseId: u.courseId } } : null);
      case 'topic':
        return this.prisma.topic.findUnique({ 
          where: { id }, 
          include: { unit: { select: { courseId: true } } } 
        }).then(t => t ? { 
          title: t.name, 
          description: t.description, 
          metadata: { courseId: t.unit?.courseId } 
        } : null);
      case 'material':
        return this.prisma.material.findUnique({ 
          where: { id }, 
          include: { topic: { include: { unit: { select: { courseId: true } } } } } 
        }).then(m => m ? { 
          title: m.title, 
          description: m.description, 
          content: m.content, 
          metadata: { 
            ...(m.metadata as any), 
            courseId: m.topic?.unit?.courseId 
          },
          tags: (m.metadata as any)?.tags
        } : null);
      case 'quiz':
        return this.prisma.quiz.findUnique({ 
          where: { id }, 
          select: { title: true, description: true, topicId: true } 
        }).then(q => q ? { ...q, metadata: { topicId: q.topicId } } : null);
      case 'clinical_case':
        return this.prisma.clinicalCase.findUnique({ 
          where: { id }, 
          select: { title: true, description: true } 
        });
      case 'user':
        return this.prisma.user.findUnique({
          where: { id },
          select: { firstName: true, lastName: true, username: true, email: true, bio: true }
        }).then(u => u ? { 
          title: `${u.firstName} ${u.lastName}`.trim() || u.username || u.email,
          description: u.bio,
          metadata: { email: u.email, username: u.username }
        } : null);
      default:
        return null;
    }
  }

  private async getAllIds(type: SearchEntityType): Promise<string[]> {
    const table = type === 'clinical_case' ? 'clinicalCase' : type;
    const records = await (this.prisma[table as any] as any).findMany({ select: { id: true } });
    return records.map((r: any) => r.id);
  }

  private async updateGlobalFtsVector(id: string): Promise<void> {
    const query = `
      UPDATE "global_search_index"
      SET fts = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(content, '')), 'C')
      WHERE id = $1;
    `;
    await this.prisma.$executeRawUnsafe(query, id);
  }
}
