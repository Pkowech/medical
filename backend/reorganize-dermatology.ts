import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ReorganizationPlan {
  currentState: {
    courseId?: string;
    courseName?: string;
    dermUnit?: { id: string; name: string };
    ocularUnit?: { id: string; name: string };
    allTopics: Array<{ id: string; name: string; unitId: string }>;
  };
  targetState: {
    course: { name: string; title: string; code: string };
    units: Array<{ name: string; title: string; topics: string[] }>;
  };
}

async function checkCurrentState() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       DERMATOLOGY REORGANIZATION - CURRENT STATE           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Find if Pharmacology course exists
  let pharmacyCourse = await prisma.course.findFirst({
    where: {
      OR: [
        { title: { contains: 'Pharmacy', mode: 'insensitive' } },
        { name: { contains: 'Pharmacy', mode: 'insensitive' } },
      ],
    },
    include: { units: { select: { id: true, name: true, title: true, order: true } } },
  });

  console.log('📋 COURSES:');
  if (pharmacyCourse) {
    console.log(`  ✓ Found: "${pharmacyCourse.title || pharmacyCourse.name}" (${pharmacyCourse.id})`);
  } else {
    console.log('  ✗ No Pharmacology course found - will create one');
  }

  // Find all dermatology-related units
  console.log('\n🏢 UNITS:');
  const dermUnits = await prisma.unit.findMany({
    where: {
      OR: [
        { name: { contains: 'derma', mode: 'insensitive' } },
        { title: { contains: 'derma', mode: 'insensitive' } },
        { name: { contains: 'skin', mode: 'insensitive' } },
        { title: { contains: 'skin', mode: 'insensitive' } },
      ],
    },
    include: {
      course: { select: { name: true, title: true } },
      topics: { select: { id: true, name: true, order: true } },
    },
  });

  const ocularUnits = await prisma.unit.findMany({
    where: {
      OR: [
        { name: { contains: 'ocular', mode: 'insensitive' } },
        { title: { contains: 'ocular', mode: 'insensitive' } },
        { name: { contains: 'eye', mode: 'insensitive' } },
        { title: { contains: 'eye', mode: 'insensitive' } },
        { name: { contains: 'ophtha', mode: 'insensitive' } },
        { title: { contains: 'ophtha', mode: 'insensitive' } },
      ],
    },
    include: {
      course: { select: { name: true, title: true } },
      topics: { select: { id: true, name: true, order: true } },
    },
  });

  if (dermUnits.length > 0) {
    console.log(`  📌 Dermatology units (${dermUnits.length}):`);
    dermUnits.forEach((u) => {
      console.log(`     • ${u.title || u.name} (${u.id})`);
      console.log(`       Course: ${u.course.title || u.course.name}`);
      console.log(`       Topics: ${u.topics.length}`);
      u.topics.forEach((t) => console.log(`         - ${t.name}`));
    });
  } else {
    console.log('  ✗ No dermatology units found');
  }

  if (ocularUnits.length > 0) {
    console.log(`\n  📌 Ocular/Eye units (${ocularUnits.length}):`);
    ocularUnits.forEach((u) => {
      console.log(`     • ${u.title || u.name} (${u.id})`);
      console.log(`       Course: ${u.course.title || u.course.name}`);
      console.log(`       Topics: ${u.topics.length}`);
      u.topics.forEach((t) => console.log(`         - ${t.name}`));
    });
  } else {
    console.log('\n  ✗ No ocular/eye units found');
  }

  // Check for Acne topic
  console.log('\n🔍 TOPICS:');
  const acneTopic = await prisma.topic.findFirst({
    where: {
      name: { contains: 'acne', mode: 'insensitive' },
    },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          course: { select: { name: true, title: true } },
        },
      },
    },
  });

  if (acneTopic) {
    console.log(`  ✓ Found Acne topic: "${acneTopic.name}" (${acneTopic.id})`);
    console.log(`    Current location: ${acneTopic.unit.course.title || acneTopic.unit.course.name} > ${acneTopic.unit.name}`);
  } else {
    console.log('  ✗ No Acne topic found');
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TARGET STRUCTURE                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('📚 Course: Pharmacology');
  console.log('  ├── 🏢 Unit: Dermatology');
  console.log('  │   └── 📖 Topic: Acne');
  console.log('  │       └── Materials, Quizzes, Resources');
  console.log('  └── 🏢 Unit: Ocular Diseases');
  console.log('      └── 📖 Topics: (existing ocular topics)');
  console.log('          └── Materials, Quizzes, Resources\n');

  return {
    pharmacyCourse,
    dermUnits,
    ocularUnits,
    acneTopic,
  };
}

async function reorganizeData(
  pharmacyCourse: any,
  dermUnits: any[],
  ocularUnits: any[],
  acneTopic: any,
) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           REORGANIZATION PLAN & IMPLEMENTATION             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 1: Create or get Pharmacology course
  if (!pharmacyCourse) {
    console.log('✓ Creating Pharmacology course...');
    pharmacyCourse = await prisma.course.create({
      data: {
        name: 'Pharmacology',
        title: 'Pharmacology & Therapeutics',
        code: 'PHARM-001',
        description: 'Master course for pharmacology and therapeutic specialties',
        difficulty: 'intermediate',
        status: 'published',
      },
    });
    console.log(`  Created: ${pharmacyCourse.id}\n`);
  } else {
    console.log('✓ Pharmacology course already exists\n');
  }

  // Step 2: Handle Dermatology Units
  console.log('Processing Dermatology units...');

  if (dermUnits.length === 0) {
    console.log('  ✗ No existing dermatology units to migrate');
  } else {
    for (const dermUnit of dermUnits) {
      console.log(`  • Moving "${dermUnit.title || dermUnit.name}" to Pharmacology course...`);

      // Update the unit to belong to Pharmacology course
      await prisma.unit.update({
        where: { id: dermUnit.id },
        data: {
          courseId: pharmacyCourse.id,
          title: 'Dermatology',
          name: 'Dermatology',
          description: 'Study of skin diseases and disorders',
        },
      });
      console.log(`    ✓ Updated (${dermUnit.id})`);

      // Check for Acne topic within this unit
      if (acneTopic && acneTopic.unit.id === dermUnit.id) {
        console.log(`    • Found Acne topic in this unit - ensuring proper structure`);
        await prisma.topic.update({
          where: { id: acneTopic.id },
          data: {
            name: 'Acne Vulgaris and Related Disorders',
            order: 1,
          },
        });
        console.log(`      ✓ Updated Acne topic structure`);
      }
    }
  }

  // Step 3: Handle Ocular Units
  console.log('\nProcessing Ocular/Eye units...');

  if (ocularUnits.length === 0) {
    console.log('  • Creating new Ocular Diseases unit...');
    const ocularUnit = await prisma.unit.create({
      data: {
        name: 'Ocular Diseases',
        title: 'Ocular Diseases & Ophthalmology',
        description: 'Study of eye diseases and ophthalmological disorders',
        order: 2,
        courseId: pharmacyCourse.id,
        isPublished: false,
        estimatedMinutes: 0,
      },
    });
    console.log(`    ✓ Created: ${ocularUnit.id}\n`);
  } else {
    for (const ocularUnit of ocularUnits) {
      console.log(`  • Moving "${ocularUnit.title || ocularUnit.name}" to Pharmacology course...`);

      await prisma.unit.update({
        where: { id: ocularUnit.id },
        data: {
          courseId: pharmacyCourse.id,
          title: 'Ocular Diseases & Ophthalmology',
          name: 'Ocular Diseases',
          description: 'Study of eye diseases and ophthalmological disorders',
        },
      });
      console.log(`    ✓ Updated (${ocularUnit.id})`);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                  REORGANIZATION COMPLETE                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Final verification
  console.log('✓ Final structure verification:\n');
  const finalCourse = await prisma.course.findUnique({
    where: { id: pharmacyCourse.id },
    include: {
      units: {
        select: {
          id: true,
          name: true,
          title: true,
          order: true,
          topics: { select: { id: true, name: true, order: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  console.log(`📚 ${finalCourse?.title || finalCourse?.name}`);
  finalCourse?.units.forEach((unit) => {
    console.log(`  ├── 🏢 ${unit.title || unit.name} (Order: ${unit.order})`);
    unit.topics.forEach((topic) => {
      console.log(`  │   └── 📖 ${topic.name} (Order: ${topic.order})`);
    });
  });
}

async function main() {
  try {
    const state = await checkCurrentState();
    const shouldReorganize = process.argv.includes('--execute');

    if (shouldReorganize) {
      await reorganizeData(state.pharmacyCourse, state.dermUnits, state.ocularUnits, state.acneTopic);
    } else {
      console.log('\n💡 To execute reorganization, run with --execute flag:');
      console.log('   pnpm tsx reorganize-dermatology.ts --execute\n');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
