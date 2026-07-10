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
    const courses = await prisma.course.findMany({
      select: { id: true, name: true, title: true, code: true }
    });
    console.log('--- COURSES ---');
    courses.forEach(c => console.log(`[${c.code || 'NO CODE'}] ${c.title || c.name} (${c.id})`));

    const units = await prisma.unit.findMany({
      select: { id: true, name: true, courseId: true }
    });
    console.log('\n--- UNITS ---');
    units.forEach(u => console.log(`Unit: ${u.name} (CourseID: ${u.courseId})`));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
