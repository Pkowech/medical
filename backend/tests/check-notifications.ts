import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
const _adapter = new PrismaPg(_pool);
const prisma = new PrismaClient({ adapter: _adapter });

async function checkNotifications() {
  try {
    const user = await prisma.user.findUnique({
      where: { username: 'kerichomogul' },
      include: { notifications: { orderBy: { createdAt: 'desc' } } }
    });
    
    console.log('=== User Info ===');
    console.log('Email:', user?.email);
    console.log('ID:', user?.id);
    console.log('Username:', user?.username);
    
    console.log('\n=== Notifications ===');
    console.log('Notifications count:', user?.notifications?.length || 0);
    
    if (user?.notifications && user.notifications.length > 0) {
      console.log('\nNotifications:');
      user.notifications.forEach((notif, index) => {
        console.log(`\n${index + 1}. ${notif.message}`);
        console.log(`   ID: ${notif.id}`);
        console.log(`   Type: ${notif.type}`);
        console.log(`   Read: ${notif.read}`);
        console.log(`   Created: ${notif.createdAt}`);
      });
    } else {
      console.log('No notifications found for this user.');
    }
    
    // Also check total notifications in DB
    const totalNotifs = await prisma.notification.count();
    console.log(`\n=== Total Notifications in DB: ${totalNotifs} ===`);
    
    // Check sample notifications
    const sampleNotifs = await prisma.notification.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { username: true, email: true } } }
    });
    
    console.log('\n=== Sample Notifications (Latest 5) ===');
    sampleNotifs.forEach((notif, index) => {
      console.log(`${index + 1}. [${notif.user.username}] ${notif.message.substring(0, 50)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await _pool.end();
  }
}

checkNotifications();
