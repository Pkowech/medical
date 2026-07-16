import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/seed.ts',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
    // Read directly instead of via env<>() — the helper throws on missing
    // vars even for keys typed as optional, and SHADOW_DATABASE_URL is
    // legitimately unset in most environments (build stages, prod deploys).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});