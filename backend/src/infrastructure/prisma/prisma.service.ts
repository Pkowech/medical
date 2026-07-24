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
    const pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });
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
