/**
 * Seed script to register actual PDFs from seed-data directory into the database
 * Usage: npx ts-node scripts/seed-pdfs.ts
 */

import { PrismaClient, MaterialType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

const _seedPool = new Pool({ connectionString: process.env.DATABASE_URL });
const _seedAdapter = new PrismaPg(_seedPool);
const prisma = new PrismaClient({ adapter: _seedAdapter, log: ['query', 'info', 'warn', 'error'], });

interface PDFMetadata {
  filePath: string;
  filename: string;
  title: string;
  description: string;
  unitId?: string;
}

const PDFs: PDFMetadata[] = [
  {
    filePath: 'seed-data/pdfs/TEXTBOOK OF MEDICAL BIOCHEMISTRY 8TH EDITION 2012 PP894.pdf',
    filename: 'TEXTBOOK OF MEDICAL BIOCHEMISTRY 8TH EDITION 2012 PP894.pdf',
    title: 'Textbook of Medical Biochemistry 8th Edition',
    description: 'Comprehensive medical biochemistry textbook covering fundamental concepts and clinical applications.',
    unitId: undefined, // Will be assigned to appropriate unit
  },
  {
    filePath: 'seed-data/pdfs/MSQs_Biochemistry.pdf',
    filename: 'MSQs_Biochemistry.pdf',
    title: 'Medical Biochemistry Multiple-Choice Questions',
    description: 'Collection of multiple-choice questions for medical biochemistry assessment and practice.',
    unitId: undefined,
  },
  {
    filePath: 'seed-data/pdfs/MedicalBiochemistry.pdf',
    filename: 'MedicalBiochemistry.pdf',
    title: 'Medical Biochemistry Reference',
    description: 'Reference material for medical biochemistry concepts and principles.',
    unitId: undefined,
  },
  {
    filePath: 'seed-data/pdfs/Medical Biochemistry - An Illustrated Review ( PDFDrive ) (1) (1).pdf',
    filename: 'Medical Biochemistry - An Illustrated Review.pdf',
    title: 'Medical Biochemistry: An Illustrated Review',
    description: 'Illustrated guide to medical biochemistry with visual aids and practical examples.',
    unitId: undefined,
  },
  {
    filePath: '../kenya-national-medicines-formulary-2023-1st-edition.pdf',
    filename: 'kenya-national-medicines-formulary-2023-1st-edition.pdf',
    title: 'Kenya National Medicines Formulary 2023',
    description: 'Official formulary of medicines approved and used in Kenya with clinical guidance.',
    unitId: undefined,
  },
];

async function seedPDFs() {
  console.log('🌱 Starting PDF seeding...');

  try {
    // Find or create a default user for uploads
    let adminUser = await prisma.user.findFirst({
      where: {
        userRoles: {
          some: { role: { name: 'ADMIN' } },
        },
      },
    });

    if (!adminUser) {
      console.log('Creating default admin user for PDF uploads...');
      adminUser = await prisma.user.create({
        data: {
          id: 'admin-pdf-seeder',
          email: 'admin@pdfs.local',
          firstName: 'PDF',
          lastName: 'Seeder',
          password: 'password', // Placeholder password, consider hashing in real app
          isActive: true,
        },
      });
    }

    let successCount = 0;
    let skipCount = 0;

    for (const pdfMetadata of PDFs) {
      try {
        // Resolve the file path relative to the backend directory
        const basePath = path.resolve(__dirname, '..');
        const filePath = path.resolve(basePath, pdfMetadata.filePath);

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch {
          console.warn(`⚠️  PDF not found: ${filePath}`);
          continue;
        }

        // Read file and compute hash
        const fileBuffer = await fs.readFile(filePath);
        const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
        const fileSize = fileBuffer.length;

        // Check if file already registered
        const existingFile = await prisma.file.findFirst({
          where: { hash: fileHash },
        });

        if (existingFile) {
          console.log(`⏭️  Skipping (already registered): ${pdfMetadata.filename}`);
          skipCount++;
          continue;
        }

        // Create file record (local placeholder)
        const fileRecord = await prisma.file.create({
          data: {
            filename: pdfMetadata.filename,
            mimetype: 'application/pdf',
            size: fileSize,
            hash: fileHash,
            key: `local:pdf:${fileHash}`,
            uploadedById: adminUser.id,
          },
        });

        console.log(`✅ Created file record: ${pdfMetadata.filename}`);

        // Create material record
        const material = await prisma.material.create({
          data: {
            title: pdfMetadata.title,
            description: pdfMetadata.description,
            type: MaterialType.pdf,
            fileId: fileRecord.id,
            userId: adminUser.id,
            unitId: pdfMetadata.unitId || null,
          },
        });

        console.log(`✅ Registered material: ${material.title}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error processing ${pdfMetadata.filename}:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`\n📊 Seeding Summary:`);
    console.log(`   ✅ Successfully registered: ${successCount}`);
    console.log(`   ⏭️  Skipped (already registered): ${skipCount}`);
    console.log(`   ⚠️  Total attempted: ${PDFs.length}`);
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedPDFs().then(() => {
  console.log('✨ PDF seeding completed!');
  process.exit(0);
});