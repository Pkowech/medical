const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  console.log('🧹 Finalizing PPB 422 structure and linking materials...');

  try {
    const courseCode = 'PPB422';
    const course = await prisma.course.findUnique({
      where: { code: courseCode },
      include: {
        units: {
          include: { topics: true }
        }
      }
    });

    if (!course) {
      console.error('❌ Course not found');
      return;
    }

    // 1. Delete old units (orphans from previous session)
    const oldUnits = course.units.filter(u => u.order > 3 || u.order === 0);
    for (const u of oldUnits) {
       // If it's the "Prerequisites Review" (Order 0), we might want to keep it or merge it.
       // The user wanted "relevant youtube links" for prereqs.
       if (u.title.includes('Prerequisites')) continue; 
       
       console.log(`🗑️ Deleting old unit: ${u.title}`);
       await prisma.topic.deleteMany({ where: { unitId: u.id } });
       await prisma.material.updateMany({ where: { unitId: u.id }, data: { unitId: null, topicId: null } });
       await prisma.unit.delete({ where: { id: u.id } });
    }

    // 2. Fix Material Course IDs and link to Topics
    // We search for materials with "PPB 422" or "PPB 420" in title
    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { title: { contains: 'PPB 422', mode: 'insensitive' } },
          { title: { contains: 'PPB 420', mode: 'insensitive' } },
          { title: { contains: 'Prereq', mode: 'insensitive' } },
          { unitId: { in: course.units.map(u => u.id) } }
        ]
      }
    });

    console.log(`Processing ${materials.length} potential materials...`);

    const allTopics = course.units.flatMap(u => u.topics);

    for (const m of materials) {
      await prisma.material.update({
        where: { id: m.id },
        data: { courseId: course.id }
      });

      // Try to match topic
      const matchingTopic = allTopics.find(t => 
        m.title.toLowerCase().includes(t.name.toLowerCase()) ||
        t.name.toLowerCase().includes(m.title.replace(/PPB 422/i, '').trim())
      );

      if (matchingTopic) {
        await prisma.material.update({
          where: { id: m.id },
          data: { 
            unitId: matchingTopic.unitId,
            topicId: matchingTopic.id
          }
        });
        console.log(`✅ Linked [${m.title}] to topic [${matchingTopic.name}]`);
      } else {
        // If no topic match, put in first unit "General Resources"
        const generalUnit = course.units.find(u => u.title.includes('Foundations')) || course.units[0];
        await prisma.material.update({
          where: { id: m.id },
          data: { unitId: generalUnit.id }
        });
        console.log(`ℹ️ Material [${m.title}] moved to unit [${generalUnit.title}] (No topic match)`);
      }
    }

    console.log('✅ Structure finalized!');
  } catch (error) {
    console.error('❌ Error during final fix:', error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
