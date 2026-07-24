// c:\Users\user\medical\backend\src\modules\education\courses\services\directory-ingestion.service.ts
/**
 * DirectoryIngestionService
 *
 * Dynamically scans a root directory (e.g. C:\Users\user\PHARMACY) and creates
 * the full Coursera-style hierarchy in the DB:
 *
 *  Root Folder  → Specialization (LearningPath)
 *    LEVEL X    → nothing (used only to group sub-levels)
 *    LEVEL X.Y  → nothing (used only to group course folders)
 *      COURSE FOLDER (e.g. "PPB 310 PHARMACOLOGY I") → Course + Unit("General Resources")
 *        file.pdf  → Material (registered via MaterialsService.registerLocalMaterial)
 *        sub-folder → additional Unit inside the same Course, files inside it become Materials
 *
 * Trigger: set env var  RUN_INGESTION=true  before starting the app,
 * or call  ingestDirectory(rootPath)  directly from a controller / admin endpoint.
 *
 * You can safely delete this file after the one-time ingestion or keep it as a
 * re-runnable sync utility (upsert semantics prevent duplicates).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { CourseDifficulty, LearningPathStatus } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { MaterialsService } from './materials.service';

@Injectable()
export class DirectoryIngestionService implements OnModuleInit {
  private readonly logger = new Logger(DirectoryIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialsService: MaterialsService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────── lifecycle ────────────────────────────────────────

  async onModuleInit() {
    if (this.configService.get<boolean>('RUN_INGESTION')) {
      const rootPath = this.configService.get<string>('INGESTION_ROOT_PATH')!;
      this.logger.log(
        `RUN_INGESTION is set – starting ingestion from: ${rootPath}`,
      );
      await this.ingestDirectory(rootPath).catch((err) =>
        this.logger.error('Ingestion failed', err),
      );
    }
  }

  // ─────────────────────── public API ───────────────────────────────────────

  /**
   * Entry point.  Pass any root directory; the basename becomes the
   * Specialization / LearningPath title.
   */
  async ingestDirectory(rootPath: string): Promise<void> {
    const specializationName = path.basename(rootPath);
    this.logger.log(`Ingesting "${specializationName}" from ${rootPath} …`);

    // 1. Resolve a category (best-match by name, fall back to first available)
    const category =
      (await this.prisma.courseCategory.findFirst({
        where: {
          name: { contains: specializationName, mode: 'insensitive' },
        },
      })) ?? (await this.prisma.courseCategory.findFirst());

    // 2. Upsert the Specialization (LearningPath)
    await this.prisma.learningPath.upsert({
      where: { id: this.makeId('path', specializationName) },
      update: {},
      create: {
        id: this.makeId('path', specializationName),
        title: `${specializationName} Specialization`,
        description: `Auto-generated learning path from local ${specializationName} resources.`,
        categoryId: category?.id ?? '',
        difficulty: CourseDifficulty.intermediate,
        status: LearningPathStatus.published,
        specialization: specializationName,
        pathStructure: { phases: [] } as any,
      },
    });

    // 3. Walk top-level children
    const topLevelEntries = await this.safeReaddir(rootPath);
    let unitOrder = 0;

    for (const entry of topLevelEntries) {
      const entryPath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        const nameLower = entry.name.toLowerCase();

        if (nameLower.startsWith('level')) {
          // It's a "LEVEL X" folder – recurse one level deeper
          const sublevelEntries = await this.safeReaddir(entryPath);
          for (const sub of sublevelEntries) {
            if (sub.isDirectory()) {
              unitOrder = await this.processLeafFolder(
                path.join(entryPath, sub.name),
                sub.name,
                category?.id ?? '',
                unitOrder,
              );
            }
          }
        } else {
          // Treat as a direct course folder (TEXTBOOKS, Miscellaneous, etc.)
          unitOrder = await this.processLeafFolder(
            entryPath,
            entry.name,
            category?.id ?? '',
            unitOrder,
          );
        }
      } else if (entry.isFile()) {
        // Top-level loose file → put in a "General" course
        await this.registerFile(
          entryPath,
          await this.ensureUnit(
            await this.ensureCourse('General Resources', category?.id ?? ''),
            'General',
            1,
          ),
        );
      }
    }

    this.logger.log(`Ingestion of "${specializationName}" complete.`);
  }

  // ─────────────────────── private helpers ──────────────────────────────────

  /**
   * Handle one "leaf" folder which maps to a Course.
   * Sub-folders inside it → Units in the same Course.
   * Files inside it → Topics in the default "General Resources" Unit.
   */
  private async processLeafFolder(
    folderPath: string,
    folderName: string,
    categoryId: string,
    unitOrder: number,
  ): Promise<number> {
    const courseTitle = this.humaniseFolder(folderName);
    const courseId = await this.ensureCourse(courseTitle, categoryId);
    let localUnitOrder = 1;

    const entries = await this.safeReaddir(folderPath);
    const topFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'));
    const subFolders = entries.filter((e) => e.isDirectory());

    // Top-level PDF files → "General Resources" unit
    if (topFiles.length > 0) {
      const unitId = await this.ensureUnit(
        courseId,
        'General Resources',
        localUnitOrder++,
      );
      for (const file of topFiles) {
        const topicId = await this.ensureTopic(unitId, this.humaniseFolder(path.parse(file.name).name), 1);
        await this.registerFile(path.join(folderPath, file.name), unitId, topicId);
      }
    }

    // Sub-folders → individual units
    for (const sub of subFolders) {
      const subPath = path.join(folderPath, sub.name);
      const unitId = await this.ensureUnit(
        courseId,
        this.humaniseFolder(sub.name),
        localUnitOrder++,
      );
      const subFiles = (await this.safeReaddir(subPath)).filter((e) =>
        e.isFile() && e.name.toLowerCase().endsWith('.pdf'),
      );
      
      let topicOrder = 1;
      for (const file of subFiles) {
        const topicId = await this.ensureTopic(unitId, this.humaniseFolder(path.parse(file.name).name), topicOrder++);
        await this.registerFile(path.join(subPath, file.name), unitId, topicId);
      }
    }

    return unitOrder + 1;
  }

  /** Create or retrieve a course by name (uses a deterministic id) */
  private async ensureCourse(
    title: string,
    categoryId: string,
  ): Promise<string> {
    const id = this.makeId('course', title);
    const course = await this.prisma.course.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: title,
        title,
        description: `Auto-generated course: ${title}`,
        categoryId,
        difficulty: CourseDifficulty.intermediate,
        status: 'published' as any,
      },
      select: { id: true },
    });
    return course.id;
  }

  /** Create or retrieve a unit within a course */
  private async ensureUnit(
    courseId: string,
    title: string,
    order: number,
  ): Promise<string> {
    const unit = await this.prisma.unit.upsert({
      where: { courseId_order: { courseId, order } },
      update: {},
      create: {
        name: title,
        title,
        courseId,
        order,
        slug: this.slugify(`${courseId}-${title}`),
      },
      select: { id: true },
    });
    return unit.id;
  }

  /** Create or retrieve a topic within a unit */
  private async ensureTopic(
    unitId: string,
    name: string,
    order: number,
  ): Promise<string> {
    // Try to find by name first within the unit
    const existing = await this.prisma.topic.findFirst({
      where: { unitId, name },
    });

    if (existing) return existing.id;

    const topic = await this.prisma.topic.create({
      data: {
        name,
        unitId,
        order,
      },
      select: { id: true },
    });
    return topic.id;
  }

  /** Hash-aware file registration (no duplicate records) */
  private async registerFile(filePath: string, unitId: string, topicId?: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      // Skip very large files (>250 MB) to avoid blocking startup
      if (stats.size > 250 * 1024 * 1024) {
        this.logger.warn(
          `Skipping large file (${(stats.size / 1024 / 1024).toFixed(1)} MB): ${path.basename(filePath)}`,
        );
        return;
      }

      // Check if it's a PDF
      const filename = path.basename(filePath);
      const ext = path.extname(filename).substring(1).toLowerCase();
      if (ext !== 'pdf') {
        this.logger.debug(`Skipping non-PDF file: ${filename}`);
        return;
      }

      const hash = await this.computeHash(filePath);
      const mimetype = 'application/pdf';

      await this.materialsService.registerLocalMaterial({
        hash,
        filename,
        mimetype,
        size: stats.size,
        unitId,
        topicId, // New: Link to topic
      });

      this.logger.debug(`Registered: ${filename} (unit ${unitId}, topic ${topicId})`);
    } catch (err) {
      this.logger.warn(
        `Could not register ${path.basename(filePath)}: ${(err as Error).message}`,
      );
    }
  }

  private async safeReaddir(dir: string): Promise<import('fs').Dirent[]> {
    try {
      return await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  }

  private async computeHash(filePath: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    return createHash('sha256').update(buf).digest('hex');
  }

  private getMimeType(ext: string): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  /**
   * Convert a folder name like "PPB 310 PHARMACOLOGY I"
   * into a human-readable title "PPB 310 Pharmacology I"
   */
  private humaniseFolder(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\.pdf$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private makeId(prefix: string, name: string): string {
    return `${prefix}-${this.slugify(name)}`;
  }
}
