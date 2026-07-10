
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paths = await prisma.learningPath.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      createdBy: true
    }
  });
  console.log('Learning Paths:', JSON.stringify(paths, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
