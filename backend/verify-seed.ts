import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create a Postgres pool + Prisma adapter for running seeds directly with ts-node
const _seedPool = new Pool({ connectionString: process.env.DATABASE_URL });
const _seedAdapter = new PrismaPg(_seedPool);
const prisma = new PrismaClient({ adapter: _seedAdapter });

async function main() {
  try {
    const courseCount = await prisma.course.count();
    console.log('Course count:', courseCount);
    
    const unitCount = await prisma.unit.count();
    console.log('Unit count:', unitCount);
    
    const materialCount = await prisma.material.count();
    console.log('Material count:', materialCount);

    if (courseCount > 0) {
      const courses = await prisma.course.findMany({
        take: 3,
        select: { id: true, code: true, title: true }
      });
      console.log('Sample courses:', JSON.stringify(courses, null, 2));
    }

    if (materialCount > 0) {
      const materials = await prisma.material.findMany({
        take: 5,
        where: { 
            title: { contains: 'Anatomy', mode: 'insensitive' },
            content: { startsWith: 'https://' } // Look for R2 URLs which indicate success
        },
        select: { 
            title: true, 
            type: true, 
            content: true,
            file: { select: { key: true, filename: true } }
        }
      });
      console.log('Sample R2/Anatomy materials:', JSON.stringify(materials, null, 2));
    }

  } catch(e) { 
    console.error('Error:', e); 
  } finally { 
    await prisma.$disconnect(); 
  }
}

main();
