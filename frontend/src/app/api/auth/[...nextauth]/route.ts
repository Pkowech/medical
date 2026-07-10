import NextAuth from 'next-auth';
import { authOptions } from '@/features/auth/services/nextauth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
