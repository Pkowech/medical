const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const courseCount = await prisma.course.count();
    console.log('Course count:', courseCount);
    
    const unitCount = await prisma.unit.count();
    console.log('Unit count:', unitCount);
    
    const materialCount = await prisma.material.count();
    console.log('Material count:', materialCount);

    if (courseCount > 0) {
      const courses = await prisma.course.findMany({
        take: 3,
        select: { id: true, code: true, title: true }
      });
      console.log('Sample courses:', courses);
    }

    if (materialCount > 0) {
      const materials = await prisma.material.findMany({
        take: 3,
        where: { content: { startsWith: 'file:///' } },
        select: { title: true, type: true, content: true }
      });
      console.log('Sample local materials:', materials);
    }

  } catch(e) { 
    console.error('Error:', e); 
  } finally { 
    await prisma.$disconnect(); 
  }
}

main();
