import 'dotenv/config';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MaterialType, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const COURSE_ID = '95d7389e-cebf-4c83-a1b0-0ed6a7811851';
const SOURCE_ROOT = 'C:/Users/user/PHARMACY/LEVEL 3/3.1/PPB 310 PHARMACOLOGY I';
const R2_PREFIX = 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I';

type Note = {
  relativePath: string;
  title: string;
  description: string;
};

type TopicSpec = {
  name: string;
  description: string;
  notes: Note[];
};

type UnitSpec = {
  title: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  topics: TopicSpec[];
};

const note = (
  folder: string,
  filename: string,
  title: string,
  description: string,
): Note => ({ relativePath: `${folder}/${filename}`, title, description });

const autocoidsFolder = 'autocoids pain and inflammation';
const developmentFolder = 'drug development-makanga';

const autocoidsReference = note(
  autocoidsFolder,
  'PPB 313 Dr. Makanga notes Autocoids A.O.pdf',
  'PPB 313 Autocoids: Comprehensive Notes',
  'Comprehensive reference covering autacoids, pain, inflammation, and related pharmacotherapy.',
);

const developmentReference = note(
  developmentFolder,
  'PPB 312 Dr.Makanga notes on drug development.pdf.pdf',
  'PPB 312 Drug Development: Comprehensive Notes',
  'Comprehensive reference covering drug discovery, development, clinical trials, and regulation.',
);

const UNITS: UnitSpec[] = [
  {
    title: 'Drug Development',
    name: 'drug-development',
    slug: 'drug-development',
    description: 'Drug discovery, pre-clinical studies, clinical trials (GCP/GLP), and regulatory approval.',
    order: 2,
    estimatedMinutes: 125,
    topics: [
      {
        name: 'Drug Discovery Process',
        description: 'Drug discovery pipeline, lead identification, optimization, and regulatory overview.',
        notes: [
          developmentReference,
          note(developmentFolder, 'PPB 312 Lecture 1A - Introduction to Drug Discovery Development & regulation - 23 (1).pptx', 'PPB 312 Lecture 1A: Introduction to Drug Development', 'Introduction to the drug development and regulatory pipeline.'),
          note(developmentFolder, 'PPB 312 Lecture 1B - Drug discovery.pdf', 'PPB 312 Lecture 1B: Drug Discovery', 'Drug discovery pipeline and lead development.'),
          note(developmentFolder, 'Lesson 1 Drug Discovery Process.ppt', 'Lesson 1: Drug Discovery Process', 'Drug discovery overview slides.'),
        ],
      },
      {
        name: 'Pre-clinical Studies and GLP',
        description: 'In-vitro and in-vivo pre-clinical studies and Good Laboratory Practice.',
        notes: [
          developmentReference,
          note(developmentFolder, 'Lesson 2 Pre(non)- Clinical Studies.pdf', 'Lesson 2: Pre-clinical Studies', 'Pre-clinical study design and safety evaluation.'),
          note(developmentFolder, 'PPB 312 Lecture 2B - GLP.pdf', 'PPB 312 Lecture 2B: Good Laboratory Practice', 'Good Laboratory Practice requirements.'),
        ],
      },
      {
        name: 'Clinical Trials and GCP',
        description: 'Clinical trial phases and design, Good Clinical Practice, ethics, and regulatory submissions.',
        notes: [
          developmentReference,
          note(developmentFolder, 'GCP.pptx', 'Good Clinical Practice', 'Core Good Clinical Practice principles.'),
          note(developmentFolder, 'PPB 312 Lecture 3B - GCP.pdf', 'PPB 312 Lecture 3B: Good Clinical Practice', 'GCP standards for clinical studies.'),
          note(developmentFolder, 'PPB 312 Lecture 4 - Clinical trials design & implementation.pdf', 'PPB 312 Lecture 4: Clinical Trial Design', 'Clinical trial design and implementation.'),
          note(developmentFolder, 'understanding_clinical_trials.pdf', 'Understanding Clinical Trials', 'Reference guide to clinical trial concepts.'),
        ],
      },
    ],
  },
  {
    title: 'Autocoids, Pain and Inflammation',
    name: 'autacoids-pain-inflammation',
    slug: 'autacoids-pain-inflammation',
    description: 'Histamine, serotonin, prostaglandins, NSAIDs, opioids, DMARDs, migraine, and gout pharmacotherapy.',
    order: 3,
    estimatedMinutes: 240,
    topics: [
      {
        name: 'Histamine and Antihistamines',
        description: 'Histamine synthesis, H1/H2 receptors, and first- and second-generation antihistamines.',
        notes: [
          autocoidsReference,
          note(autocoidsFolder, 'INTRODUCTION AND HISTAMINE.ppt', 'Introduction and Histamine', 'Histamine pharmacology and antihistamine overview.'),
        ],
      },
      {
        name: 'Serotonin and Eicosanoids',
        description: '5-HT receptors, serotonin pharmacology, prostaglandins, leukotrienes, and nitric oxide.',
        notes: [
          autocoidsReference,
          note(autocoidsFolder, 'serotonin.medicine,21 nov 2011 - Copy.ppt', 'Serotonin', 'Serotonin pharmacology and receptor actions.'),
          note(autocoidsFolder, 'EISCANOSIDS,final - Copy,i.ppt', 'Eicosanoids', 'Eicosanoid pharmacology.'),
          note(autocoidsFolder, 'Nitric oxide,medicine.ppt', 'Nitric Oxide', 'Nitric oxide as a pharmacological mediator.'),
        ],
      },
      {
        name: 'NSAIDs and Antipyretics',
        description: 'COX-1/COX-2 inhibition, aspirin, paracetamol, and non-steroidal anti-inflammatory drug classes.',
        notes: [
          autocoidsReference,
          note(autocoidsFolder, '1.Non steroidal anti-inflammatory drugs(nsaids),lecture 4.ppt', 'NSAIDs: Lecture 4', 'Overview of NSAID pharmacology.'),
          note(autocoidsFolder, '2.aspirin.ppt', 'Aspirin', 'Aspirin mechanism, uses, and adverse effects.'),
          note(autocoidsFolder, '3.Paracetamol(acetominophen).ppt', 'Paracetamol', 'Paracetamol pharmacology and toxicity.'),
          note(autocoidsFolder, '5.Indomethacin.ppt', 'Indomethacin', 'Indomethacin pharmacology.'),
          note(autocoidsFolder, '6.diclofenac.ppt', 'Diclofenac', 'Diclofenac pharmacology.'),
          note(autocoidsFolder, '7.Enolic acids(oxicams).ppt', 'Enolic Acids: Oxicams', 'Oxicam NSAID pharmacology.'),
          note(autocoidsFolder, '8.meloxicam.ppt', 'Meloxicam', 'Meloxicam pharmacology.'),
          note(autocoidsFolder, '9.fenamates.pptx', 'Fenamates', 'Fenamate NSAID pharmacology.'),
          note(autocoidsFolder, '10.NIMESULIDE.ppt', 'Nimesulide', 'Nimesulide pharmacology.'),
          note(autocoidsFolder, '11.Other nsaids.ppt', 'Other NSAIDs', 'Additional NSAID agents and properties.'),
          note(autocoidsFolder, '12.Selective,cox,2 inhibitors.ppt', 'Selective COX-2 Inhibitors', 'COX-2 selective inhibitor pharmacology.'),
          note(autocoidsFolder, 'PPB LECTURE 4 PROPIONIC ACID DERIVATIVES.ppt', 'Propionic Acid Derivatives', 'Propionic acid derivative NSAID pharmacology.'),
        ],
      },
      {
        name: 'Opioid Analgesics',
        description: 'Opioid receptors, opioid agonists and antagonists, analgesia, toxicity, and opioid use disorder.',
        notes: [
          autocoidsReference,
          note(autocoidsFolder, 'OPIODS NOV 2106.ppt', 'Opioids', 'Opioid pharmacology, analgesia, and safety.'),
        ],
      },
      {
        name: 'DMARDs and Biological Agents',
        description: 'Disease-modifying anti-rheumatic drugs, biological medicines, and targeted therapies.',
        notes: [
          autocoidsReference,
          note(autocoidsFolder, 'LECTURE 1,DMARD.ppt', 'Lecture 1: DMARDs', 'Disease-modifying anti-rheumatic drug pharmacology.'),
          note(autocoidsFolder, 'LECTURE 2 DMARDS.ppt', 'Lecture 2: DMARDs', 'DMARD pharmacology, continued.'),
          note(autocoidsFolder, 'LECTURE 4 MEDICINE ,BIOLOGICALS.ppt', 'Lecture 4: Biological Medicines', 'Biological agents in rheumatic disease.'),
        ],
      },
      {
        name: 'Migraine and Gout',
        description: 'Migraine pharmacotherapy and medicines used for acute gout and urate-lowering therapy.',
        notes: [
          autocoidsReference,
          note(autocoidsFolder, 'DRUGS FOR MIGRAINE.pptx', 'Drugs for Migraine', 'Pharmacological treatment of migraine.'),
          note(autocoidsFolder, '18.MIGRAINE,F.ppt', 'Migraine: Additional Lecture Notes', 'Additional migraine pharmacology notes.'),
          note(autocoidsFolder, 'ppb 313 antgout.ppt', 'Antigout Medicines', 'Gout pharmacotherapy.'),
        ],
      },
    ],
  },
];

function getMimeType(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case '.pdf':
      return 'application/pdf';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default:
      throw new Error(`Unsupported note format: ${filename}`);
  }
}

function isMissingObject(error: unknown): boolean {
  const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return awsError.$metadata?.httpStatusCode === 404 || awsError.name === 'NotFound' || awsError.name === 'NoSuchKey';
}

async function main() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 configuration is incomplete; no data was changed.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const s3 = new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });

  try {
    const course = await prisma.course.findUnique({
      where: { id: COURSE_ID },
      select: { id: true, title: true, createdById: true },
    });
    if (!course || course.title !== 'Pharmacology') throw new Error('Expected Pharmacology course was not found.');
    if (!course.createdById) throw new Error('Pharmacology course has no owner to attribute uploaded notes to.');

    const allNotes = new Map<string, Note>();
    for (const unit of UNITS) {
      for (const topic of unit.topics) {
        for (const item of topic.notes) allNotes.set(item.relativePath, item);
      }
    }

    const prepared = new Map<string, {
      note: Note;
      buffer: Buffer;
      hash: string;
      key: string;
      filename: string;
      mimetype: string;
      size: number;
      fileId?: string;
    }>();

    for (const item of allNotes.values()) {
      const absolutePath = path.join(SOURCE_ROOT, item.relativePath);
      const buffer = await fs.readFile(absolutePath);
      const hash = createHash('sha256').update(buffer).digest('hex');
      const filename = path.basename(item.relativePath);
      const existingFile = await prisma.file.findFirst({ where: { hash } });
      const key = existingFile?.key || `${R2_PREFIX}/${item.relativePath.replace(/\\/g, '/')}`;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      } catch (error) {
        if (!isMissingObject(error)) throw error;
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: getMimeType(filename),
          Metadata: { sha256: hash, source: 'course-notes-seed' },
        }));
      }
      prepared.set(item.relativePath, {
        note: item,
        buffer,
        hash,
        key,
        filename,
        mimetype: getMimeType(filename),
        size: buffer.length,
        fileId: existingFile?.id,
      });
    }

    const result = await prisma.$transaction(async tx => {
      const currentUnits = await tx.unit.findMany({
        where: { courseId: course.id },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, title: true, slug: true, order: true },
      });
      const targetTitles = new Set(UNITS.map(unit => unit.title));
      const existingTargets = currentUnits.filter(unit => targetTitles.has(unit.title || ''));
      const otherUnits = currentUnits.filter(unit => !existingTargets.some(target => target.id === unit.id));
      const temporaryOrder = Math.max(0, ...currentUnits.map(unit => unit.order)) + 100;

      for (const [index, unit] of [...existingTargets, ...otherUnits].entries()) {
        await tx.unit.update({ where: { id: unit.id }, data: { order: temporaryOrder + index } });
      }

      const unitIds = new Map<string, string>();
      for (const unitSpec of UNITS) {
        const existing = existingTargets.find(unit => unit.title === unitSpec.title);
        const unitData = {
          name: unitSpec.name,
          title: unitSpec.title,
          slug: unitSpec.slug,
          description: unitSpec.description,
          order: unitSpec.order,
          estimatedMinutes: unitSpec.estimatedMinutes,
          isPublished: true,
        };
        const unit = existing
          ? await tx.unit.update({ where: { id: existing.id }, data: unitData })
          : await tx.unit.create({ data: { ...unitData, courseId: course.id } });
        unitIds.set(unitSpec.title, unit.id);
      }

      for (const [index, unit] of otherUnits.entries()) {
        const order = unit.order === 1 ? 1 : unit.order + 2;
        await tx.unit.update({ where: { id: unit.id }, data: { order: Math.max(order, 1) } });
      }

      const topicIds = new Map<string, string>();
      for (const unitSpec of UNITS) {
        const unitId = unitIds.get(unitSpec.title)!;
        for (const [index, topicSpec] of unitSpec.topics.entries()) {
          const topic = await tx.topic.upsert({
            where: { unitId_order: { unitId, order: index + 1 } },
            update: { name: topicSpec.name, description: topicSpec.description },
            create: { unitId, order: index + 1, name: topicSpec.name, description: topicSpec.description },
            select: { id: true },
          });
          topicIds.set(`${unitSpec.title}\0${topicSpec.name}`, topic.id);
        }
      }

      const fileIds = new Map<string, string>();
      for (const [relativePath, item] of prepared) {
        const existing = item.fileId
          ? await tx.file.findUnique({ where: { id: item.fileId } })
          : await tx.file.findFirst({ where: { hash: item.hash } });
        const file = existing || await tx.file.create({
          data: {
            filename: item.filename,
            mimetype: item.mimetype,
            size: item.size,
            hash: item.hash,
            key: item.key,
            uploadedById: course.createdById,
          },
        });
        fileIds.set(relativePath, file.id);
      }

      let materialsCreated = 0;
      for (const unitSpec of UNITS) {
        const unitId = unitIds.get(unitSpec.title)!;
        for (const topicSpec of unitSpec.topics) {
          const topicId = topicIds.get(`${unitSpec.title}\0${topicSpec.name}`)!;
          for (const item of topicSpec.notes) {
            const fileId = fileIds.get(item.relativePath)!;
            const existing = await tx.material.findFirst({
              where: { fileId, courseId: course.id, unitId, topicId, title: item.title },
              select: { id: true },
            });
            if (existing) continue;
            const isPdf = item.relativePath.toLowerCase().endsWith('.pdf');
            await tx.material.create({
              data: {
                title: item.title,
                description: item.description,
                type: isPdf ? MaterialType.pdf : MaterialType.notes,
                fileId,
                courseId: course.id,
                unitId,
                topicId,
                userId: course.createdById,
                category: 'Lecture Notes',
                metadata: { sourcePath: item.relativePath, uploadedByCourseSeeder: true },
              },
            });
            materialsCreated += 1;
          }
        }
      }

      return {
        unitsCreated: UNITS.filter(unit => !existingTargets.some(existing => existing.title === unit.title)).length,
        unitsUpdated: existingTargets.length,
        topics: UNITS.reduce((count, unit) => count + unit.topics.length, 0),
        uniqueNotes: prepared.size,
        materialsCreated,
      };
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    s3.destroy();
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});