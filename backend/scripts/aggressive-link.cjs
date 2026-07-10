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
    console.log(`🔗 Aggressive linking for course ${courseId}...`);

    const units = await prisma.unit.findMany({
      where: { courseId },
      include: { topics: true }
    });
    const allTopics = units.flatMap(u => u.topics);
    const prereqTopic = allTopics.find(t => t.name.toLowerCase().includes('prerequisite'));

    // 1. Link Materials
    const materials = await prisma.material.findMany({ where: { courseId } });
    for (const m of materials) {
      let matchedTopic = null;
      
      // Match by keyword
      if (m.title.toLowerCase().includes('acne')) matchedTopic = allTopics.find(t => t.name.toLowerCase().includes('acne'));
      else if (m.title.toLowerCase().includes('psoriasis')) matchedTopic = allTopics.find(t => t.name.toLowerCase().includes('psoriasis'));
      else if (m.title.toLowerCase().includes('ocular') || m.title.toLowerCase().includes('eye')) matchedTopic = allTopics.find(t => t.name.toLowerCase().includes('ocular') || t.name.toLowerCase().includes('conjunctivitis') || t.name.toLowerCase().includes('glaucoma'));
      else if (m.title.toLowerCase().includes('sun') || m.title.toLowerCase().includes('light')) matchedTopic = allTopics.find(t => t.name.toLowerCase().includes('sunlight'));
      else if (m.title.toLowerCase().includes('antifungal')) matchedTopic = allTopics.find(t => t.name.toLowerCase().includes('antifungal'));
      else if (m.title.toLowerCase().includes('topical')) matchedTopic = allTopics.find(t => t.name.toLowerCase().includes('topical'));
      else if (m.title.toLowerCase().includes('prereq') || m.title.toLowerCase().includes('review')) matchedTopic = prereqTopic;

      if (matchedTopic) {
        await prisma.material.update({
          where: { id: m.id },
          data: { unitId: matchedTopic.unitId, topicId: matchedTopic.id }
        });
        console.log(`✅ Linked Material [${m.title}] -> Topic [${matchedTopic.name}]`);
      } else {
        // Default to Module 1 or Prerequisites
        const targetTopic = prereqTopic || allTopics[0];
        await prisma.material.update({
          where: { id: m.id },
          data: { unitId: targetTopic.unitId, topicId: targetTopic.id }
        });
        console.log(`ℹ️ Material [${m.title}] -> Default Topic [${targetTopic.name}]`);
      }
    }

    // 2. Fix Learning Path (ensure user is enrolled)
    const userId = 'f811c28c-3247-4f7d-8917-69955ffba18a'; // Sarah Johnson from screenshot
    const pharmaPath = await prisma.learningPath.findFirst({
       where: { title: { contains: 'Pharmacology', mode: 'insensitive' } }
    });

    if (pharmaPath) {
      console.log(`📝 Enrolling user in Learning Path: ${pharmaPath.title}`);
      await prisma.learningPathProgress.upsert({
        where: { userId_learningPathId: { userId, learningPathId: pharmaPath.id } },
        update: { status: 'inProgress' },
        create: {
          userId,
          learningPathId: pharmaPath.id,
          status: 'inProgress',
          overallProgressPercentage: 0
        }
      });
      
      // Also update path structure to include PPB 422
      // ...
    } else {
      console.log('⚠️ No Pharmacology Learning Path found. Creating one...');
      const newPath = await prisma.learningPath.create({
        data: {
          title: 'Clinical Pharmacology Specialization',
          description: 'A comprehensive path through clinical pharmacology, including dermatology and ocular therapeutics.',
          difficulty: 'advanced',
          status: 'published',
          pathType: 'STANDARD_STUDY',
          pathStructure: {
            phases: [
              {
                id: 'phase-1',
                title: 'Foundations',
                modules: [
                   { id: 'mod-ppb422', title: 'Dermatology & Ocular', type: 'course', resourceId: courseId }
                ]
              }
            ]
          }
        }
      });
      await prisma.learningPathProgress.create({
        data: { userId, learningPathId: newPath.id, status: 'inProgress' }
      });
    }

    console.log('🏁 Aggressive fix complete!');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
