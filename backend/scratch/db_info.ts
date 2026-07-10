import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('--- COURSES ---');
    const courses = await prisma.course.findMany({
      select: { id: true, title: true, name: true, code: true, categoryId: true }
    });
    console.log(JSON.stringify(courses, null, 2));

    console.log('\n--- UNITS ---');
    const units = await prisma.unit.findMany({
      select: { id: true, name: true, title: true, order: true, courseId: true }
    });
    console.log(JSON.stringify(units, null, 2));

    console.log('\n--- COURSE CATEGORIES ---');
    const categories = await prisma.courseCategory.findMany({
      select: { id: true, name: true, slug: true }
    });
    console.log(JSON.stringify(categories, null, 2));

    console.log('\n--- TOPICS (LIMIT 10) ---');
    const topics = await prisma.topic.findMany({
      select: { id: true, name: true, unitId: true, order: true },
      take: 10
    });
    console.log(JSON.stringify(topics, null, 2));

    console.log('\n--- QUIZZES ---');
    const quizzes = await prisma.quiz.findMany({
      select: { id: true, title: true, unitId: true, topicId: true }
    });
    console.log(JSON.stringify(quizzes, null, 2));

    console.log('\n--- MATERIAL COUNT ---');
    const materialCount = await prisma.material.count();
    console.log('Total materials:', materialCount);

  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
