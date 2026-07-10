const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  try {
    const courseId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
    const units = await prisma.unit.findMany({
      where: { courseId },
      include: {
        topics: {
           include: {
              materials: true,
              quizzes: true
           }
        },
        materials: true,
        quizzes: true
      },
      orderBy: { order: 'asc' }
    });

    console.log(`Units for Course ${courseId}: ${units.length}`);
    for (const u of units) {
      console.log(`[${u.order}] ${u.title} (ID: ${u.id})`);
      console.log(`  Unit Materials: ${u.materials.length}`);
      console.log(`  Unit Quizzes: ${u.quizzes.length}`);
      for (const t of u.topics) {
        console.log(`  - TOPIC: ${t.name} (ID: ${t.id})`);
        console.log(`    Topic Materials: ${t.materials.length}`);
        console.log(`    Topic Quizzes: ${t.quizzes.length}`);
      }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
