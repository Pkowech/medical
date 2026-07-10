import { PrismaClient, MaterialType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function testFileUpload() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  try {
    // Create a test user if not exists
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'hashed_password', // In production, this should be properly hashed
      },
    });

    // Create a file entry
    const file = await prisma.file.create({
      data: {
        filename: 'Kenya_National_Medicines_Formulary.pdf',
        mimetype: 'application/pdf',
        size: 15000000, // Example size in bytes
        uploadedById: user.id,
      },
    });

    // Create a material entry linked to the file
    const material = await prisma.material.create({
      data: {
        title: 'Kenya National Medicines Formulary',
        type: MaterialType.pdf,
        content:
          'Official formulary containing essential medicines and guidelines',
        fileId: file.id,
        userId: user.id,
        metadata: {
          version: '2025',
          language: 'en',
          publisher: 'Ministry of Health, Kenya',
        },
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      // Test script debug output – keep quiet in production runs

      console.log('File uploaded and material created successfully:');

      console.log(JSON.stringify(material, null, 2));
    }
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

testFileUpload().catch(console.error);
