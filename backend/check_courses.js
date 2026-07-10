
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCourses() {
  const count = await prisma.course.count();
  console.log('Total courses:', count);
  
  const courses = await prisma.course.findMany({
    select: { id: true, title: true, status: true, code: true }
  });
  console.log('Courses:', JSON.stringify(courses, null, 2));
}

checkCourses()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
