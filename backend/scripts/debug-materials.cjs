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
    const materials = await prisma.material.findMany({
      select: { id: true, title: true, courseId: true, unitId: true, topicId: true }
    });
    console.log('--- MATERIALS ---');
    materials.forEach(m => console.log(`[${m.id}] ${m.title} (Course: ${m.courseId}, Unit: ${m.unitId}, Topic: ${m.topicId})`));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
