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
    const pharmaCategoryId = '3dd658ff-b3f7-4d22-975e-06f0c1dc0a4c';
    const courseCode = 'PPB422';

    console.log('🚀 Starting PPB 422 Organization Fix...');

    // 1. Assign to Pharmacology category
    await prisma.course.update({
      where: { code: courseCode },
      data: { categoryId: pharmaCategoryId }
    });
    console.log('✅ Assigned course to Pharmacology category.');

    const course = await prisma.course.findUnique({
      where: { code: courseCode },
      include: {
        units: {
          include: {
            topics: true,
            quizzes: true,
            materials: true
          }
        }
      }
    });

    // 2. Identify modules and redundant units
    const modules = course.units.filter(u => u.title.startsWith('Module') || u.title.startsWith('Prerequisites'));
    const redundantUnits = course.units.filter(u => !u.title.startsWith('Module') && !u.title.startsWith('Prerequisites'));

    console.log(`Found ${modules.length} Modules and ${redundantUnits.length} Redundant Units.`);

    const allTopics = modules.flatMap(m => m.topics);

    for (const unit of redundantUnits) {
      console.log(`📦 Processing Redundant Unit: ${unit.title}`);

      // Find matching topic
      const matchingTopic = allTopics.find(t => 
        t.name.toLowerCase().includes(unit.title.toLowerCase()) ||
        unit.title.toLowerCase().includes(t.name.toLowerCase())
      );

      if (matchingTopic) {
        console.log(`  🔗 Found matching topic: ${matchingTopic.name}`);

        // Move Materials
        if (unit.materials.length > 0) {
          await prisma.material.updateMany({
            where: { unitId: unit.id },
            data: { 
              unitId: matchingTopic.unitId,
              topicId: matchingTopic.id 
            }
          });
          console.log(`    ✅ Moved ${unit.materials.length} materials.`);
        }

        // Move Quizzes
        if (unit.quizzes.length > 0) {
          await prisma.quiz.updateMany({
            where: { unitId: unit.id },
            data: { 
              unitId: matchingTopic.unitId,
              topicId: matchingTopic.id 
            }
          });
          console.log(`    ✅ Moved ${unit.quizzes.length} quizzes.`);
        }

        // Delete redundant unit
        await prisma.unit.delete({ where: { id: unit.id } });
        console.log(`    🗑️ Deleted redundant unit.`);
      } else {
        console.log(`  ⚠️ No matching topic found for unit: ${unit.title}. Moving to first module.`);
        const firstModule = modules[1] || modules[0]; // Module 1
        
        await prisma.material.updateMany({
          where: { unitId: unit.id },
          data: { unitId: firstModule.id }
        });
        
        await prisma.quiz.updateMany({
          where: { unitId: unit.id },
          data: { unitId: firstModule.id }
        });

        await prisma.unit.delete({ where: { id: unit.id } });
        console.log(`    🗑️ Deleted redundant unit after moving content to ${firstModule.title}.`);
      }
    }

    console.log('🏁 PPB 422 Organization Fix Complete!');

  } catch (e) {
    console.error('❌ Error during organization fix:', e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
