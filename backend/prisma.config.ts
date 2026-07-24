import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

type Env = {
  DATABASE_URL: string;
  DIRECT_URL: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/seed.ts',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
    directUrl: env<Env>('DIRECT_URL'),
  },
});