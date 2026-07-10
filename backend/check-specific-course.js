const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSpecificCourse() {
  try {
    const courseId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
    const unitId1 = 'adb6f3c3-b7ad-4c36-a329-4aeea6695dc0';
    const unitId2 = '3933044d-0245-49e2-bdba-020651feeb2e';

    console.log('\n=== Course Details ===');
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, code: true },
    });
    console.log(JSON.stringify(course, null, 2));

    console.log('\n=== Unit 1 Details ===');
    const unit1 = await prisma.unit.findUnique({
      where: { id: unitId1 },
      select: { id: true, title: true, name: true, courseId: true },
    });
    console.log(JSON.stringify(unit1, null, 2));

    if (unit1) {
      console.log(`\n=== Topics in Unit 1 (${unitId1}) ===`);
      const topics1 = await prisma.topic.findMany({
        where: { unitId: unitId1 },
        select: { id: true, name: true, order: true },
      });
      console.log(`Found ${topics1.length} topics:`);
      topics1.forEach((t) => console.log(`  - ${t.name} (${t.id})`));

      if (topics1.length > 0) {
        console.log(`\n=== Materials for first topic ===`);
        const materials = await prisma.material.findMany({
          where: { topicId: topics1[0].id },
          select: { id: true, title: true, type: true, fileId: true },
          take: 5,
        });
        console.log(`Found ${materials.length} materials`);
        materials.forEach((m) => console.log(`  - ${m.title} (${m.type})`));
      }
    }

    console.log('\n=== Unit 2 Details ===');
    const unit2 = await prisma.unit.findUnique({
      where: { id: unitId2 },
      select: { id: true, title: true, name: true, courseId: true },
    });
    console.log(JSON.stringify(unit2, null, 2));

    if (unit2) {
      console.log(`\n=== Topics in Unit 2 (${unitId2}) ===`);
      const topics2 = await prisma.topic.findMany({
        where: { unitId: unitId2 },
        select: { id: true, name: true, order: true },
      });
      console.log(`Found ${topics2.length} topics:`);
      topics2.forEach((t) => console.log(`  - ${t.name} (${t.id})`));

      if (topics2.length > 0) {
        console.log(`\n=== Materials for first topic ===`);
        const materials = await prisma.material.findMany({
          where: { topicId: topics2[0].id },
          select: { id: true, title: true, type: true, fileId: true },
          take: 5,
        });
        console.log(`Found ${materials.length} materials`);
        materials.forEach((m) => console.log(`  - ${m.title} (${m.type})`));
      }
    }

    console.log('\n=== All courses with dermatology ===');
    const dermCourses = await prisma.course.findMany({
      where: {
        OR: [
          { title: { contains: 'derma', mode: 'insensitive' } },
          { code: { contains: 'PPB', mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, code: true },
      take: 5,
    });
    console.log(`Found ${dermCourses.length} courses:`);
    dermCourses.forEach((c) => console.log(`  - ${c.code}: ${c.title}`));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificCourse();
