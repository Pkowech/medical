import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  // Allow dynamic access to any model delegate (e.g., this.prisma.file)
  // This keeps existing code compiling while we iterate on stricter type fixes.
  [key: string]: any;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is required to initialize Prisma. Configure the managed Postgres connection string in the runtime environment.',
      );
    }

    const shouldUseSsl =
      process.env.DATABASE_SSL === 'true' ||
      new URL(connectionString).searchParams.get('sslmode') === 'require' ||
      new URL(connectionString).searchParams.get('ssl') === 'true';

    // pg receives TLS configuration through `ssl`; remove Prisma/libpq's
    // sslmode parameter so it does not override the explicit pool setting.
    const poolUrl = new URL(connectionString);
    poolUrl.searchParams.delete('sslmode');
    const poolConnectionString = poolUrl.toString();

    const poolConfig: ConstructorParameters<typeof Pool>[0] = {
      connectionString: poolConnectionString,
    };

    if (shouldUseSsl) {
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
    }

    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}

// Allow permissive accessors for dynamic model properties used throughout the
// codebase. This keeps TypeScript from complaining where the generated client
// may differ slightly from handwritten usages. Prefer updating the Prisma
// schema and regenerating the client for a permanent fix.
export type AnyPrisma = PrismaClient & { [key: string]: any };
