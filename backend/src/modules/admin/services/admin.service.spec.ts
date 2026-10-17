import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AdminCreateUserDto } from '../dto/admin-user.dto';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const createService = () => {
    const prisma = {
      user: {
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'role-1' }),
        update: jest.fn().mockResolvedValue({ id: 'role-1' }),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([{ id: 'permission-1', name: 'manage_users' }]),
      },
    };
    const service = new AdminService(
      prisma as unknown as PrismaService,
      {} as RedisService,
    );
    return { service, prisma };
  };

  it('hashes a created user password and stores the selected role and terms status', async () => {
    const { service, prisma } = createService();
    prisma.role.findUnique.mockResolvedValue({ id: 'role-student' });
    const input: AdminCreateUserDto = {
      email: 'student@example.com',
      password: 'temporary-password',
      role: 'student',
      acceptTerms: true,
      status: 'active',
    };

    await service.createUser(input);

    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData.password).not.toBe(input.password);
    expect(createData.password).toMatch(/^\$argon2/);
    expect(createData.userRoles).toEqual({ create: { roleId: 'role-student' } });
    expect(createData.securitySettings).toEqual({ create: { acceptTerms: true } });
    expect(prisma.user.create.mock.calls[0][0].select).not.toHaveProperty('password');
  });

  it('maps an admin user status and role change to database relations', async () => {
    const { service, prisma } = createService();
    prisma.role.findUnique.mockResolvedValue({ id: 'role-instructor' });

    await service.updateUser('user-1', {
      role: 'instructor',
      status: 'suspended',
    });

    const updateData = prisma.user.update.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      isActive: true,
      isLocked: true,
      userRoles: {
        deleteMany: {},
        create: { roleId: 'role-instructor' },
      },
    });
  });

  it('connects roles to existing permission records by name', async () => {
    const { service, prisma } = createService();

    await service.createRole({
      name: 'moderator',
      permissionNames: ['manage_users'],
    });

    expect(prisma.role.create.mock.calls[0][0].data.permissions).toEqual({
      create: [{ permission: { connect: { id: 'permission-1' } } }],
    });
  });

  it('rejects role permission names that do not exist', async () => {
    const { service, prisma } = createService();
    prisma.permission.findMany.mockResolvedValue([]);

    await expect(
      service.createRole({ name: 'moderator', permissionNames: ['missing_permission'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });
});
