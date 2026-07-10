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
    const targetId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
    const otherId = '87140d92-233a-4471-a580-f53f55c2edd9';

    // 1. Rename the other one first to avoid collision
    await prisma.course.update({
      where: { id: otherId },
      data: { code: 'PPB422_DUPLICATE' }
    });
    console.log('Renamed duplicate code');

    // 2. Update the target to PPB422
    await prisma.course.update({
      where: { id: targetId },
      data: { 
        code: 'PPB422',
        title: 'PPB 422: Dermatology and Ocular Diseases'
      }
    });
    console.log('Updated target course code to PPB422');

  } catch (error) {
    console.error('Error during update:', error.message);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
