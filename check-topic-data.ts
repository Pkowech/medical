import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTopicData() {
  const courseId = '148d3c8c-5058-4440-ab76-a1f93cd30f6b';
  const unitId = '3933044d-0245-49e2-bdba-020651feeb2e';
  const topicId = '3933044d-0245-49e2-bdba-020651feeb2e';

  try {
    console.log('\n=== Checking Course ===');
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    console.log('Course:', course);

    console.log('\n=== Checking Unit ===');
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, title: true, courseId: true },
    });
    console.log('Unit:', unit);

    console.log('\n=== Checking Topic ===');
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, name: true, unitId: true },
    });
    console.log('Topic:', topic);

    console.log('\n=== Listing all topics in unit ===');
    const unitTopics = await prisma.topic.findMany({
      where: { unitId },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });
    console.log('Topics in unit:', unitTopics);

    console.log('\n=== Unit-Topic relationship ===');
    if (unit && unitTopics.length > 0) {
      console.log(`Unit "${unit.title}" (${unitId}) has ${unitTopics.length} topics`);
      unitTopics.forEach((t) => console.log(`  - ${t.name} (${t.id})`));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTopicData();
