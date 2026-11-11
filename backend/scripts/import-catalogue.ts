import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CourseDifficulty,
  CourseStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { createSeedPrisma } from '../prisma/seeds/seed-db';

interface CatalogueTopic {
  slug: string;
  name: string;
  description: string;
  order: number;
  estimatedMinutes: number;
}

interface CatalogueUnit {
  slug: string;
  name: string;
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  topics: CatalogueTopic[];
}

interface CatalogueCourse {
  code: string;
  name: string;
  title: string;
  description: string;
  difficulty: CourseDifficulty;
  units: CatalogueUnit[];
}

interface CatalogueImport {
  schemaVersion: 1;
  courses: CatalogueCourse[];
}

interface ImportPlan {
  courses: { create: number; unchanged: number };
  units: { create: number; unchanged: number };
  topics: { create: number; unchanged: number };
}

const difficulties = new Set(Object.values(CourseDifficulty));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  label: string,
  maximumLength = 255,
): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > maximumLength
  ) {
    throw new Error(`${label} must be a non-empty string (max ${maximumLength}).`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(value);
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} values must be unique within their parent.`);
  }
}

export function validateCatalogue(value: unknown): CatalogueImport {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.courses)) {
    throw new Error('Catalogue must use schemaVersion 1 and contain a courses array.');
  }

  const courses = value.courses.map((courseValue, courseIndex) => {
    const label = `courses[${courseIndex}]`;
    if (!isRecord(courseValue) || !Array.isArray(courseValue.units)) {
      throw new Error(`${label} must be an object with a units array.`);
    }

    const difficulty = courseValue.difficulty ?? CourseDifficulty.beginner;
    if (typeof difficulty !== 'string' || !difficulties.has(difficulty as CourseDifficulty)) {
      throw new Error(`${label}.difficulty is not a supported course difficulty.`);
    }

    const units = courseValue.units.map((unitValue, unitIndex) => {
      const unitLabel = `${label}.units[${unitIndex}]`;
      if (!isRecord(unitValue) || !Array.isArray(unitValue.topics)) {
        throw new Error(`${unitLabel} must be an object with a topics array.`);
      }

      const topics = unitValue.topics.map((topicValue, topicIndex) => {
        const topicLabel = `${unitLabel}.topics[${topicIndex}]`;
        if (!isRecord(topicValue)) {
          throw new Error(`${topicLabel} must be an object.`);
        }
        return {
          slug: requiredString(topicValue.slug, `${topicLabel}.slug`, 255),
          name: requiredString(topicValue.name, `${topicLabel}.name`),
          description: requiredString(
            topicValue.description,
            `${topicLabel}.description`,
            10000,
          ),
          order: positiveInteger(topicValue.order, `${topicLabel}.order`),
          estimatedMinutes: positiveInteger(
            topicValue.estimatedMinutes,
            `${topicLabel}.estimatedMinutes`,
          ),
        };
      });

      unique(topics.map(({ slug }) => slug), `${unitLabel}.topics.slug`);
      unique(topics.map(({ order }) => String(order)), `${unitLabel}.topics.order`);
      return {
        slug: requiredString(unitValue.slug, `${unitLabel}.slug`, 255),
        name: requiredString(unitValue.name, `${unitLabel}.name`),
        title: requiredString(unitValue.title, `${unitLabel}.title`),
        description: requiredString(
          unitValue.description,
          `${unitLabel}.description`,
          10000,
        ),
        order: positiveInteger(unitValue.order, `${unitLabel}.order`),
        estimatedMinutes: positiveInteger(
          unitValue.estimatedMinutes,
          `${unitLabel}.estimatedMinutes`,
        ),
        topics,
      };
    });

    unique(units.map(({ slug }) => slug), `${label}.units.slug`);
    unique(units.map(({ order }) => String(order)), `${label}.units.order`);
    return {
      code: requiredString(courseValue.code, `${label}.code`, 50),
      name: requiredString(courseValue.name, `${label}.name`),
      title: requiredString(courseValue.title, `${label}.title`),
      description: requiredString(
        courseValue.description,
        `${label}.description`,
        10000,
      ),
      difficulty: difficulty as CourseDifficulty,
      units,
    };
  });

  unique(courses.map(({ code }) => code), 'courses.code');
  return { schemaVersion: 1, courses };
}

function equalFields(
  existing: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  return Object.entries(expected).every(([key, value]) => existing[key] === value);
}

async function assertNoConflicts(
  prisma: Prisma.TransactionClient | PrismaClient,
  catalogue: CatalogueImport,
): Promise<ImportPlan> {
  const plan: ImportPlan = {
    courses: { create: 0, unchanged: 0 },
    units: { create: 0, unchanged: 0 },
    topics: { create: 0, unchanged: 0 },
  };
  const courses = await prisma.course.findMany({
    where: { code: { in: catalogue.courses.map(({ code }) => code) } },
    select: {
      id: true,
      code: true,
      name: true,
      title: true,
      description: true,
      difficulty: true,
    },
  });
  const courseByCode = new Map(courses.map((course) => [course.code, course]));

  for (const course of catalogue.courses) {
    const existingCourse = courseByCode.get(course.code);
    plan.courses[existingCourse ? 'unchanged' : 'create'] += 1;
    if (
      existingCourse &&
      !equalFields(existingCourse, {
        name: course.name,
        title: course.title,
        description: course.description,
        difficulty: course.difficulty,
      })
    ) {
      throw new Error(
        `Course ${course.code} already exists with different content; resolve it through a reviewed change, not an import overwrite.`,
      );
    }
    if (!existingCourse) {
      plan.units.create += course.units.length;
      plan.topics.create += course.units.reduce(
        (count, unit) => count + unit.topics.length,
        0,
      );
      continue;
    }

    const units = await prisma.unit.findMany({
      where: { courseId: existingCourse.id },
      select: {
        id: true,
        slug: true,
        name: true,
        title: true,
        description: true,
        order: true,
        estimatedMinutes: true,
      },
    });
    const unitBySlug = new Map(units.map((unit) => [unit.slug, unit]));

    for (const unit of course.units) {
      const existingUnit = unitBySlug.get(unit.slug);
      plan.units[existingUnit ? 'unchanged' : 'create'] += 1;
      if (
        !existingUnit &&
        units.some((existing) => existing.order === unit.order)
      ) {
        throw new Error(
          `Unit ${course.code}/${unit.slug} conflicts with an existing unit order; resolve the catalogue order before importing.`,
        );
      }
      if (
        existingUnit &&
        !equalFields(existingUnit, {
          name: unit.name,
          title: unit.title,
          description: unit.description,
          order: unit.order,
          estimatedMinutes: unit.estimatedMinutes,
        })
      ) {
        throw new Error(
          `Unit ${course.code}/${unit.slug} already exists with different content; resolve it through a reviewed change.`,
        );
      }
      if (!existingUnit) {
        plan.topics.create += unit.topics.length;
        continue;
      }

      const topics = await prisma.topic.findMany({
        where: { unitId: existingUnit.id },
        select: {
          slug: true,
          name: true,
          description: true,
          order: true,
          estimatedMinutes: true,
        },
      });
      const topicBySlug = new Map(topics.map((topic) => [topic.slug, topic]));
      for (const topic of unit.topics) {
        const existingTopic = topicBySlug.get(topic.slug);
        plan.topics[existingTopic ? 'unchanged' : 'create'] += 1;
        if (
          !existingTopic &&
          topics.some((existing) => existing.order === topic.order)
        ) {
          throw new Error(
            `Topic ${course.code}/${unit.slug}/${topic.slug} conflicts with an existing topic order; resolve the catalogue order before importing.`,
          );
        }
        if (
          existingTopic &&
          !equalFields(existingTopic, {
            name: topic.name,
            description: topic.description,
            order: topic.order,
            estimatedMinutes: topic.estimatedMinutes,
          })
        ) {
          throw new Error(
            `Topic ${course.code}/${unit.slug}/${topic.slug} already exists with different content; resolve it through a reviewed change.`,
          );
        }
      }
    }
  }
  return plan;
}

async function applyCatalogue(
  prisma: Prisma.TransactionClient,
  catalogue: CatalogueImport,
): Promise<void> {
  for (const course of catalogue.courses) {
    const importedCourse = await prisma.course.upsert({
      where: { code: course.code },
      update: {},
      create: {
        code: course.code,
        name: course.name,
        title: course.title,
        description: course.description,
        difficulty: course.difficulty,
        status: CourseStatus.draft,
      },
      select: { id: true },
    });

    for (const unit of course.units) {
      const importedUnit = await prisma.unit.upsert({
        where: {
          courseId_slug: { courseId: importedCourse.id, slug: unit.slug },
        },
        update: {},
        create: {
          courseId: importedCourse.id,
          slug: unit.slug,
          name: unit.name,
          title: unit.title,
          description: unit.description,
          order: unit.order,
          estimatedMinutes: unit.estimatedMinutes,
          isPublished: false,
        },
        select: { id: true },
      });

      for (const topic of unit.topics) {
        await prisma.topic.upsert({
          where: {
            unitId_slug: { unitId: importedUnit.id, slug: topic.slug },
          },
          update: {},
          create: {
            unitId: importedUnit.id,
            slug: topic.slug,
            name: topic.name,
            description: topic.description,
            order: topic.order,
            estimatedMinutes: topic.estimatedMinutes,
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const filePath = args.find((argument) => !argument.startsWith('--'));
  if (!filePath) {
    throw new Error(
      'Usage: pnpm catalogue:import <catalogue.json> [--apply --confirm-sha256=<file hash>]',
    );
  }
  if (apply && process.env.NODE_ENV === 'production' &&
      process.env.CATALOGUE_IMPORT_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Production imports require CATALOGUE_IMPORT_ALLOW_PRODUCTION=true after staging review.',
    );
  }

  const contents = await readFile(filePath);
  const hash = createHash('sha256').update(contents).digest('hex');
  if (apply && !args.includes(`--confirm-sha256=${hash}`)) {
    throw new Error(
      `Import confirmation is missing or stale. Review the file, then pass --confirm-sha256=${hash}.`,
    );
  }
  const catalogue = validateCatalogue(JSON.parse(contents.toString('utf8')));
  const { pool, prisma } = createSeedPrisma();
  try {
    const plan = await assertNoConflicts(prisma, catalogue);
    console.log(
      JSON.stringify(
        { mode: apply ? 'apply' : 'dry-run', sha256: hash, plan },
        null,
        2,
      ),
    );
    if (apply) {
      await prisma.$transaction((transaction) =>
        applyCatalogue(transaction, catalogue),
      );
      console.log('Catalogue import completed; imported courses remain unpublished.');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Catalogue import failed.');
    process.exitCode = 1;
  });
}
