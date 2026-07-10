const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  try {
    const courseId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        units: {
          include: {
            materials: true,
          },
        },
      },
    });

    if (!course) {
      console.log(`❌ Course ${courseId} not found`);
      return;
    }

    console.log(`Course: ${course.title} (${course.code})`);
    for (const unit of course.units) {
      console.log(`  Unit: ${unit.title} (ID: ${unit.id}, Order: ${unit.order})`);
      console.log(`    Materials count: ${unit.materials.length}`);
      for (const mat of unit.materials) {
        console.log(`    - ${mat.title} (${mat.type})`);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
