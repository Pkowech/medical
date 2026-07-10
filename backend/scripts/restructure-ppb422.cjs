const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const _adapter = new PrismaPg(_pool);
  const prisma = new PrismaClient({ adapter: _adapter });

  console.log('🚀 Restructuring PPB 422 (Dermatology & Ocular Diseases)...');

  try {
    const userEmail = 'aaronrono427@gmail.com';
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.error(`❌ User ${userEmail} not found`);
      return;
    }

    const courseCode = 'PPB422';
    const courseTitle = 'PPB 422: Dermatology and Ocular Pharmacology';
    const courseDescription = 'Comprehensive study of dermatological and ocular diseases, focusing on their pathophysiology and pharmacological management as per the Kenyatta University syllabus.';

    let course = await prisma.course.findUnique({
      where: { code: courseCode },
    });

    if (course) {
      console.log(`📝 Updating course: ${courseCode}`);
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

    // Define Units (Modules) and their Topics
    const structure = [
      {
        unit: 'Module 1: Dermatological Foundations',
        description: 'Anatomy, physiology, and general principles of skin therapy.',
        order: 1,
        topics: [
          { name: 'Anatomy & Physiology of the Skin', order: 1, description: 'Understand the structure and function of skin and appendages.' },
          { name: 'Guidelines for Topical Therapy', order: 2, description: 'General principles of applying drugs to the skin.' },
          { name: 'Dermatological Agents', order: 3, description: 'Overview of drug classes used in dermatology.' },
        ]
      },
      {
        unit: 'Module 2: Clinical Dermatology',
        description: 'Management of common skin conditions.',
        order: 2,
        topics: [
          { name: 'Acne Management', order: 1, description: 'Pathogenesis and treatment of acne vulgaris.' },
          { name: 'Psoriasis Treatment', order: 2, description: 'Pathophysiology and drugs for psoriasis.' },
          { name: 'Sunlight Exposure & Drug Interactions', order: 3, description: 'Effects of UV radiation and related drug reactions.' },
          { name: 'Drug-induced Cutaneous Reactions', order: 4, description: 'Identifying and managing adverse skin reactions.' },
          { name: 'Antifungal Agents', order: 5, description: 'Pharmacology of drugs for fungal skin infections.' },
        ]
      },
      {
        unit: 'Module 3: Ocular Pharmacology',
        description: 'Diseases and drugs of the eye.',
        order: 3,
        topics: [
          { name: 'Conjunctivitis Management', order: 1, description: 'Types of conjunctivitis and their pharmacological treatment.' },
          { name: 'Glaucoma Pharmacology', order: 2, description: 'Pathogenesis and drug therapy for glaucoma.' },
        ]
      }
    ];

    // Clear existing units and topics for a clean setup (optional, but safer for restructuring)
    // await prisma.topic.deleteMany({ where: { unit: { courseId: course.id } } });
    // await prisma.unit.deleteMany({ where: { courseId: course.id } });

    for (const item of structure) {
      const unit = await prisma.unit.upsert({
        where: {
          courseId_order: {
            courseId: course.id,
            order: item.order,
          },
        },
        update: {
          name: item.unit,
          title: item.unit,
          description: item.description,
          isPublished: true,
        },
        create: {
          courseId: course.id,
          name: item.unit,
          title: item.unit,
          order: item.order,
          description: item.description,
          isPublished: true,
        },
      });
      console.log(`✅ Unit setup: ${unit.title}`);

      for (const topicData of item.topics) {
        const topic = await prisma.topic.upsert({
          where: {
            unitId_order: {
              unitId: unit.id,
              order: topicData.order,
            },
          },
          update: {
            name: topicData.name,
            description: topicData.description,
          },
          create: {
            unitId: unit.id,
            name: topicData.name,
            order: topicData.order,
            description: topicData.description,
          },
        });
        console.log(`  🔹 Topic setup: ${topic.name}`);
      }
    }

    // Enroll the user
    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      update: { status: 'active' },
      create: { userId: user.id, courseId: course.id, status: 'active' },
    });

    console.log('✅ PPB 422 restructuring complete!');
  } catch (error) {
    console.error('❌ Error during restructuring:', error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

main().catch(console.error);
