const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDermatologyUnit() {
  try {
    console.log('\n=== Finding Pharmacy Course ===');
    const pharmacyCourse = await prisma.course.findFirst({
      where: {
        OR: [
          { title: { contains: 'Pharmacy', mode: 'insensitive' } },
          { name: { contains: 'Pharmacy', mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, name: true },
    });

    if (!pharmacyCourse) {
      console.log('No pharmacy course found');
      return;
    }

    console.log(`Found course: ${pharmacyCourse.title || pharmacyCourse.name} (${pharmacyCourse.id})`);

    console.log('\n=== Listing all units in pharmacy course ===');
    const units = await prisma.unit.findMany({
      where: { courseId: pharmacyCourse.id },
      select: { id: true, title: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });

    console.log(`Found ${units.length} units:`);
    units.forEach((u) => {
      console.log(`  - ${u.title || u.name} (${u.id}) - order: ${u.order}`);
    });

    // Find dermatology unit
    const dermUnit = units.find(
      (u) =>
        (u.title || u.name).toLowerCase().includes('derma') ||
        (u.title || u.name).toLowerCase().includes('skin'),
    );

    if (!dermUnit) {
      console.log('\n❌ No dermatology unit found!');
      return;
    }

    console.log(`\n=== Dermatology Unit Details ===`);
    console.log(`Name: ${dermUnit.title || dermUnit.name}`);
    console.log(`ID: ${dermUnit.id}`);

    console.log('\n=== Topics in Dermatology Unit ===');
    const topics = await prisma.topic.findMany({
      where: { unitId: dermUnit.id },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });

    console.log(`Found ${topics.length} topics:`);
    topics.forEach((t) => {
      console.log(`  - ${t.name} (${t.id}) - order: ${t.order}`);
    });

    if (topics.length === 0) {
      console.log('❌ No topics in dermatology unit!');
      return;
    }

    // Check materials for first topic
    const firstTopic = topics[0];
    console.log(`\n=== Materials for first topic: ${firstTopic.name} ===`);
    const materials = await prisma.material.findMany({
      where: { topicId: firstTopic.id },
      select: { id: true, title: true, type: true },
    });

    console.log(`Found ${materials.length} materials:`);
    materials.forEach((m) => {
      console.log(`  - ${m.title} (${m.type})`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDermatologyUnit();
