const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function createSeedPrisma() {
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

module.exports = { createSeedPrisma };
