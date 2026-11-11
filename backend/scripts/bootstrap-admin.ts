import 'dotenv/config';
import * as argon2 from 'argon2';
import { Prisma, RoleName, PrismaClient } from '@prisma/client';
import { createSeedPrisma } from '../prisma/seeds/seed-db';

export interface InitialAdminInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export async function bootstrapInitialAdmin(
  prisma: PrismaClient,
  input: InitialAdminInput,
): Promise<{ created: boolean; userId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || input.password.length < 16) {
    throw new Error(
      'A valid administrator email and a password of at least 16 characters are required.',
    );
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: RoleName.admin },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error(
      'The admin role is not initialized. Start the application in a private environment to initialize default roles, then retry.',
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });
  if (existingUser) {
    if (
      existingUser.userRoles.some(
        ({ role }) => role.name === RoleName.admin,
      )
    ) {
      return { created: false, userId: existingUser.id };
    }
    throw new Error(
      'The requested email already belongs to a non-admin user; refusing to elevate or modify that account.',
    );
  }

  const passwordHash = await argon2.hash(input.password);
  const user = await prisma.$transaction(
    async (tx) => {
      const existingAdminRole = await tx.userRole.findFirst({
        where: { roleId: adminRole.id },
        select: { id: true },
      });
      if (existingAdminRole) {
        throw new Error(
          'An administrator already exists; this command only creates the initial administrator.',
        );
      }

      return tx.user.create({
        data: {
          email,
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          password: passwordHash,
          isActive: true,
          userRoles: { create: { roleId: adminRole.id } },
          securitySettings: { create: { isEmailVerified: true } },
        },
        select: { id: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return { created: true, userId: user.id };
}

async function main(): Promise<void> {
  if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== 'true') {
    throw new Error(
      'Set ADMIN_BOOTSTRAP_CONFIRM=true to explicitly authorize initial administrator creation.',
    );
  }

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in the process environment.',
    );
  }

  const { pool, prisma } = createSeedPrisma();
  try {
    const result = await bootstrapInitialAdmin(prisma, {
      email,
      password,
      firstName: process.env.ADMIN_BOOTSTRAP_FIRST_NAME,
      lastName: process.env.ADMIN_BOOTSTRAP_LAST_NAME,
    });
    console.log(
      result.created
        ? `Initial administrator created with user ID ${result.userId}.`
        : `Administrator already exists with user ID ${result.userId}; no changes made.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Administrator bootstrap failed.',
    );
    process.exitCode = 1;
  });
}
