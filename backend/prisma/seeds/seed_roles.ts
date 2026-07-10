import 'dotenv/config';
import { PrismaClient, Permission } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const _seedPool = new Pool({ connectionString: process.env.DATABASE_URL });
const _seedAdapter = new PrismaPg(_seedPool);
const prisma = new PrismaClient({ adapter: _seedAdapter });

async function main() {
  console.log('Start seeding roles...');
  try {
    // Create Roles
    console.log('Creating admin role...');
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator role with full access',
        isSystem: true,
        hierarchyLevel: 100,
        color: '#FF0000',
        isActive: true,
      },
    });

    console.log('Creating student role...');
    const studentRole = await prisma.role.upsert({
      where: { name: 'student' },
      update: {},
      create: {
        name: 'student',
        description: 'Student role with access to learning materials',
        isSystem: true,
        hierarchyLevel: 10,
        color: '#0000FF',
        isActive: true,
      },
    });

    console.log('Creating moderator role...');
    const moderatorRole = await prisma.role.upsert({
      where: { name: 'moderator' },
      update: {},
      create: {
        name: 'moderator',
        description: 'Moderator role with community management access',
        isSystem: true,
        hierarchyLevel: 50,
        color: '#00FF00',
        isActive: true,
      },
    });

    console.log('Creating instructor role...');
    const instructorRole = await prisma.role.upsert({
      where: { name: 'instructor' },
      update: {},
      create: {
        name: 'instructor',
        description: 'Instructor role with course management access',
        isSystem: true,
        hierarchyLevel: 40,
        color: '#FFA500',
        isActive: true,
      },
    });

    console.log(`Created roles: ${adminRole.name}, ${studentRole.name}, ${moderatorRole.name}, ${instructorRole.name}`);
  } catch (error) {
    console.error('Error seeding roles:', error);
    throw error;
  }

  try {
    // Define Permissions
    const allPermissions = [
      'access_courses',
      'join_study_groups',
      'view_progress',
      'take_assessments',
      'view_personal_analytics',
      'manage_profile',
      'manage_students',
      'manage_study_groups',
      'moderate_content',
      'view_community_analytics',
      'create_content',
      'manage_courses',
      'view_analytics',
      'approve_content',
      'manage_assessments',
      'view_content_analytics',
      'manage_users',
      'manage_content',
      'manage_settings',
      'manage_roles',
      'manage_system',
      'view_audit_logs',
    ];

    const createdPermissions: { [key: string]: Permission } = {};
    for (const permName of allPermissions) {
      const [resource, action] = permName.includes('_')
        ? permName.split(/_(.*)/s).filter(Boolean) // Split on first underscore, keep both parts
        : ['general', permName]; // Default if no underscore

      const permission = await prisma.permission.upsert({
        where: { name: permName },
        update: {},
        create: {
          name: permName,
          description: `Permission to ${permName.replace(/_/g, ' ')}`,
          resource: resource,
          action: action,
        },
      });
      createdPermissions[permName] = permission;
    }

    // Update Roles with Permissions
    console.log('Assigning permissions to roles...');

    // Admin Role Permissions
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' }, include: { permissions: true } });
    if (adminRole) {
      // Delete existing permissions for admin role
      await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
      
      // Create new permissions
      await prisma.rolePermission.createMany({
        data: allPermissions.map(permName => ({
          roleId: adminRole.id,
          permissionId: createdPermissions[permName].id,
          assignedAt: new Date(),
        })),
      });
    }

    // Student Role Permissions
    const studentRole = await prisma.role.findUnique({ where: { name: 'student' }, include: { permissions: true } });
    if (studentRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: studentRole.id } });
      
      await prisma.rolePermission.createMany({
        data: [
          'access_courses',
          'join_study_groups',
          'view_progress',
          'take_assessments',
          'view_personal_analytics',
          'manage_profile',
        ].map(permName => ({
          roleId: studentRole.id,
          permissionId: createdPermissions[permName].id,
          assignedAt: new Date(),
        })),
      });
    }

    // Moderator Role Permissions
    const moderatorRole = await prisma.role.findUnique({ where: { name: 'moderator' }, include: { permissions: true } });
    if (moderatorRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: moderatorRole.id } });
      
      await prisma.rolePermission.createMany({
        data: [
          'manage_students',
          'access_courses',
          'manage_study_groups',
          'join_study_groups',
          'view_progress',
          'moderate_content',
          'view_community_analytics',
        ].map(permName => ({
          roleId: moderatorRole.id,
          permissionId: createdPermissions[permName].id,
          assignedAt: new Date(),
        })),
      });
    }

    // Instructor Role Permissions
    const instructorRole = await prisma.role.findUnique({ where: { name: 'instructor' }, include: { permissions: true } });
    if (instructorRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: instructorRole.id } });
      
      await prisma.rolePermission.createMany({
        data: [
          'create_content',
          'manage_courses',
          'view_analytics',
          'manage_students',
          'approve_content',
          'manage_assessments',
          'view_content_analytics',
        ].map(permName => ({
          roleId: instructorRole.id,
          permissionId: createdPermissions[permName].id,
          assignedAt: new Date(),
        })),
      });
    }

    console.log('Roles and permissions seeded successfully.');
  } catch (error) {
    console.error('Error seeding roles and permissions:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.warn('Error disconnecting prisma:', e);
    }
    try {
      await _seedPool.end();
    } catch (e) {
      console.warn('Error ending seed pool:', e);
    }
  });