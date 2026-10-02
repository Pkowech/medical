import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export function createSeedPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run a database seed.');
  }

  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');

  const pool = new Pool({
    connectionString: url.toString(),
    ssl:
      process.env.DATABASE_SSL === 'true' || sslMode === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  return {
    pool,
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
  };
}
