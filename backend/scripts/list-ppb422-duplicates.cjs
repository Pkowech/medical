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
    const courses = await prisma.course.findMany({
      where: { code: 'PPB422' },
    });
    console.log(`Found ${courses.length} courses with code PPB422:`);
    courses.forEach(c => console.log(`- ${c.title} (ID: ${c.id})`));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
