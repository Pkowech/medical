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
    console.log('🔍 Searching for HMP and HMA courses in the database...');
    
    const courses = await prisma.course.findMany({
      where: {
        OR: [
          { code: { startsWith: 'HMP' } },
          { code: { startsWith: 'HMA' } }
        ]
      },
      select: {
        code: true,
        title: true
      },
      orderBy: { code: 'asc' }
    });

    if (courses.length === 0) {
      console.log('❌ No HMP or HMA courses found in the database.');
    } else {
      console.log(`✅ Found ${courses.length} potential prerequisites:`);
      courses.forEach(c => console.log(`- ${c.code}: ${c.title}`));
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
