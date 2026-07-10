const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  console.log('🚀 Starting Final PPB 420 Course Setup...');

  try {
    const userEmail = 'aaronrono427@gmail.com';
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.error(`❌ User ${userEmail} not found`);
      return;
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.id})`);

    // 1. Create or Update Course
    const courseCode = 'PPB420';
    const courseTitle = 'PPB 420: Pharmacology and Therapeutics IV';
    const courseDescription = 'Advanced pharmacology covering dermatology, ocular diseases, and specialized therapeutics as outlined in the PPB 422 syllabus.';

    let course = await prisma.course.findUnique({
      where: { code: courseCode },
    });

    if (course) {
      console.log(`📝 Updating existing course: ${courseCode}`);
      course = await prisma.course.update({
        where: { id: course.id },
        data: {
          title: courseTitle,
          name: courseTitle,
          description: courseDescription,
          status: 'published',
          difficulty: 'advanced',
        },
      });
    } else {
      console.log(`✨ Creating new course: ${courseCode}`);
      course = await prisma.course.create({
        data: {
          code: courseCode,
          title: courseTitle,
          name: courseTitle,
          description: courseDescription,
          status: 'published',
          difficulty: 'advanced',
          createdById: user.id,
        },
      });
    }

    // 2. Weekly Units from Course Outline
    const weeks = [
      { order: 1, name: 'Anatomy & Physiology of the Skin', outcomes: 'Understand anatomy and physiology of skin and appendages' },
      { order: 2, name: 'Guidelines for Topical Therapy', outcomes: 'Identify dermatological diseases/disorders' },
      { order: 3, name: 'Dermatological Agents', outcomes: 'Mechanisms of action, therapeutic uses, and toxicities' },
      { order: 4, name: 'Acne Management', outcomes: 'Causes, pathogenesis, and drugs for acne' },
      { order: 5, name: 'Sunlight Exposure & Drug Interactions', outcomes: 'Treatment of sunlight effects and drug interactions' },
      { order: 7, name: 'Psoriasis Treatment', outcomes: 'Pathophysiology and drugs used in psoriasis' },
      { order: 8, name: 'Drug-induced Cutaneous Reactions', outcomes: 'Types, presentation, and management' },
      { order: 9, name: 'Antifungal Agents', outcomes: 'Fungal skin infections and classes of antifungals' },
      { order: 10, name: 'Conjunctivitis Management', outcomes: 'Types and drugs for conjunctivitis' },
      { order: 12, name: 'Glaucoma Pharmacology', outcomes: 'Pathogenesis, pathophysiology, and drug therapy' },
    ];

    for (const week of weeks) {
      const unit = await prisma.unit.upsert({
        where: {
          courseId_order: {
            courseId: course.id,
            order: week.order,
          },
        },
        update: {
          name: week.name,
          title: week.name,
          description: week.outcomes,
          isPublished: true,
        },
        create: {
          courseId: course.id,
          name: week.name,
          title: week.name,
          order: week.order,
          description: week.outcomes,
          isPublished: true,
        },
      });
      console.log(`✅ Unit setup: Week ${week.order} - ${unit.title}`);

      // Create Learning Goals
      await prisma.learningGoal.create({
        data: {
          userId: user.id,
          courseId: course.id,
          title: `Master ${week.name}`,
          description: week.outcomes,
          status: 'active',
          priority: 2, // High priority
          category: 'skill_mastery',
          targetDate: new Date(Date.now() + (week.order * 7 * 24 * 60 * 60 * 1000)),
        },
      });
    }

    // 3. Create Schedule Events
    console.log('📅 Creating study schedule...');
    const baseDate = new Date();
    for (const week of weeks) {
      const studyDate = new Date(baseDate);
      studyDate.setDate(baseDate.getDate() + (week.order * 7));
      
      await prisma.scheduleEvent.create({
        data: {
          userId: user.id,
          title: `Study: ${week.name}`,
          description: `Review materials for ${week.name}`,
          date: new Date(studyDate.setHours(10, 0, 0, 0)),
          endDate: new Date(studyDate.setHours(12, 0, 0, 0)),
          type: 'study_session',
        },
      });
    }

    // 4. Enroll the user
    await prisma.courseEnrollment.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      update: {
        status: 'active',
      },
      create: {
        userId: user.id,
        courseId: course.id,
        status: 'active',
      },
    });

    console.log(`🎓 User enrolled in ${courseCode}`);

    // 5. Update Course Tags
    await prisma.course.update({
      where: { id: course.id },
      data: {
        tags: ['pharmacy', 'pharmacology', 'dermatology', 'ocular', 'therapeutics'],
      },
    });

    console.log('✅ PPB 420 setup complete!');
  } catch (error) {
    console.error('❌ Error during setup:', error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
