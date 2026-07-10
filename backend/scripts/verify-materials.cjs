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
      include: {
        units: {
          include: {
            materials: true,
          },
        },
      },
    });

    for (const course of courses) {
      console.log(`Course: ${course.title} (Code: ${course.code}, ID: ${course.id})`);
      for (const unit of course.units) {
        console.log(`  Unit: ${unit.title} (Order: ${unit.order}, ID: ${unit.id})`);
        for (const mat of unit.materials) {
          console.log(`    Material: ${mat.title} (Type: ${mat.type}, ID: ${mat.id})`);
        }
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
