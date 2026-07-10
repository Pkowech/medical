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
    const course = await prisma.course.findUnique({
      where: { code: 'PPB422' },
      include: {
        units: {
          orderBy: { order: 'asc' },
          include: {
            topics: {
              orderBy: { order: 'asc' },
              include: {
                materials: true
              }
            }
          }
        }
      }
    });

    if (!course) {
      console.log('Course PPB422 not found.');
      return;
    }

    console.log(`COURSE: ${course.title} (${course.id})`);
    course.units.forEach(u => {
      console.log(`  UNIT: ${u.title} (Order: ${u.order})`);
      u.topics.forEach(t => {
        console.log(`    TOPIC: ${t.name} (Order: ${t.order})`);
        t.materials.forEach(m => {
          console.log(`      MATERIAL: ${m.title} (${m.type})`);
        });
      });
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
