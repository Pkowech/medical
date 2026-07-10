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
    const courseId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
    console.log(`🔗 Linking materials for course ${courseId}...`);

    // Get all materials for this course
    const materials = await prisma.material.findMany({
      where: { courseId }
    });

    console.log(`Found ${materials.length} materials.`);

    // Get all topics for this course
    const units = await prisma.unit.findMany({
      where: { courseId },
      include: { topics: true }
    });
    const allTopics = units.flatMap(u => u.topics);

    for (const m of materials) {
      console.log(`Processing material: ${m.title}`);
      
      // Try to match by title
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
        console.log(`  ✅ Linked to topic: ${matchingTopic.name}`);
      } else {
        // Fallback: If it's a prerequisite, link to Prerequisites Review
        if (m.title.toLowerCase().includes('prereq')) {
          const prereqTopic = allTopics.find(t => t.name.includes('Prerequisites'));
          if (prereqTopic) {
             await prisma.material.update({
              where: { id: m.id },
              data: { 
                unitId: prereqTopic.unitId,
                topicId: prereqTopic.id 
              }
            });
            console.log(`  ✅ Linked to Prerequisites topic.`);
          }
        }
      }
    }

    // Do the same for Quizzes
    const quizzes = await prisma.quiz.findMany({
      where: { unit: { courseId } }
    });
    console.log(`Found ${quizzes.length} quizzes.`);

    for (const q of quizzes) {
       const matchingTopic = allTopics.find(t => 
        q.title.toLowerCase().includes(t.name.toLowerCase()) ||
        t.name.toLowerCase().includes(q.title.replace(/Quiz/i, '').trim())
      );
      if (matchingTopic) {
        await prisma.quiz.update({
          where: { id: q.id },
          data: { 
            unitId: matchingTopic.unitId,
            topicId: matchingTopic.id 
          }
        });
        console.log(`  ✅ Linked quiz [${q.title}] to topic: ${matchingTopic.name}`);
      }
    }

    console.log('🏁 Linking complete!');

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
