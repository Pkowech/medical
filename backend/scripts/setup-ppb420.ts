import { PrismaClient, MaterialType, CourseStatus, CourseDifficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting PPB 420 Course Setup...');

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
  const courseDescription = 'Advanced pharmacology covering dermatology, ocular diseases, and specialized therapeutics.';

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
        status: CourseStatus.published,
        difficulty: CourseDifficulty.advanced,
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
        status: CourseStatus.published,
        difficulty: CourseDifficulty.advanced,
        createdById: user.id,
      },
    });
  }

  // 2. Create Units
  const unitName = 'Dermatology and Ocular Diseases';
  const unit = await prisma.unit.upsert({
    where: {
      courseId_order: {
        courseId: course.id,
        order: 1,
      },
    },
    update: {
      name: unitName,
      title: unitName,
      isPublished: true,
    },
    create: {
      courseId: course.id,
      name: unitName,
      title: unitName,
      order: 1,
      isPublished: true,
    },
  });

  console.log(`✅ Unit setup: ${unit.title}`);

  // 3. Add YouTube Videos as Materials
  const youtubeVideos = [
    { title: 'Pharmacology - ACNE TREATMENTS (MADE EASY)', id: 'zxWh-7IC7HY', category: 'Dermatology' },
    { title: 'Dermatologic Pharmacology for PA Students', id: 'LLsOU5q3dsg', category: 'Dermatology' },
    { title: 'Eye Pharmacology Full Series', id: 'obQzM6u-uSA', category: 'Ocular' },
    { title: 'Glaucoma Pharmacology Review', id: 'OP0LR-r_Dtk', category: 'Ocular' },
  ];

  for (const video of youtubeVideos) {
    const materialTitle = `[Video] ${video.title}`;
    await prisma.material.upsert({
      where: {
        id: `vid-${video.id}`, // Custom ID for tracking if needed, or just use upsert logic
      },
      update: {
        title: materialTitle,
        content: `https://www.youtube.com/watch?v=${video.id}`,
        category: video.category,
      },
      create: {
        id: `vid-${video.id}`,
        title: materialTitle,
        type: MaterialType.video,
        content: `https://www.youtube.com/watch?v=${video.id}`,
        courseId: course.id,
        unitId: unit.id,
        userId: user.id,
        category: video.category,
      },
    });
    console.log(`🎬 Added video: ${video.title}`);
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

  console.log('✅ Course setup complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
