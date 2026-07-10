import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
  const courseCount = await prisma.course.count();
  console.log('Course count:', courseCount);
  
  const unitCount = await prisma.unit.count();
  console.log('Unit count:', unitCount);
  
  const materialCount = await prisma.material.count();
  console.log('Material count:', materialCount);

  const materials = await prisma.material.findMany({
    take: 5,
    select: { title: true, type: true, content: true }
  });
  console.log('Sample materials:', materials);

  } catch(e) { console.error(e); }
  finally { await prisma.$disconnect(); }
}

main();
