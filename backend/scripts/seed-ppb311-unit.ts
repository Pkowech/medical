import 'dotenv/config';
import { MaterialType, PrismaClient } from '@prisma/client';
import { createSeedPrisma } from '../prisma/seeds/seed-db';

const COURSE_ID = '95d7389e-cebf-4c83-a1b0-0ed6a7811851';
const R2_PREFIX =
  'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege';

const TOPICS = [
  {
    order: 1,
    name: 'Introduction to Pharmacology',
    description:
      'Week 1: History of pharmacology, terminology, and drug nomenclature.',
  },
  {
    order: 2,
    name: 'Routes of Drug Administration',
    description:
      'Week 2: Routes of drug administration, including practical application.',
  },
  {
    order: 3,
    name: 'Pharmacokinetics: Absorption and Distribution',
    description: 'Week 3: Drug absorption and distribution.',
  },
  {
    order: 4,
    name: 'Pharmacokinetics: Metabolism and Elimination',
    description: 'Week 4: Drug metabolism and elimination.',
  },
  {
    order: 5,
    name: 'Pharmacodynamics: Principles and Drug Targets',
    description:
      'Week 5: Pharmacodynamic terminology, principles of drug action, enzymes, ion channels, membrane transporters, and signal transduction.',
  },
  {
    order: 6,
    name: 'CAT I',
    description: 'Week 6: Continuous Assessment Test I.',
  },
  {
    order: 7,
    name: 'Pharmacodynamics: Receptors and Drug Interactions',
    description:
      'Week 7: Receptors, drug-receptor interactions, the lock-and-key hypothesis, molecular recognition, specificity of drug action, and basic terminology.',
  },
  {
    order: 8,
    name: 'Variation in Drug Response',
    description:
      'Week 8: Factors that modify drug disposition and action.',
  },
  {
    order: 9,
    name: 'Adverse Drug Effects and Drug Interactions',
    description:
      'Week 9: Adverse drug effects and potential drug interactions.',
  },
  {
    order: 10,
    name: 'CAT II',
    description: 'Week 10: Continuous Assessment Test II.',
  },
  {
    order: 11,
    name: 'Pharmacogenetics',
    description:
      'Week 11: Genetic variation and its effects on drug response.',
  },
  {
    order: 12,
    name: 'Revision',
    description: 'Week 12: Course revision.',
  },
  {
    order: 13,
    name: 'Final Examinations',
    description: 'Weeks 13 and 14: Final examinations.',
  },
];

const LESSONS = [
  {
    materialId: 'tmat--ppb-310--ppb-311--1--0',
    fileId: 'file--ppb-311-lesson-1',
    title: 'Lesson 1 - Introduction to Pharmacology',
    filename: 'Lesson 1.pdf',
    size: 3557836,
    topicOrder: 1,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--2--0',
    fileId: 'file--ppb-311-lesson-2',
    title: 'Lesson 2 - Pharmacokinetics and Drug Routes',
    filename: 'Lesson 2 Pharmacokinetics & Drug routes.pdf',
    size: 512815,
    topicOrder: 2,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--2--1',
    fileId: 'file--ppb-311-lesson-3',
    title: 'Lesson 3 - Absorption',
    filename: 'Lesson 3 Absoprtion.pdf',
    size: 1151998,
    topicOrder: 3,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--2--2',
    fileId: 'file--ppb-311-lesson-4',
    title: 'Lesson 4 - Drug Distribution',
    filename: 'Lesson 4 Drug Distribution.pdf',
    size: 1254128,
    topicOrder: 3,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--3--0',
    fileId: 'file--ppb-311-lesson-5',
    title: 'Lesson 5 - Pharmacodynamics: Drug Targets',
    filename: 'Lesson 5 Pharmacodynamics (Drug Targets).pdf',
    size: 5603837,
    topicOrder: 5,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--2--3',
    fileId: 'file--ppb-311-lesson-6',
    title: 'Lesson 6 - Pharmacodynamics: Signal Transduction',
    filename: 'Lesson 6 Pharmacodynamics (signal transduction).pdf',
    size: 5193290,
    topicOrder: 5,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--2--4',
    fileId: 'file--ppb-311-lesson-7',
    title: 'Lesson 7 - Variation in Pharmacokinetics and Pharmacodynamics',
    filename: 'Lesson 7 Variation in Pharmaco-kinetic & -dybamics.pdf',
    size: 632287,
    topicOrder: 8,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--2--5',
    fileId: 'file--ppb-311-lesson-8',
    title: 'Lesson 8 - Pharmacogenetics',
    filename: 'Lesson 8 Pharmacogenetics.pdf',
    size: 3098509,
    topicOrder: 11,
  },
  {
    materialId: 'tmat--ppb-310--ppb-311--3--1',
    fileId: 'file--ppb-311-lesson-9',
    title: 'Lesson 9 - Adverse Drug Reactions and Drug Interactions',
    filename: 'Lesson 9 ADRs & Drug-Drug Interactions.pdf',
    size: 886428,
    topicOrder: 9,
  },
];

const OUTLINE = {
  materialId: 'umat--ppb-311-outline',
  fileId: 'file--ppb-311-outline',
  title: 'PPB 311 Course Outline',
  filename: 'PPB 311 Course Outline.pdf',
  size: 126293,
};

const CORE_BOOKS = [
  {
    materialId: 'cmat--ppb-310--0',
    fileId: 'file--ppb-310--0',
    title: 'KDT Essentials of Medical Pharmacology 7th Edition',
    filename: 'kdt-essentials-of-medical-pharmacology-7th-edition.pdf',
    size: 50334075,
    key: 'textbooks/pharmacology/kdt-essentials-of-medical-pharmacology-7th-edition.pdf',
  },
  {
    materialId: 'cmat--ppb-310--1',
    fileId: 'file--ppb-310--1',
    title: 'Katzung Basic and Clinical Pharmacology 14th Edition',
    filename: 'katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
    size: 16985747,
    key: 'textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
  },
  {
    materialId: 'cmat--ppb-310--2',
    fileId: 'file--ppb-310--2',
    title: 'Rang and Dale Pharmacology 7th Edition',
    filename: 'rang-dales-pharmacology-pdfdrive-.pdf',
    size: 105221960,
    key: 'textbooks/pharmacology/rang-dales-pharmacology-pdfdrive-.pdf',
  },
  {
    materialId: 'cmat--ppb-310--3',
    fileId: 'file--ppb-310--3',
    title: 'Goodman and Gilman Pharmacological Basis of Therapeutics 13th Edition',
    filename: 'goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf',
    size: 62144346,
    key: 'textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf',
  },
];

const ADDITIONAL_TOPIC_LINKS = [
  {
    materialId: 'tmat--ppb-311-week-4-pharmacokinetics',
    fileId: 'file--ppb-311-lesson-2',
    title: 'Lesson 2 - Pharmacokinetics and Drug Routes',
    filename: 'Lesson 2 Pharmacokinetics & Drug routes.pdf',
    size: 512815,
    topicOrder: 4,
  },
  {
    materialId: 'tmat--ppb-311-week-7-receptors',
    fileId: 'file--ppb-311-lesson-5',
    title: 'Lesson 5 - Pharmacodynamics: Drug Targets',
    filename: 'Lesson 5 Pharmacodynamics (Drug Targets).pdf',
    size: 5603837,
    topicOrder: 7,
  },
];

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const { pool, prisma } = createSeedPrisma();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: COURSE_ID },
        select: { id: true, title: true, createdById: true },
      });

      if (!course || course.title !== 'Pharmacology') {
        throw new Error('The expected Pharmacology course was not found.');
      }

      const existingUnits = await tx.unit.findMany({
        where: { courseId: course.id },
        select: { id: true, order: true, slug: true },
      }, { maxWait: 120000, timeout: 120000 });
      const existingPpb311 = existingUnits.find((item) => item.slug === 'ppb-311');
      const otherUnits = existingUnits.filter((item) => item.id !== existingPpb311?.id);
      const temporaryOrderBase =
        Math.max(0, ...existingUnits.map((item) => item.order)) + 1000;

      for (const [index, item] of otherUnits.entries()) {
        await tx.unit.update({
          where: { id: item.id },
          data: { order: temporaryOrderBase + index },
        });
      }

      const unitData = {
          name: 'PPB 311',
          title: 'Basic Principles in Pharmacology',
          description:
            'Purpose: Prepare learners with knowledge, skills, and attitudes in basic pharmacology. Outcomes: understand pharmacokinetics and pharmacodynamics; describe variation in drug response and adverse drug effects; identify potential drug interactions.',
          order: 1,
          isPublished: true,
      };
      const unit = existingPpb311
        ? await tx.unit.update({
            where: { id: existingPpb311.id },
            data: unitData,
          })
        : await tx.unit.create({
            data: { ...unitData, slug: 'ppb-311', courseId: course.id },
          });

      for (const item of otherUnits) {
        await tx.unit.update({
          where: { id: item.id },
          data: { order: item.order + 1 },
        });
      }

      const topicIds = new Map<number, string>();
      for (const topicData of TOPICS) {
        const topic = await tx.topic.upsert({
          where: {
            unitId_order: { unitId: unit.id, order: topicData.order },
          },
          update: {
            name: topicData.name,
            description: topicData.description,
            slug: toSlug(topicData.name),
          },
          create: {
            unitId: unit.id,
            order: topicData.order,
            name: topicData.name,
            description: topicData.description,
            slug: toSlug(topicData.name),
          },
          select: { id: true },
        });
        topicIds.set(topicData.order, topic.id);
      }

      const upsertR2Material = async (input: {
        materialId: string;
        fileId: string;
        title: string;
        filename: string;
        size: number;
        topicId?: string;
        key?: string;
      }) => {
        const key = input.key ?? `${R2_PREFIX}/${input.filename}`;
        await tx.file.upsert({
          where: { id: input.fileId },
          update: {
            filename: input.filename,
            mimetype: 'application/pdf',
            size: input.size,
            key,
            uploadedById: course.createdById,
          },
          create: {
            id: input.fileId,
            filename: input.filename,
            mimetype: 'application/pdf',
            size: input.size,
            key,
            uploadedById: course.createdById,
          },
        });

        await tx.material.upsert({
          where: { id: input.materialId },
          update: {
            title: input.title,
            type: MaterialType.pdf,
            fileId: input.fileId,
            content: null,
            courseId: course.id,
            unitId: unit.id,
            topicId: input.topicId ?? null,
          },
          create: {
            id: input.materialId,
            title: input.title,
            type: MaterialType.pdf,
            fileId: input.fileId,
            content: null,
            description: 'PPB 311 course material stored in R2.',
            courseId: course.id,
            unitId: unit.id,
            topicId: input.topicId ?? null,
            userId: course.createdById,
          },
        });
      };

      for (const lesson of LESSONS) {
        const topicId = topicIds.get(lesson.topicOrder);
        if (!topicId) throw new Error(`Missing topic order ${lesson.topicOrder}.`);
        await upsertR2Material({
          ...lesson,
          topicId,
        });
      }

      for (const topicLink of ADDITIONAL_TOPIC_LINKS) {
        const { topicOrder, ...material } = topicLink;
        const topicId = topicIds.get(topicOrder);
        if (!topicId) throw new Error(`Missing topic order ${topicOrder}.`);
        await upsertR2Material({ ...material, topicId });
      }

      await upsertR2Material(OUTLINE);
      for (const book of CORE_BOOKS) {
        await upsertR2Material(book);
      }

      return {
        courseId: course.id,
        unitId: unit.id,
        unitOrder: unit.order,
        unitTitle: unit.title,
        topicCount: TOPICS.length,
        lessonMaterials: LESSONS.length + ADDITIONAL_TOPIC_LINKS.length,
        coreBooks: CORE_BOOKS.length,
        outlineAttached: true,
      };
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});