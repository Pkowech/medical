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
    const matId = '73099a0a-989c-49aa-b0b8-6c91c407dde1';
    const mat = await prisma.material.findUnique({
      where: { id: matId },
    });
    console.log(JSON.stringify(mat, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
