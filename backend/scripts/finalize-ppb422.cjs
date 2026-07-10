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
    const userId = 'f811c28c-3247-4f7d-8917-69955ffba18a'; // Sarah Johnson

    console.log('🚀 Finalizing PPB 422 (Take 4 - NO UPSERT ON NON-UNIQUE)...');

    // 1. Learning Path
    const pathTitle = 'Pharmacology & Therapeutics Specialization';
    let path = await prisma.learningPath.findFirst({ where: { title: pathTitle } });

    if (!path) {
      path = await prisma.learningPath.create({
        data: {
          title: pathTitle,
          description: 'Comprehensive pharmacology specialization.',
          difficulty: 'advanced',
          status: 'published',
          pathType: 'STANDARD_STUDY',
          category: 'Pharmacology',
          pathStructure: {
            phases: [
              {
                id: 'phase-1',
                title: 'Clinical Specialties',
                modules: [{ id: 'mod-ppb422', title: 'PPB 422: Dermatology & Ocular', type: 'course', resourceId: courseId }]
              }
            ]
          }
        }
      });
      console.log('✅ Learning Path created.');
    } else {
      await prisma.learningPath.update({
        where: { id: path.id },
        data: { status: 'published' }
      });
      console.log('✅ Learning Path updated.');
    }

    // 2. Enroll Sarah
    const structure = path.pathStructure;
    const phases = structure.phases || [];
    const pProg = phases.map(p => ({
      phaseId: p.id, title: p.title, status: 'notStarted', progressPercentage: 0, modulesCompleted: [], modules: p.modules.map(m => ({ id: m.id, status: 'notStarted' })), completed: false, currentModuleId: p.modules[0]?.id
    }));
    const mProg = phases.flatMap(p => p.modules.map(m => ({
      moduleId: m.id, phaseId: p.id, status: 'notStarted', progressPercentage: 0, timeSpentMinutes: 0, attempts: 0
    })));

    // For LearningPathProgress, we CAN use upsert because it has @@unique([userId, learningPathId])
    await prisma.learningPathProgress.upsert({
      where: { userId_learningPathId: { userId, learningPathId: path.id } },
      update: {
        status: 'inProgress',
        phaseProgress: pProg,
        moduleProgress: mProg
      },
      create: {
        userId,
        learningPathId: path.id,
        status: 'inProgress',
        overallProgressPercentage: 0,
        phaseProgress: pProg,
        moduleProgress: mProg,
        milestonesAchieved: [],
        totalTimeSpentMinutes: 0
      }
    });
    console.log('✅ Sarah enrolled.');

    // 3. Materials
    const topics = await prisma.topic.findMany({ where: { unit: { courseId } } });
    const res = { title: 'Glaucoma Pharmacology', url: 'https://www.youtube.com/watch?v=XWzZ8XG8Z8', match: 'Glaucoma' };
    const topic = topics.find(t => t.name.includes(res.match));
    if (topic) {
       await prisma.material.create({
         data: {
           title: res.title,
           content: res.url,
           type: 'video',
           unitId: topic.unitId,
           topicId: topic.id,
           userId: userId,
           metadata: { externalUrl: res.url, isExternal: true }
         }
       });
       console.log('✅ Glaucoma video added.');
    }

    console.log('🏁 SUCCESS!');

  } catch (e) {
    console.error('💥 FATAL ERROR:', e);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

run();
