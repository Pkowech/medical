const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const enrollments = await prisma.courseEnrollment.findMany();
  console.log('Enrollments:', enrollments);
  
  const courses = await prisma.course.findMany({ select: { id: true, title: true } });
  console.log('Courses count:', courses.length);
  
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log('Users:', users);
}

check().catch(console.error).finally(() => prisma.$disconnect());
