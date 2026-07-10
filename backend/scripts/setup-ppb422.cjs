const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  console.log('🚀 Starting PPB 422 (Dermatology & Ocular Diseases) Setup...');

  try {
    const userEmail = 'aaronrono427@gmail.com';
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.error(`❌ User ${userEmail} not found`);
      return;
    }

    // 1. Create or Update Course (Now 422)
    const courseCode = 'PPB422';
    const courseTitle = 'PPB 422: Pharmacology and Therapeutics IV (Dermatology & Ocular)';
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

    // 2. Add Prerequisites Review Unit
    const prereqUnit = await prisma.unit.upsert({
      where: {
        courseId_order: {
          courseId: course.id,
          order: 0,
        },
      },
      update: {
        name: 'Prerequisites Review (Anatomy, Pharmacology, Pathology)',
        title: 'Prerequisites Review',
        description: 'Foundation videos covering essential Anatomy, Physiology, Pharmacology, and Pathology prerequisites.',
        isPublished: true,
      },
      create: {
        courseId: course.id,
        name: 'Prerequisites Review (Anatomy, Pharmacology, Pathology)',
        title: 'Prerequisites Review',
        order: 0,
        description: 'Foundation videos covering essential Anatomy, Physiology, Pharmacology, and Pathology prerequisites.',
        isPublished: true,
      },
    });
    console.log(`✅ Prerequisites unit setup: ${prereqUnit.id}`);

    // 3. Add Prerequisite YouTube Videos
    const prereqVideos = [
      { title: 'Anatomical Orientation & Regional Terminology', id: 'gfC4t6iyFVc', category: 'Anatomy' },
      { title: 'Vision Physiology Introduction', id: 'kQjiO3tmk0w', category: 'Physiology' },
      { title: 'Integumentary System (Skin) Lecture', id: 'z5VnLz7vW5I', category: 'Anatomy' },
      { title: 'Pharmacokinetics Made Easy', id: 'NKV5iaUVBUI', category: 'Pharmacology' },
      { title: 'Pharmacodynamics Made Easy', id: '6p6vQp7X5Z0', category: 'Pharmacology' },
      { title: 'Introduction to Pharmacology', id: 'L2pD_I2Z7L0', category: 'Pharmacology' },
      { title: 'Autonomic Nervous System Review', id: 'jU9u1AtS0_w', category: 'Pharmacology' },
      { title: 'Inflammation Pathology', id: '1BpV6p8pXDg', category: 'Pathology' },
      { title: 'Hypoxia & Cellular Injury', id: 'JcGKDDvk5AQ', category: 'Pathology' },
      { title: 'Neoplasia Pathology', id: '4_f-8hZ0_58', category: 'Pathology' },
      { title: 'Cell Injury Introduction', id: 'h0VkXOWvE2I', category: 'Pathology' },
      { title: 'Vascular Events in Inflammation', id: 'LArxUakFsFs', category: 'Pathology' },
    ];

    for (const video of prereqVideos) {
      const materialTitle = `[Prereq] ${video.title}`;
      await prisma.material.upsert({
        where: { id: `prereq-${video.id}` },
        update: {
          title: materialTitle,
          content: `https://www.youtube.com/watch?v=${video.id}`,
          category: video.category,
        },
        create: {
          id: `prereq-${video.id}`,
          title: materialTitle,
          type: 'video',
          content: `https://www.youtube.com/watch?v=${video.id}`,
          courseId: course.id,
          unitId: prereqUnit.id,
          userId: user.id,
          category: video.category,
        },
      });
    }
    console.log(`🎬 Added ${prereqVideos.length} prerequisite videos.`);

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
      await prisma.learningGoal.upsert({
        where: {
          id: `goal-${courseCode}-w${week.order}`
        },
        update: {
          title: `Master ${week.name}`,
          description: week.outcomes,
        },
        create: {
          id: `goal-${courseCode}-w${week.order}`,
          userId: user.id,
          courseId: course.id,
          title: `Master ${week.name}`,
          description: week.outcomes,
          status: 'active',
          priority: 2,
          category: 'skill_mastery',
          targetDate: new Date(Date.now() + (week.order * 7 * 24 * 60 * 60 * 1000)),
        },
      });
    }

    // 4. Enroll the user in 422
    await prisma.courseEnrollment.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      update: { status: 'active' },
      create: {
        userId: user.id,
        courseId: course.id,
        status: 'active',
      },
    });

    // 5. Update Tags
    await prisma.course.update({
      where: { id: course.id },
      data: {
        tags: ['pharmacy', 'pharmacology', 'dermatology', 'ocular', 'therapeutics', 'ppb422'],
      },
    });

    console.log('✅ PPB 422 setup complete with prerequisite videos!');
  } catch (error) {
    console.error('❌ Error during setup:', error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
