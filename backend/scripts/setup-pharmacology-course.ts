import 'dotenv/config';
import { PrismaClient, CourseStatus, CourseDifficulty } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const _setupPool = new Pool({ connectionString: process.env.DATABASE_URL });
const _setupAdapter = new PrismaPg(_setupPool);
const prisma = new PrismaClient({ adapter: _setupAdapter });

async function setupPharmacologyCourse() {
  try {
    console.log('🚀 Setting up Pharmacology Course\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Create or find default user
    let user = await prisma.user.findFirst({
      where: {
        email: {
          contains: '@',
        },
      },
    });

    if (!user) {
      console.log('Creating default user...');
      user = await prisma.user.create({
        data: {
          email: 'pharmacology@medical.edu',
          firstName: 'Pharmacy',
          lastName: 'Admin',
        },
      });
    }

    console.log(`✅ Using user: ${user.firstName} ${user.lastName}`);

    // Create or find Pharmacology course
    console.log('\n📚 Setting up Pharmacology course...');
    
    let pharmacologyCourse = await prisma.course.findFirst({
      where: {
        code: 'PHARM-001',
      },
    });

    if (!pharmacologyCourse) {
      console.log('Creating new Pharmacology course...');
      pharmacologyCourse = await prisma.course.create({
        data: {
          name: 'Pharmacology',
          title: 'Pharmacology',
          code: 'PHARM-001',
          description: 'Comprehensive study of drugs, their properties, effects, and clinical applications. Covers drug classifications, mechanisms of action, pharmacokinetics, and therapeutics.',
          difficulty: CourseDifficulty.intermediate,
          status: CourseStatus.published,
          createdById: user.id,
          tags: ['pharmacology', 'pharmacy', 'medical', 'therapeutics', 'drugs', 'clinical'],
          estimatedHours: 120,
        },
      });
      console.log('✅ Created Pharmacology course:', pharmacologyCourse.id);
    } else {
      console.log('✅ Found existing Pharmacology course:', pharmacologyCourse.id);
      // Update it to published status
      pharmacologyCourse = await prisma.course.update({
        where: { id: pharmacologyCourse.id },
        data: {
          status: CourseStatus.published,
        },
      });
    }

    // Enroll user in course
    console.log('\n🎓 Enrolling user in course...');
    await prisma.courseEnrollment.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: pharmacologyCourse.id,
        },
      },
      update: {
        status: 'active',
      },
      create: {
        userId: user.id,
        courseId: pharmacologyCourse.id,
        status: 'active',
      },
    });
    console.log('✅ User enrolled in Pharmacology course');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Pharmacology Course Setup Complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Course Details:');
    console.log(`  ID: ${pharmacologyCourse.id}`);
    console.log(`  Code: ${pharmacologyCourse.code}`);
    console.log(`  Title: ${pharmacologyCourse.title}`);
    console.log('\n📝 Ready to add units and materials!\n');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupPharmacologyCourse().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
