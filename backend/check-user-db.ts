
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'aaronrono427@gmail.com' },
        });

        if (user) {
            console.log(`User Found:`);
            console.log(`ID: ${user.id}`);
            console.log(`Email: ${user.email}`);
            console.log(`Username: ${user.username}`);
        } else {
            console.log('User aaronrono427@gmail.com NOT found in database.');
        }
    } catch (error) {
        console.error('Error fetching user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
