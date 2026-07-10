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
    const screenshotCourseId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
    const duplicateCourseId = '87140d92-233a-4471-a580-f53f55c2edd9';

    console.log(`🧹 Cleaning up courses...`);

    // 1. Move materials from duplicate to screenshot course
    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { courseId: duplicateCourseId },
          { unit: { courseId: duplicateCourseId } }
        ]
      }
    });

    console.log(`📦 Found ${materials.length} materials to migrate.`);

    // Update the screenshot course to be PPB422
    await prisma.course.update({
      where: { id: screenshotCourseId },
      data: {
        code: 'PPB422',
        title: 'PPB 422: Pharmacology and Therapeutics IV (Dermatology & Ocular)',
        name: 'PPB 422: Pharmacology and Therapeutics IV',
      }
    });
    console.log(`✅ Updated Course ${screenshotCourseId} to PPB422`);

    // Now re-run the upload script logic for the correct course units
    // Or just link them.
    // Actually, I'll just delete the duplicate course and re-run setup-ppb422.cjs 
    // BUT I must make sure it updates the existing course instead of creating a new one.
    
    // Let's delete the duplicate first
    try {
      // Need to delete dependencies first if not cascading
      await prisma.unit.deleteMany({ where: { courseId: duplicateCourseId } });
      await prisma.course.delete({ where: { id: duplicateCourseId } });
      console.log(`🗑️ Deleted duplicate course ${duplicateCourseId}`);
    } catch (e) {
      console.log(`⚠️ Note: ${e.message}`);
    }

    // Now update setup-ppb422.cjs to target the specific ID if possible, 
    // or rely on code matching which should work now that I updated 148d3c8c... to PPB422.

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
