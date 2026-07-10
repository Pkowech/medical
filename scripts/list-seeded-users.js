#!/usr/bin/env node
// Usage: cd backend && node -r dotenv/config ../scripts/list-seeded-users.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, firstName: true, lastName: true, username: true, isActive: true } });
    console.log(`Found ${users.length} users:\n`);
    users.forEach(u => {
      console.log(`${u.id} \t ${u.email} \t ${u.firstName || ''} ${u.lastName || ''} \t ${u.username || ''} \t active=${u.isActive}`);
    });
  } catch (err) {
    console.error('Error listing users:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
