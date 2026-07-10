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
    const course = await prisma.course.findUnique({
      where: { code: 'PPB420' },
      include: { units: { orderBy: { order: 'asc' } } },
    });

    if (!course) {
      console.log('❌ Course not found');
      return;
    }

    console.log(`Course: ${course.title} (ID: ${course.id})`);
    for (const unit of course.units) {
      console.log(`Unit ${unit.order}: ${unit.title} (ID: ${unit.id})`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
