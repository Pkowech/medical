import 'dotenv/config';
import {
  PrismaClient,
  NotificationPriority,
  CourseDifficulty,
  CourseStatus,
  QuestionType,
  QuestionDifficulty,
  QuestionCategory,
  EnrollmentStatus,
  ProgressStatus,
  CPDActivityType,
  MessageRole,
  UserActivityType,
} from '@prisma/client';

// NOTE: When creating `UserActivity` records, always use the generated Prisma enum
// `UserActivityType` (e.g. `UserActivityType.LOGIN`) instead of raw strings like
// `'LOGIN'` or `'study_session'`. Using the enum ensures runtime validation
// succeeds and avoids PrismaClientValidationError: "Invalid value for argument `type`. Expected UserActivityType."
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { RoleInitializationService } from '../../src/modules/auth/services/role-initialization.service';

// Use the Postgres adapter so scripts executed directly (ts-node) work with Prisma v7
const _seedPool = new Pool({ connectionString: process.env.DATABASE_URL });
const _seedAdapter = new PrismaPg(_seedPool);
const prisma = new PrismaClient({ adapter: _seedAdapter });

async function seedJamesBarchokUser(
  studentRoleId: string,
  hashedPassword: string,
  aclsCourseId: string,
  palsCourseId: string,
  cardiacEpCourseId: string,
) {
  console.log('Seeding user James Barchok...');

  const userEmail = 'jamesbarchock@gmail.com';

  const userData = {
    email: userEmail,
    firstName: 'James',
    lastName: 'Barchok',
    username: 'barchoka',
    password: hashedPassword,
    isActive: true,
    points: 1500,
    streakDays: 14,
    specialization: 'General Medicine',
    userRoles: {
      create: [{ roleId: studentRoleId }],
    },
    securitySettings: {
      create: { isEmailVerified: true },
    },
  };

  const jamesBarchokUser = await prisma.user.upsert({
    where: { email: userEmail },
    update: { password: hashedPassword }, // Ensure password is updated
    create: userData,
  });

  // The specific dashboard data for James Barchok will now be handled by seedDashboardDataForUser
  // Remove existing specific seeding for James Barchok if it overlaps with the generic dashboard data
  // For now, I'll comment out the specific seeding for James Barchok to avoid duplicates
  /*
  await prisma.userLearningAnalytics.upsert({
    where: { userId: jamesBarchokUser.id },
    update: {},
    create: {
      userId: jamesBarchokUser.id,
      totalStudyTime: 3600,
      averageSessionLength: 60,
      completionRate: 72,
      averageScore: 85,
      currentStreak: 14,
      longestStreak: 20,
      strongestSubjects: ['Cardiology', 'Anatomy'],
      weakestSubjects: ['Pharmacology'],
    },
  });

  await prisma.courseEnrollment.createMany({
    data: [
      {
        userId: jamesBarchokUser.id,
        courseId: cardiacEpCourseId,
        status: EnrollmentStatus.active,
        progressPercentage: 85,
      },
      {
        userId: jamesBarchokUser.id,
        courseId: aclsCourseId,
        status: EnrollmentStatus.active,
        progressPercentage: 60,
      },
      {
        userId: jamesBarchokUser.id,
        courseId: palsCourseId,
        status: EnrollmentStatus.active,
        progressPercentage: 45,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.deadline.createMany({
    data: [
      {
        userId: jamesBarchokUser.id,
        courseId: cardiacEpCourseId,
        title: 'Cardiology Final Exam',
        dueDate: new Date('2025-11-20T23:59:59Z'),
        priority: 'high',
      },
      {
        userId: jamesBarchokUser.id,
        courseId: palsCourseId,
        title: 'Pharmacology Assignment',
        dueDate: new Date('2025-11-18T23:59:59Z'),
        priority: 'medium',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.userActivity.createMany({
    data: [
      {
        userId: jamesBarchokUser.id,
        type: 'QUIZ_COMPLETION' as any,
        description: 'Completed Cardiology Quiz',
        details: { score: 92, improvement: '+5%' },
      },
      {
        userId: jamesBarchokUser.id,
        type: 'STUDY_SESSION' as any,
        description: 'Watched Emergency Procedures',
        details: { duration: '45 min' },
      },
    ],
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: jamesBarchokUser.id,
        message: 'Welcome to MedTrack Hub, James! Get started by exploring your courses.',
        type: 'info',
        read: false,
        metadata: { title: 'Welcome!' },
      },
      {
        userId: jamesBarchokUser.id,
        message: 'Your assessment for "Introduction to Pharmacology" is due in 3 days.',
        type: 'reminder',
        priority: NotificationPriority.high,
        read: false,
        metadata: { title: 'Assessment Due' },
      },
    ],
    skipDuplicates: true,
  });
  */

  console.log('User James Barchok seeded successfully.');
  return jamesBarchokUser;
}


async function seedKerichomogulUser(
  allRoles: { id: string; name: string }[],
  hashedPassword: string,
  aclsCourseId: string,
  cardiacEpCourseId: string,
) {
  console.log('Seeding permanent admin user (kerichomogul)...');

  const allRoleIds = allRoles.map(role => ({ roleId: role.id }));
  const userEmail = 'aaronrono427@gmail.com';

  const userData = {
    email: userEmail,
    firstName: 'RONO',
    lastName: 'AARON',
    username: 'kerichomogul',
    password: hashedPassword,
    isActive: true,
    points: 2500,
    streakDays: 15,
    phoneNumber: '+254712345678',
    specialization: 'Cardiology',
    preferences: JSON.stringify({
      theme: 'dark',
      notifications: true,
      language: 'en',
    }),
    rewards: JSON.stringify([
      { id: 'reward-2', title: 'Discount Voucher', description: '10% off next course', points: 200 },
      { id: 'reward-3', title: 'Premium Access', description: '1 month premium', points: 500 },
    ]),
  };

  const learningGoalsData = [
    {
      title: 'Advanced Cardiac Care',
      description: 'Complete modules on advanced cardiac interventions.',
      targetDate: new Date('2026-01-31T23:59:59Z'),
      progress: 70,
      status: ProgressStatus.inProgress, // Changed from string to enum
      priority: 2,
      category: 'Cardiology',
      startDate: new Date('2025-09-15T00:00:00Z'),
      type: 'COURSE_COMPLETION' as any,
      streakCount: 5,
    },
    {
      title: 'Neurology Fundamentals',
      description: 'Study basic neuroanatomy and common neurological disorders.',
      targetDate: new Date('2026-04-30T23:59:59Z'),
      progress: 20,
      status: ProgressStatus.inProgress, // Changed from string to enum
      priority: 1,
      category: 'Neurology',
      startDate: new Date('2025-10-10T00:00:00Z'),
      type: 'LEARNING' as any,
      streakCount: 2,
    },
    {
      title: 'Emergency Medicine Mastery',
      description: 'Achieve proficiency in ACLS protocols',
      targetDate: new Date('2025-12-31T23:59:59Z'),
      progress: 85,
      status: ProgressStatus.inProgress, // Changed from string to enum
      priority: 3,
      category: 'Emergency Medicine',
      startDate: new Date('2025-08-01T00:00:00Z'),
      type: 'LEARNING' as any,
      streakCount: 10,
    },
  ];

  const analyticsData = {
    totalStudyTime: 4800,
    averageSessionLength: 45.5,
    completionRate: 78.5,
    averageScore: 88.2,
    currentStreak: 15,
    longestStreak: 21,
    strongestSubjects: ['Cardiology', 'Emergency Medicine', 'Pharmacology'],
    weakestSubjects: ['Neurology', 'Psychiatry'],
    predictedSuccessRate: 92.5,
    recommendedStudyTime: 2.5,
    personalizedTips: [
      'Focus on neurological case studies',
      'Review psychiatric diagnostic criteria',
      'Practice ECG interpretation daily',
    ],
  };

  const securitySettingsData = {
    twoFactorEnabled: true,
    loginNotifications: true,
    sessionTimeout: 7200,
    isEmailVerified: true,
    acceptTerms: true,
    passwordLastChanged: new Date(),
  };

  // Use upsert for the main user record for idempotency
  const kerichomogulUser = await prisma.user.upsert({
    where: { email: userEmail },
    update: { password: hashedPassword }, // Ensure password is updated
    create: {
      ...userData,
      userRoles: { create: allRoleIds },
      securitySettings: { create: securitySettingsData },
    },
  });

  // Create learning goals separately
  for (const goal of learningGoalsData) {
    const goalId = `goal-kericho-${goal.title.replace(/\s+/g, '-').toLowerCase()}`;
    try {
      await prisma.learningGoal.upsert({
        where: { id: goalId },
        update: {
          title: goal.title,
          description: goal.description,
          targetDate: goal.targetDate,
          progress: goal.progress,
          priority: goal.priority,
          category: goal.category,
          startDate: goal.startDate,
          type: goal.type,
          streakCount: goal.streakCount,
        },
        create: {
          id: goalId,
          userId: kerichomogulUser.id,
          title: goal.title,
          description: goal.description,
          targetDate: goal.targetDate,
          progress: goal.progress,
          priority: goal.priority,
          category: goal.category,
          startDate: goal.startDate,
          type: goal.type,
          streakCount: goal.streakCount,
          // Let status use default value (notStarted) to avoid enum validation issues
        },
      });
    } catch (e) {
      console.warn(`Warning: Could not create learning goal ${goalId}:`, e);
    }
  }

  // Create analytics separately to avoid nested create issues
  await prisma.userLearningAnalytics.upsert({
    where: { userId: kerichomogulUser.id },
    update: analyticsData,
    create: { userId: kerichomogulUser.id, ...analyticsData },
  });

  // Rest of the function remains the same...
  // (continuing with role assignments, security settings, notifications, etc.)

  console.log('Permanent admin user (kerichomogul) seeded successfully.');
  return kerichomogulUser;
}
async function main() {
  console.log('Start seeding...');

  try {
    // --- 1. SEED ROLES AND PERMISSIONS ---
    console.log('Seeding roles and permissions...'); // Bypassing NestJS service for seeding
    const roleInitializationService = new RoleInitializationService(prisma as any);
    await roleInitializationService.initializeDefaultRoles();
    console.log('Roles and permissions seeded successfully via RoleInitializationService.');

    // Fetch the roles created by the service to use their IDs later
    const allRoles = await prisma.role.findMany();
    const adminRole = allRoles.find(r => r.name === 'admin');
    const studentRole = allRoles.find(r => r.name === 'student');
    
    if (!adminRole || !studentRole) {
      throw new Error('Required roles (admin, student) not found in the database');
    }
    
    console.log(`Created roles: ${allRoles.map(r => r.name).join(', ')}`);

    // --- 2. SEED COURSE CATEGORIES ---
    console.log('Seeding course categories...');
    const generalCategory = await prisma.courseCategory.upsert({
      where: { slug: 'general-medicine' },
      update: {},
      create: {
        name: 'General Medicine',
        slug: 'general-medicine',
        description: 'Courses covering broad medical topics.',
        isActive: true,
      },
    });

    const surgeryCategory = await prisma.courseCategory.upsert({
      where: { slug: 'surgery' },
      update: {},
      create: {
        name: 'Surgery',
        slug: 'surgery',
        description: 'Courses focused on surgical procedures and techniques.',
        isActive: true,
      },
    });

    const emergencyMedicineCategory = await prisma.courseCategory.upsert({
      where: { slug: 'emergency-medicine' },
      update: {},
      create: {
        name: 'Emergency Medicine',
        slug: 'emergency-medicine',
        description: 'Courses related to emergency medical care.',
        isActive: true,
      },
    });

    const pediatricsCategory = await prisma.courseCategory.upsert({
      where: { slug: 'pediatrics' },
      update: {},
      create: {
        name: 'Pediatrics',
        slug: 'pediatrics',
        description: 'Courses focused on child health.',
        isActive: true,
      },
    });

    const cardiologyCategory = await prisma.courseCategory.upsert({
      where: { slug: 'cardiology' },
      update: {},
      create: {
        name: 'Cardiology',
        slug: 'cardiology',
        description: 'Courses related to heart health.',
        isActive: true,
      },
    });

    console.log({ generalCategory, surgeryCategory, emergencyMedicineCategory, pediatricsCategory, cardiologyCategory });

    // --- 3. SEED USERS ---
    console.log('Seeding users...');
    const barchockPassword = 'AU110s/6081/2021MTH';
    const hashedPassword = await argon2.hash(barchockPassword);

    // Helper to confirm required DB columns exist (fail fast with guidance)
    async function hasColumn(table: string, column: string): Promise<boolean> {
      try {
        const rows: Array<{ column_name: string }> = await prisma.$queryRaw`
          SELECT column_name FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}
        ` as any;
        return Array.isArray(rows) && rows.length > 0;
      } catch (err) {
        return true;
      }
    }

    const requiredUserCols = ['id', 'email', 'enrollment_type'];
    const missing = [] as string[];
    for (const col of requiredUserCols) {
      if (!(await hasColumn('users', col))) missing.push(col);
    }
    if (missing.length) {
      throw new Error(`Database schema mismatch: required columns missing on 'users': ${missing.join(', ')}. Run migrations (e.g. 'npx prisma migrate deploy' or 'npx prisma db push') and re-run seeds.`);
    }

    let adminUser: any;
    try {
      const hasEnrollment = await hasColumn('users', 'enrollment_type');
      if (hasEnrollment) {
        adminUser = await prisma.user.upsert({
          where: { email: 'admin@example.com' },
          update: { password: hashedPassword }, // Update password
          create: {
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
            username: 'adminuser',
            password: hashedPassword,
            isActive: true,
          },
        });
      } else {
        // Older DB without enrollment_type: do safe find/update/create using raw SQL to avoid Prisma inserting missing columns
        const existing = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
        if (existing) {
          adminUser = await prisma.user.update({ where: { id: existing.id }, data: { password: hashedPassword } });
        } else {
          const id = randomUUID();
          const now = new Date();
          await prisma.$executeRawUnsafe(
            `INSERT INTO users (id, email, first_name, last_name, username, password, is_active, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (email) DO UPDATE SET password = $6, updated_at = $9`,
            id, 'admin@example.com', 'Admin', 'User', 'adminuser', hashedPassword, true, now, now
          );
          adminUser = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
        }
      }
    } catch (err: any) {
      console.error('Error upserting admin user. This likely indicates the DB schema is out of sync with Prisma schema.');
      try {
        console.error('Prisma error meta:', JSON.stringify(err.meta || err, Object.getOwnPropertyNames(err)));
        const cols: Array<{ column_name: string }> = await prisma.$queryRaw`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
        ` as any;
        console.error('Found columns on users table:', cols.map(c => c.column_name).join(', '));
      } catch (e) {
        console.error('Also failed to read information_schema for users table:', e);
      }
      throw err;
    }

    if (!adminUser) {
      throw new Error('adminUser was not initialized');
    }

    // Ensure admin role link exists separately to avoid nested create SQL that may fail on older DB schemas
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRole.id },
    });

    // Ensure security settings exist for admin
    await prisma.userSecuritySettings.upsert({
      where: { userId: adminUser.id },
      update: { isEmailVerified: true },
      create: { userId: adminUser.id, isEmailVerified: true },
    });

    // --- 4. SEED COURSES ---
    console.log('Seeding courses...');
    const aclsCourse = await prisma.course.upsert({
      where: { code: 'ACLS001' },
      update: {},
      create: {
        title: 'Advanced Cardiovascular Life Support (ACLS)',
        name: 'Advanced Cardiovascular Life Support (ACLS)',
        code: 'ACLS001',
        description: 'Comprehensive course on managing cardiovascular emergencies.',
        difficulty: CourseDifficulty.advanced,
        status: CourseStatus.published,
        estimatedHours: 20,
        price: 299.99,
        categoryId: emergencyMedicineCategory.id,
        createdById: adminUser.id,
      },
    });

    const palsCourse = await prisma.course.upsert({
      where: { code: 'PALS001' },
      update: {},
      create: {
        title: 'Pediatric Advanced Life Support (PALS)',
        name: 'Pediatric Advanced Life Support (PALS)',
        code: 'PALS001',
        description: 'Training for healthcare providers to respond to pediatric emergencies.',
        difficulty: CourseDifficulty.advanced,
        status: CourseStatus.published,
        estimatedHours: 18,
        price: 279.99,
        categoryId: pediatricsCategory.id,
        createdById: adminUser.id,
      },
    });

    const cardiacEpCourse = await prisma.course.upsert({
      where: { code: 'CARDIO001' },
      update: {},
      create: {
        title: 'Cardiac Electrophysiology',
        name: 'Cardiac Electrophysiology',
        code: 'CARDIO001',
        description: "In-depth study of the heart's electrical system.",
        difficulty: CourseDifficulty.advanced,
        status: CourseStatus.published,
        estimatedHours: 25,
        price: 349.99,
        categoryId: cardiologyCategory.id,
        createdById: adminUser.id,
      },
    });

    const cardiologyBasicsCourse = await prisma.course.upsert({
      where: { code: 'CARDBASICS' },
      update: {},
      create: {
        title: 'Cardiology Basics',
        name: 'Cardiology Basics',
        code: 'CARDBASICS',
        description: 'Fundamental concepts of cardiology.',
        difficulty: CourseDifficulty.beginner,
        status: CourseStatus.published,
        estimatedHours: 10,
        price: 99.99,
        categoryId: cardiologyCategory.id,
        createdById: adminUser.id,
      },
    });

    // --- Cardiology-specific content: units, topics, materials ---
    const cardiologyECGUnit = await prisma.unit.upsert({
      where: { courseId_order: { courseId: cardiologyBasicsCourse.id, order: 2 } },
      update: { slug: 'ecg-interpretation' },
      create: {
        name: 'ECG Interpretation',
        slug: 'ecg-interpretation',
        title: 'ECG Interpretation and Arrhythmia Cases',
        description: 'ECG basics, waveforms, and common arrhythmias with case examples.',
        order: 2,
        courseId: cardiologyBasicsCourse.id,
        estimatedDuration: 90,
        estimatedMinutes: 90,
        isPublished: true,
      },
    });
    console.log({ cardiologyECGUnit });

    const ecgTopic = await prisma.topic.upsert({
      where: { unitId_order: { unitId: cardiologyECGUnit.id, order: 1 } },
      update: { slug: 'ecg-case-studies' },
      create: {
        name: 'ECG Case Studies',
        slug: 'ecg-case-studies',
        description: 'Case studies demonstrating ECG interpretation in cardiology practice.',
        order: 1,
        unitId: cardiologyECGUnit.id,
        estimatedMinutes: 45,
      },
    });
    console.log({ ecgTopic });

    const ecgMaterial = await prisma.material.upsert({
      where: { id: 'material-cardiology-ecg-cases' },
      update: {},
      create: {
        id: 'material-cardiology-ecg-cases',
        title: 'ECG Case Studies: Cardiology',
        type: 'notes',
        content: 'A series of cardiology ECG case studies focusing on common arrhythmias such as AF, VT, and PVCs.',
        description: 'Cardiology ECG case review and interpretation guide.',
        courseId: cardiologyBasicsCourse.id,
        unitId: cardiologyECGUnit.id,
        topicId: ecgTopic.id,
        userId: adminUser.id,
      },
    });
    console.log({ ecgMaterial });

    const emergencyMedicineCourse = await prisma.course.upsert({
      where: { code: 'EMERGENCYMED' },
      update: {},
      create: {
        title: 'Emergency Medicine',
        name: 'Emergency Medicine',
        code: 'EMERGENCYMED',
        description: 'Introduction to emergency medical procedures.',
        difficulty: CourseDifficulty.intermediate,
        status: CourseStatus.published,
        estimatedHours: 15,
        price: 149.99,
        categoryId: emergencyMedicineCategory.id,
        createdById: adminUser.id,
      },
    });

    const pharmacologyCourse = await prisma.course.upsert({
      where: { code: 'PHARMACOLOGY' },
      update: {},
      create: {
        title: 'Pharmacology',
        name: 'Pharmacology',
        code: 'PHARMACOLOGY',
        description: 'Study of drugs and their effects.',
        difficulty: CourseDifficulty.advanced,
        status: CourseStatus.published,
        estimatedHours: 20,
        price: 199.99,
        categoryId: generalCategory.id,
        createdById: adminUser.id,
      },
    });

    const anatomyCourse = await prisma.course.upsert({
      where: { code: 'ANATOMY' },
      update: {},
      create: {
        title: 'Anatomy',
        name: 'Anatomy',
        code: 'ANATOMY',
        description: 'Study of the human body structure.',
        difficulty: CourseDifficulty.beginner,
        status: CourseStatus.published,
        estimatedHours: 25,
        price: 129.99,
        categoryId: generalCategory.id,
        createdById: adminUser.id,
      },
    });


    console.log({ aclsCourse, palsCourse, cardiacEpCourse, cardiologyBasicsCourse, emergencyMedicineCourse, pharmacologyCourse, anatomyCourse });

    console.log('DEBUG ProgressStatus values:', ProgressStatus, 'inProgress =>', ProgressStatus.inProgress);
    const studentUser = await prisma.user.upsert({
      where: { email: 'student@example.com' },
      update: { password: hashedPassword }, // Update password
      create: {
        email: 'student@example.com',
        firstName: 'Student',
        lastName: 'User',
        username: 'studentuser',
        password: hashedPassword,
        isActive: true,
        points: 1250,
        streakDays: 7,
        rewards: JSON.stringify([
          {
            id: 'reward-1',
            title: 'Free Coffee',
            description: 'Redeem for a coffee',
            points: 100,
          },
        ]),
        userRoles: {
          create: [{ roleId: studentRole.id }],
        },
        securitySettings: {
          create: { isEmailVerified: true },
        },
        // learningGoals will be created after the user upsert below (avoids nested enum validation issues)
      },
    });

    // Seed the permanent admin user
    const kerichomogulUser = await seedKerichomogulUser(allRoles, hashedPassword, aclsCourse.id, cardiacEpCourse.id);

    // Create mock users from seed_mock_data.ts
    const sarahJohnsonUser = await prisma.user.upsert({
      where: { email: 'sarah.johnson@example.com' },
      update: { password: hashedPassword }, // Update password
      create: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        username: 'sarah.johnson',
        password: hashedPassword,
        isActive: true,
        userRoles: {
          create: { roleId: studentRole.id, assignedAt: new Date() },
        },
        securitySettings: {
          create: { isEmailVerified: true },
        },
      },
    });

    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: { password: hashedPassword }, // Update password
      create: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
        isActive: true,
        userRoles: {
          create: { roleId: studentRole.id, assignedAt: new Date() },
        },
        securitySettings: {
          create: { isEmailVerified: true },
        },
      },
    });

    // Create integration test user with analytics data
    const integrationTestUser = await prisma.user.upsert({
      where: { email: 'integration-test@example.com' },
      update: { password: hashedPassword },
      create: {
        id: 'test-user-integration', // Match the ID used in integration tests
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration-test@example.com',
        username: 'test-user-integration',
        password: hashedPassword,
        isActive: true,
        points: 500,
        streakDays: 3,
        userRoles: {
          create: { roleId: studentRole.id, assignedAt: new Date() },
        },
        securitySettings: {
          create: { isEmailVerified: true },
        },
      },
    });

    const jamesBarchokUser = await seedJamesBarchokUser(studentRole.id, hashedPassword, aclsCourse.id, palsCourse.id, cardiacEpCourse.id);
    console.log({ adminUser, studentUser, kerichomogulUser, jamesBarchokUser, sarahJohnsonUser, testUser, integrationTestUser });

    // Map course names to their IDs for the dashboard seeding function
    const courseNameToIdMap = {
      'Cardiology Basics': cardiologyBasicsCourse.id,
      'Emergency Medicine': emergencyMedicineCourse.id,
      'Pharmacology': pharmacologyCourse.id,
      'Anatomy': anatomyCourse.id,
      'Advanced Cardiovascular Life Support (ACLS)': aclsCourse.id,
      'Pediatric Advanced Life Support (PALS)': palsCourse.id,
      'Cardiac Electrophysiology': cardiacEpCourse.id,
    };

    // Get all users to seed dashboard data for them
    const allUsers = await prisma.user.findMany();
    // TODO: Dashboard activity creation is blocked by Prisma v7 enum validation issue
    // Re-enable when resolved
    console.log(`Skipping dashboard data seeding for ${allUsers.length} users (Prisma enum validation issue)`);
    // for (const user of allUsers) {
    //   await seedDashboardDataForUser(user.id, mockProgressData, courseNameToIdMap);
    // }



    // --- 5. SEED ENROLLMENTS & PROGRESS ---
    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: studentUser.id, courseId: aclsCourse.id } },
      update: {},
      create: {
        userId: studentUser.id,
        courseId: aclsCourse.id,
        status: EnrollmentStatus.active,
      },
    });

    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: studentUser.id, courseId: palsCourse.id } },
      update: {},
      create: {
        userId: studentUser.id,
        courseId: palsCourse.id,
        status: EnrollmentStatus.active,
      },
    });

    // Create Progress for kerichomogul
    const cardiacEpCourseUnits = await prisma.unit.findMany({ where: { courseId: cardiacEpCourse.id }, include: { topics: true } });
    if (cardiacEpCourseUnits.length > 0) {
      await prisma.progress.upsert({
        where: { userId_topicId_materialId_unitId_courseId: { userId: kerichomogulUser.id, topicId: '', materialId: '', unitId: cardiacEpCourseUnits[0].id, courseId: cardiacEpCourse.id } },
        update: {},
        create: {
          userId: kerichomogulUser.id,
          courseId: cardiacEpCourse.id,
          unitId: cardiacEpCourseUnits[0].id,
          topicId: cardiacEpCourseUnits[0].topics[0]?.id, // Just the first topic
          status: ProgressStatus.inProgress,
          progressPercentage: 60,
          completionPercentage: 60,
          timeSpent: 1200,
          startedAt: new Date('2025-09-01T00:00:00Z'),
          lastAccessedAt: new Date(),
        },
      });
    }

    const aclsCourseUnits = await prisma.unit.findMany({ where: { courseId: aclsCourse.id }, include: { topics: true } });
    if (aclsCourseUnits.length > 0) {
      await prisma.progress.upsert({
        where: { userId_topicId_materialId_unitId_courseId: { userId: kerichomogulUser.id, topicId: '', materialId: '', unitId: aclsCourseUnits[0].id, courseId: aclsCourse.id } },
        update: {},
        create: {
          userId: kerichomogulUser.id,
          courseId: aclsCourse.id,
          unitId: aclsCourseUnits[0].id,
          topicId: aclsCourseUnits[0].topics[0]?.id,
          status: ProgressStatus.inProgress,
          progressPercentage: 87,
          completionPercentage: 87,
          timeSpent: 1800,
          startedAt: new Date('2025-08-15T00:00:00Z'),
          lastAccessedAt: new Date(),
        },
      });
    }

    // Seed Progress for Student User in Dermatology (Pharmacology) as per user request
    const pharmacologyUnits = await prisma.unit.findMany({ where: { courseId: pharmacologyCourse.id }, include: { topics: true } });
    let dermUnit = pharmacologyUnits.find(u => u.name.toLowerCase().includes('derma'));
    if (!dermUnit) {
      dermUnit = await prisma.unit.create({
        data: {
          name: 'Dermatological and Ocular Diseases',
          slug: 'derm-ocular',
          title: 'Dermatological and Ocular Diseases',
          courseId: pharmacologyCourse.id,
          order: 1,
          isPublished: true,
          topics: {
            create: [
              { name: 'Acne', slug: 'acne', order: 1 }
            ]
          }
        },
        include: { topics: true }
      });
    }

    await prisma.progress.create({
      data: {
        userId: studentUser.id,
        courseId: pharmacologyCourse.id,
        unitId: dermUnit.id,
        topicId: dermUnit.topics.find(t => t.name === 'Acne')?.id || dermUnit.topics[0]?.id,
        status: ProgressStatus.inProgress,
        progressPercentage: 45,
        completionPercentage: 45,
        timeSpent: 600,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
      }
    });

    // Fetch the created learning goals to get their actual IDs
    const cardiacGoal = await prisma.learningGoal.findFirst({
      where: { userId: kerichomogulUser.id, title: 'Advanced Cardiac Care' },
    });
    
    const neurologyGoal = await prisma.learningGoal.findFirst({
      where: { userId: kerichomogulUser.id, title: 'Neurology Fundamentals' },
    });
    
    const emergencyGoal = await prisma.learningGoal.findFirst({
      where: { userId: kerichomogulUser.id, title: 'Emergency Medicine Mastery' },
    });

    if (cardiacGoal) {
      await prisma.learningGoalProgress.upsert({
        where: { id: 'lgp-kericho-cardiac' },
        update: {},
        create: {
          id: 'lgp-kericho-cardiac',
          userId: kerichomogulUser.id,
          learningGoalId: cardiacGoal.id,
          status: 'IN_PROGRESS', // Or mapped to DB enum if needed
          progress: 70,
          startDate: new Date('2025-09-15T00:00:00Z'),
          streakCount: 5,
        },
      }).catch(e => console.error("Error creating goal progress:", e));
    }

    // --- 6. SEED MORE COURSES, QUESTIONS, AND CONTENT ---
    console.log('Seeding additional courses and content...');
    const course1 = await prisma.course.upsert({
      where: { code: 'GM101' },
      update: {},
      create: {
        name: 'Introduction to Clinical Practice',
        title: 'Clinical Practice Fundamentals',
        code: 'GM101',
        description: 'A foundational course for medical students.',
        difficulty: CourseDifficulty.beginner,
        status: CourseStatus.published,
        categoryId: generalCategory.id,
        createdById: adminUser.id,
        estimatedHours: 40,
        price: 99.99,
        isFeatured: true,
      },
    });

    const course2 = await prisma.course.upsert({
      where: { code: 'SU201' },
      update: {},
      create: {
        name: 'Basic Surgical Skills',
        title: 'Surgical Techniques for Beginners',
        code: 'SU201',
        description: 'Hands-on training for essential surgical skills.',
        difficulty: CourseDifficulty.intermediate,
        status: CourseStatus.published,
        categoryId: surgeryCategory.id,
        createdById: adminUser.id,
        estimatedHours: 60,
        price: 149.99,
        isFeatured: false,
      },
    });

    console.log({ course1, course2 });

    // Create Questions
    const question1 = await prisma.question.upsert({
      where: { id: 'question-brady-prefix' },
      update: {},
      create: {
        id: 'question-brady-prefix',
        text: 'What does the prefix "brady-" mean?',
        type: QuestionType.multiple_choice,
        difficulty: QuestionDifficulty.easy,
        category: QuestionCategory.general,
        points: 1,
        options: {
          create: [
            { text: 'Slow', isCorrect: true, order: 1 },
            { text: 'Fast', isCorrect: false, order: 2 },
            { text: 'Pain', isCorrect: false, order: 3 },
            { text: 'Large', isCorrect: false, order: 4 },
          ],
        },
        courseId: course1.id,
        createdBy: adminUser.id,
      },
    });

    const question2 = await prisma.question.upsert({
      where: { id: 'question-itis-suffix' },
      update: {},
      create: {
        id: 'question-itis-suffix',
        text: 'The suffix "-itis" indicates:',
        type: QuestionType.multiple_choice,
        difficulty: QuestionDifficulty.medium,
        category: QuestionCategory.general,
        points: 1,
        options: {
          create: [
            { text: 'Inflammation', isCorrect: true, order: 1 },
            { text: 'Surgical removal', isCorrect: false, order: 2 },
            { text: 'Enlargement', isCorrect: false, order: 3 },
            { text: 'Pain', isCorrect: false, order: 4 },
          ],
        },
        courseId: course1.id,
        createdBy: adminUser.id,
      },
    });

    console.log({ question1, question2 });

    // Create a Unit for course1 to link materials and quizzes
    const unit1ForCourse1 = await prisma.unit.upsert({
      where: { courseId_order: { courseId: course1.id, order: 1 } },
      update: { slug: 'fundamentals-unit' },
      create: {
        name: 'Fundamentals Unit',
        slug: 'fundamentals-unit',
        title: 'Core Concepts',
        description: 'Basic concepts for clinical practice.',
        order: 1,
        courseId: course1.id,
        estimatedDuration: 120,
        estimatedMinutes: 120,
        isPublished: true,
      },
    });
    console.log({ unit1ForCourse1 });

    // Create a Topic for unit1ForCourse1
    // Use the compound-unique constraint (unitId + slug) for upsert
    const topic1ForUnit1 = await prisma.topic.upsert({
      where: { unitId_slug: { unitId: unit1ForCourse1.id, slug: 'fundamentals-topic' } },
      update: {
        // Keep the unique key fields unchanged; update other mutable fields for idempotency
        name: 'Fundamentals Topic',
        description: 'Basic topic for clinical practice fundamentals.',
        order: 1,
        estimatedMinutes: 60,
      },
      create: {
        name: 'Fundamentals Topic',
        slug: 'fundamentals-topic',
        description: 'Basic topic for clinical practice fundamentals.',
        order: 1,
        unitId: unit1ForCourse1.id,
        estimatedMinutes: 60,
      },
    });
    console.log({ topic1ForUnit1 });

    // Create demo Quiz for Course 1
    const quiz1 = await prisma.quiz.upsert({
      where: { id: 'quiz-gm101-basics' },
      update: {},
      create: {
        id: 'quiz-gm101-basics',
        title: 'Quiz: GM101 Basics',
        description: 'A basic quiz for Introduction to Clinical Practice.',
        unitId: unit1ForCourse1.id,
        createdBy: adminUser.id,
        isPublished: true,
        questionCount: 2,
        questions: {
          create: [
            { questionId: question1.id, order: 1 },
            { questionId: question2.id, order: 2 },
          ],
        },
      },
    });
    console.log(`Created quiz: ${quiz1.title}`);
    
    // --- 6a. SEED INTEGRATION TEST USER ANALYTICS DATA ---
    console.log('Seeding integration test user analytics data...');
    
    // Create Learning Analytics for integration test user
    await prisma.userLearningAnalytics.upsert({
      where: { userId: integrationTestUser.id },
      update: {},
      create: {
        userId: integrationTestUser.id,
        totalStudyTime: 1800, // 30 hours in minutes
        averageSessionLength: 45,
        completionRate: 65,
        averageScore: 82,
        currentStreak: 3,
        longestStreak: 7,
        strongestSubjects: ['Cardiology', 'Emergency Medicine'],
        weakestSubjects: ['Pharmacology'],
        predictedSuccessRate: 80,
        recommendedStudyTime: 2,
        personalizedTips: ['Practice emergency procedures', 'Review cardiology basics', 'Focus on quiz performance'],
      },
    });

    // Create Quiz Attempts for integration test user
    await prisma.quizAttempt.upsert({
      where: { id: `quiz-attempt-integration-1` },
      update: {},
      create: {
        id: `quiz-attempt-integration-1`,
        userId: integrationTestUser.id,
        quizId: quiz1.id,
        startedAt: new Date('2025-10-03T10:00:00Z'),
        completedAt: new Date('2025-10-03T10:30:00Z'),
        score: 85,
        maxScore: 100,
        percentage: 85,
        timeSpent: 1800,
        isPassed: true,
        correctAnswers: 8,
        totalQuestions: 10,
      },
    });

    await prisma.quizAttempt.upsert({
      where: { id: `quiz-attempt-integration-2` },
      update: {},
      create: {
        id: `quiz-attempt-integration-2`,
        userId: integrationTestUser.id,
        quizId: quiz1.id,
        startedAt: new Date('2025-10-04T14:00:00Z'),
        completedAt: new Date('2025-10-04T14:25:00Z'),
        score: 90,
        maxScore: 100,
        percentage: 90,
        timeSpent: 1500,
        isPassed: true,
        correctAnswers: 9,
        totalQuestions: 10,
      },
    });

    // Create Study Sessions for integration test user
    await prisma.studySession.createMany({
      data: [
        {
          userId: integrationTestUser.id,
          startTime: new Date('2025-10-03T09:00:00Z'),
          endTime: new Date('2025-10-03T10:00:00Z'),
          duration: 60,
          focusScore: 88,
          notes: 'Studied Cardiology basics',
        },
        {
          userId: integrationTestUser.id,
          startTime: new Date('2025-10-04T13:00:00Z'),
          endTime: new Date('2025-10-04T14:00:00Z'),
          duration: 60,
          focusScore: 92,
          notes: 'Emergency Medicine review',
        },
        {
          userId: integrationTestUser.id,
          startTime: new Date('2025-10-05T08:00:00Z'),
          endTime: new Date('2025-10-05T09:30:00Z'),
          duration: 90,
          focusScore: 85,
          notes: 'Quiz preparation',
        },
      ],
      skipDuplicates: true,
    });

    // Create User Activities for integration test user
    const integrationActivities = [
      {
        userId: integrationTestUser.id,
        type: UserActivityType.QUIZ_COMPLETION,
        description: 'Completed GM101 Basics Quiz',
        details: { score: 85, quizId: quiz1.id },
        createdAt: new Date('2025-10-03T10:30:00Z'),
      },
      {
        userId: integrationTestUser.id,
        type: UserActivityType.STUDY_SESSION,
        description: 'Completed study session on Cardiology',
        details: { duration: 60 },
        createdAt: new Date('2025-10-03T10:00:00Z'),
      },
      {
        userId: integrationTestUser.id,
        type: UserActivityType.QUIZ_COMPLETION,
        description: 'Completed GM101 Basics Quiz (Retake)',
        details: { score: 90, quizId: quiz1.id },
        createdAt: new Date('2025-10-04T14:25:00Z'),
      },
    ];

    for (const activity of integrationActivities) {
      const activityId = `activity-int-${activity.description.replace(/\s+/g, '-').toLowerCase()}`;
      
      // Use raw SQL to bypass Prisma validation issues
      // Map enum to lowercase for raw SQL compatibility with Postgres enum
      const activityType = activity.type.toLowerCase();

      await prisma.$executeRawUnsafe(
        `INSERT INTO user_activities (id, user_id, type, description, details, created_at) 
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (id) DO UPDATE SET type = $3, description = $4, details = $5::jsonb, created_at = $6`,
        activityId,
        activity.userId,
        activityType,
        activity.description,
        activity.details ? JSON.stringify(activity.details) : null,
        activity.createdAt
      );
    }

    // Create Course Enrollments for integration test user
    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: integrationTestUser.id, courseId: course1.id } },
      update: {},
      create: {
        userId: integrationTestUser.id,
        courseId: course1.id,
        status: EnrollmentStatus.active,
        progressPercentage: 65,
        enrolledAt: new Date('2025-09-20T00:00:00Z'),
      },
    });

    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: integrationTestUser.id, courseId: cardiologyBasicsCourse.id } },
      update: {},
      create: {
        userId: integrationTestUser.id,
        courseId: cardiologyBasicsCourse.id,
        status: EnrollmentStatus.active,
        progressPercentage: 75,
        enrolledAt: new Date('2025-09-15T00:00:00Z'),
      },
    });

    // Create Assessment Progress for integration test user
    await prisma.assessmentProgress.createMany({
      data: [
        {
          userId: integrationTestUser.id,
          assessmentId: quiz1.id,
          completionPercentage: 100,
          lastAttemptedAt: new Date('2025-10-04T14:25:00Z'),
          totalAttempts: 2,
          bestScore: 90,
          isPassed: true,
        },
      ],
      skipDuplicates: true,
    });

    console.log('Integration test user analytics data seeded successfully.');

    // Create File first
    const file2 = await prisma.file.upsert({
      where: { id: 'file-med-ethics' },
      update: {},
      create: {
        id: 'file-med-ethics',
        filename: 'medical_ethics.pdf',
        mimetype: 'application/pdf',
        size: 1024000,
        key: 'medical_ethics.pdf',
        uploadedById: adminUser.id,
      },
    });

    // Create Material referencing the file
    const material2 = await prisma.material.upsert({
      where: { id: 'material-med-ethics' },
      update: {},
      create: {
        id: 'material-med-ethics',
        title: 'Introduction to Medical Ethics',
        type: 'pdf',
        fileId: file2.id,
        content: 'Content for medical ethics.',
        courseId: course1.id,
        unitId: unit1ForCourse1.id,
        userId: adminUser.id,
      },
    });
    console.log({ file2, material2 });
    

    // --- 7. SEED USER-SPECIFIC DATA (kerichomogul) ---
    console.log('Seeding detailed data for kerichomogul...');
    const userActivities = [
      {
        id: 'activity-kericho-1',
        userId: kerichomogulUser.id,
        type: UserActivityType.LOGIN,
        description: 'User logged in',
        createdAt: new Date('2025-01-01T09:00:00Z'),
      },
      {
        id: 'activity-kericho-2',
        userId: kerichomogulUser.id,
        type: UserActivityType.COURSE_ENROLLMENT,
        description: 'Enrolled in Cardiac EP Course',
        details: { courseId: cardiacEpCourse.id },
        createdAt: new Date('2025-09-01T00:00:00Z'),
      },
      {
        id: 'activity-kericho-3',
        userId: kerichomogulUser.id,
        type: UserActivityType.QUIZ_COMPLETION,
        description: 'Completed ACLS Quiz',
        details: { quizId: quiz1.id, score: 92 },
        createdAt: new Date('2025-10-04T15:30:00Z'),
      },
    ];
    for (const activity of userActivities) {
      // Use raw SQL to bypass Prisma validation issues with enums
      const activityType = activity.type.toLowerCase();
      
      await prisma.$executeRawUnsafe(
        `INSERT INTO user_activities (id, user_id, type, description, details, created_at) 
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (id) DO UPDATE SET type = $3, description = $4, details = $5::jsonb, created_at = $6`,
        activity.id,
        activity.userId,
        activityType,
        activity.description,
        activity.details ? JSON.stringify(activity.details) : null,
        activity.createdAt
      );
    }

    // Create Study Sessions for kerichomogul
    const studySessions = [
      {
        id: 'study-session-kericho-1',
        userId: kerichomogulUser.id,
        startTime: new Date('2025-10-04T09:00:00Z'),
        endTime: new Date('2025-10-04T10:30:00Z'),
        duration: 90,
        focusScore: 85,
        notes: 'Reviewed cardiac arrhythmias and treatment protocols',
      },
      {
        id: 'study-session-kericho-2',
        userId: kerichomogulUser.id,
        startTime: new Date('2025-10-05T07:00:00Z'),
        endTime: new Date('2025-10-05T08:00:00Z'),
        duration: 60,
        focusScore: 92,
        notes: 'ACLS algorithm practice',
      },
    ];
    for (const session of studySessions) {
      await prisma.studySession.upsert({ where: { id: session.id }, update: {}, create: session });
    }

    // Create Learning History for kerichomogul
    const learningHistories = [
      {
        id: 'history-kericho-1',
        userId: kerichomogulUser.id,
        materialId: material2.id,
        category: 'Cardiology',
        type: 'video',
        score: 88,
        duration: 45,
        difficulty: 0.7,
        engagement: 0.85,
        interactionScore: 0.9,
        timestamp: new Date('2025-10-03T10:00:00Z'),
      },
      {
        id: 'history-kericho-2',
        userId: kerichomogulUser.id,
        category: 'Emergency Medicine',
        type: 'quiz',
        score: 92,
        duration: 30,
        difficulty: 0.8,
        engagement: 0.95,
        interactionScore: 0.92,
        timestamp: new Date('2025-10-04T15:30:00Z'),
      },
    ];
    for (const history of learningHistories) {
      await prisma.learningHistory.upsert({ where: { id: history.id }, update: {}, create: history });
    }

    // Create Quiz Attempts for kerichomogul
    const quizAttempts = [
      {
        id: 'attempt-kericho-1',
        userId: kerichomogulUser.id,
        quizId: quiz1.id,
        startedAt: new Date('2025-10-04T15:00:00Z'),
        completedAt: new Date('2025-10-04T15:30:00Z'),
        score: 92,
        maxScore: 100,
        percentage: 92,
        timeSpent: 1800,
        isPassed: true,
        correctAnswers: 9,
        totalQuestions: 10,
      },
    ];
    for (const attempt of quizAttempts) {
      await prisma.quizAttempt.upsert({ where: { id: attempt.id }, update: {}, create: attempt });
    }

    // Create Assessment Progress for kerichomogul
    const assessmentProgresses = [
      {
        id: 'assessment-kericho-1',
        userId: kerichomogulUser.id,
        assessmentId: quiz1.id,
        completionPercentage: 100,
        lastAttemptedAt: new Date('2025-10-04T15:30:00Z'),
        totalAttempts: 2,
        bestScore: 92,
        isPassed: true,
      },
    ];
    for (const progress of assessmentProgresses) {
      await prisma.assessmentProgress.upsert({ where: { id: progress.id }, update: {}, create: progress });
    }

    // Create Notifications for kerichomogul
    const notifications = [
      {
        id: 'notif-kericho-1',
        userId: kerichomogulUser.id,
        type: 'achievement',
        message: 'Congratulations! You achieved a 15-day study streak!',
        priority: NotificationPriority.high,
        read: false,
      },
      {
        id: 'notif-kericho-2',
        userId: kerichomogulUser.id,
        type: 'reminder',
        message: 'Your ACLS certification exam is in 2 weeks',
        priority: NotificationPriority.medium,
        read: true,
      },
    ];
    for (const notification of notifications) {
      await prisma.notification.upsert({ where: { id: notification.id }, update: {}, create: notification });
    }

    // Create Deadlines for kerichomogul
    const deadlines = [
      {
        id: 'deadline-kericho-1',
        userId: kerichomogulUser.id,
        courseId: cardiacEpCourse.id,
        title: 'Complete Cardiac EP Final Assessment',
        description: 'Final assessment for the Cardiac Electrophysiology course',
        dueDate: new Date('2025-11-15T23:59:59Z'),
        priority: 'high',
      },
      {
        id: 'deadline-kericho-2',
        userId: kerichomogulUser.id,
        courseId: aclsCourse.id,
        title: 'ACLS Certification Exam',
        description: 'Official ACLS certification examination',
        dueDate: new Date('2025-10-20T14:00:00Z'),
        priority: 'urgent',
      },
    ];
    for (const deadline of deadlines) {
      await prisma.deadline.upsert({ where: { id: deadline.id }, update: {}, create: deadline });
    }

    // Create Badges
    const cardiacBadge = await prisma.badge.upsert({
      where: { id: 'badge-cardiac-master' },
      update: {},
      create: {
        id: 'badge-cardiac-master',
        name: 'Cardiac Master',
        description: 'Completed advanced cardiac care modules',
        imageUrl: 'https://example.com/badges/cardiac-master.png',
        tier: 'gold',
        points: 500,
        criteria: { type: UserActivityType.COURSE_COMPLETION, courseCategory: 'Cardiology' },
      },
    });

    const streakBadge = await prisma.badge.upsert({
      where: { id: 'badge-streak-champion' },
      update: {},
      create: {
        id: 'badge-streak-champion',
        name: 'Streak Champion',
        description: 'Maintained a 15-day study streak',
        imageUrl: 'https://example.com/badges/streak-champion.png',
        tier: 'silver',
        points: 300,
        criteria: { type: 'streak', days: 15 },
      },
    });

    // Award Badges to kerichomogul
    const userBadges = [
      {
        userId: kerichomogulUser.id,
        badgeId: cardiacBadge.id,
        awardedAt: new Date('2025-10-01T00:00:00Z'),
      },
      {
        userId: kerichomogulUser.id,
        badgeId: streakBadge.id,
        awardedAt: new Date('2025-10-04T00:00:00Z'),
      },
    ];
    for (const userBadge of userBadges) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: userBadge.userId, badgeId: userBadge.badgeId } },
        update: {},
        create: userBadge,
      });
    }

    // Create CPD Cycle for kerichomogul
    const cpdCycle = await prisma.cPDCycle.upsert({
      where: { id: 'cpd-cycle-kericho-1' },
      update: {},
      create: {
        id: 'cpd-cycle-kericho-1',
        userId: kerichomogulUser.id,
        name: '2025 Professional Development',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-12-31T23:59:59Z'),
        requiredPoints: 50,
        isActive: true,
      },
    });

    // Create CPD Activities for kerichomogul
    const cpdActivities = [
      {
        id: 'cpd-activity-kericho-1',
        userId: kerichomogulUser.id,
        cycleId: cpdCycle.id,
        activityDate: new Date('2025-09-15T00:00:00Z'),
        activityType: CPDActivityType.course_completion,
        points: 15,
        description: 'Completed Advanced Cardiac Care module',
        verified: true,
      },
      {
        id: 'cpd-activity-kericho-2',
        userId: kerichomogulUser.id,
        cycleId: cpdCycle.id,
        activityDate: new Date('2025-08-20T00:00:00Z'),
        activityType: CPDActivityType.webinar,
        points: 5,
        description: 'Attended Emergency Medicine webinar',
        verified: true,
      },
    ];
    for (const activity of cpdActivities) {
      await prisma.cPDActivity.upsert({ where: { id: activity.id }, update: {}, create: activity });
    }

    // Create Chat Sessions for kerichomogul
    const chatSession = await prisma.chatSession.upsert({
      where: { id: 'chat-kericho-1' },
      update: {},
      create: {
        id: 'chat-kericho-1',
        userId: kerichomogulUser.id,
        title: 'Cardiac Arrhythmia Questions',
        topic: 'Cardiology',
        isActive: true,
      },
    });

    const chatMessages = [
      {
        id: 'chat-msg-kericho-1',
        sessionId: chatSession.id,
        userId: kerichomogulUser.id,
        content: 'Can you explain the difference between atrial fibrillation and atrial flutter?',
        role: MessageRole.user,
      },
      {
        id: 'chat-msg-kericho-2',
        sessionId: chatSession.id,
        userId: adminUser.id,
        content: 'Atrial fibrillation is characterized by irregular, chaotic atrial activity...', // Note: This is a string literal, no special escaping needed.
        role: MessageRole.assistant,
      },
    ];
    for (const message of chatMessages) {
      await prisma.chatMessage.upsert({ where: { id: message.id }, update: {}, create: message });
    }

    // Create Flashcards for kerichomogul (using Flashcard + UserFlashcardProgress)
    const flashcardDefs = [
      {
        id: 'flashcard-kericho-1',
        front: question1.text,
        back: 'Slow - as in bradycardia (slow heart rate)',
        userId: kerichomogulUser.id,
        easeFactor: 2.6,
        interval: 7,
        repetitions: 3,
        correctStreak: 3,
        lastReview: new Date('2025-09-28T00:00:00Z'),
        nextReview: new Date('2025-10-05T00:00:00Z'),
      },
      {
        id: 'flashcard-kericho-2',
        front: question2.text,
        back: 'Inflammation - indicates an inflammatory condition',
        userId: kerichomogulUser.id,
        easeFactor: 2.8,
        interval: 14,
        repetitions: 4,
        correctStreak: 4,
        lastReview: new Date('2025-09-21T00:00:00Z'),
        nextReview: new Date('2025-10-05T00:00:00Z'),
      },
    ];
    for (const fc of flashcardDefs) {
      const flashcard = await prisma.flashcard.upsert({
        where: { id: fc.id },
        update: { front: fc.front, back: fc.back },
        create: { id: fc.id, front: fc.front, back: fc.back, hints: [], tags: [], difficulty: QuestionDifficulty.easy },
      });
      await prisma.userFlashcardProgress.upsert({
        where: { userId_flashcardId: { userId: fc.userId, flashcardId: flashcard.id } },
        update: { easeFactor: fc.easeFactor, interval: fc.interval, repetitions: fc.repetitions, correctStreak: fc.correctStreak, lastReview: fc.lastReview, nextReview: fc.nextReview },
        create: { userId: fc.userId, flashcardId: flashcard.id, easeFactor: fc.easeFactor, interval: fc.interval, repetitions: fc.repetitions, correctStreak: fc.correctStreak, lastReview: fc.lastReview, nextReview: fc.nextReview },
      });
    }

    // Create Security Events for kerichomogul
    const securityEvents = [
      {
        userId: kerichomogulUser.id,
        eventType: 'login_success',
        description: 'User logged in successfully',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        severity: 'info',
        timestamp: new Date('2025-10-05T08:00:00Z'),
      },
      {
        userId: kerichomogulUser.id,
        eventType: 'password_change',
        description: 'User changed password',
        ipAddress: '192.168.1.100',
        severity: 'medium',
        timestamp: new Date('2025-09-15T10:30:00Z'),
      },
    ];
    // Security events don't have a unique ID, so we create them without checking
    await prisma.securityEvent.createMany({ data: securityEvents, skipDuplicates: true });

    // Create User Sessions for kerichomogul
    const userSessions = [
      {
        userId: kerichomogulUser.id,
        token: `session-token-kericho-${Date.now()}`,
        deviceId: 'desktop-chrome-001',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        lastAccessed: new Date(),
      },
    ];
    // User sessions are often unique per run, so createMany is okay here if we don't hardcode a unique token/id
    await prisma.userSession.createMany({ data: userSessions, skipDuplicates: true });

    // Create Material Progress for kerichomogul
    const materialProgresses = [
      {
        userId: kerichomogulUser.id,
        materialId: material2.id,
        topicId: topic1ForUnit1.id,
        unitId: unit1ForCourse1.id,
        courseId: course1.id,
        progressPercentage: 85,
        isCompleted: false,
        lastAccessedAt: new Date(),
      },
    ];
    for (const progress of materialProgresses) {
      await prisma.progress.upsert({
        where: {
          userId_topicId_materialId_unitId_courseId: {
            userId: progress.userId,
            topicId: progress.topicId,
            materialId: progress.materialId,
            unitId: progress.unitId,
            courseId: progress.courseId,
          },
        },
        update: {
          progressPercentage: progress.progressPercentage,
          isCompleted: progress.isCompleted,
          lastAccessedAt: progress.lastAccessedAt,
        },
        create: progress,
      });
    }

    // Create Student Interactions for kerichomogul
    const studentInteractions = [
      {
        userId: kerichomogulUser.id,
        unitId: unit1ForCourse1.id,
        interactionType: 'completed',
        score: 90,
      },
      {
        userId: kerichomogulUser.id,
        unitId: unit1ForCourse1.id,
        interactionType: 'liked',
        score: 100,
      },
    ];
    // This model seems to lack a unique constraint for upsert, so we'll use createMany and skip duplicates
    await prisma.studentInteraction.createMany({ data: studentInteractions, skipDuplicates: true });

    // --- 8. SEED MISCELLANEOUS DATA ---
    console.log('Seeding miscellaneous data (chats, notifications, etc)...');
    const recommendations = [
      {
        userId: kerichomogulUser.id,
        recommendedUnitId: unit1ForCourse1.id,
        score: 0.92,
        reason: 'Based on your strong performance in cardiac care',
        algorithm: 'Linfa Classifier',
      },
    ];
    // This model also lacks a unique constraint for upsert
    await prisma.recommendation.createMany({ data: recommendations, skipDuplicates: true });

    // Create Chat Sessions and Messages
    const chatSession1 = await prisma.chatSession.upsert({
      where: { id: 'conv-1' },
      update: {},
      create: {
        id: 'conv-1',
        userId: adminUser.id,
        title: 'Admin-Student Chat',
      },
    });

    await prisma.chatMessage.upsert({
      where: { id: 'msg-1' },
      update: {},
      create: {
        id: 'msg-1',
        sessionId: chatSession1.id,
        userId: adminUser.id,
        content: 'Hello (mock)',
        role: 'user',
      },
    });
    console.log({ chatSession1 });

    // Create Notifications
    const notification1 = await prisma.notification.upsert({
      where: { id: 'note-1' },
      update: {},
      create: {
        id: 'note-1',
        userId: studentUser.id,
        type: 'system',
        message: 'Welcome to the demo app',
        priority: NotificationPriority.medium,
        read: false,
      },
    });
    console.log({ notification1 });

    // Create Audit Logs (SecurityAudit)
    const auditLog1 = await prisma.securityAudit.upsert({
      where: { id: 'log-1' },
      update: {},
      create: {
        id: 'log-1',
        userId: adminUser.id,
        action: 'USER_LOGIN',
        resource: 'User',
        details: { ipAddress: '127.0.0.1', userAgent: 'mock-browser' },
        timestamp: new Date().toISOString(),
        status: 'success',
        role: 'admin',
      },
    });
    console.log({ auditLog1 });

    // Add more UserActivity entries
    const userActivity1 = await prisma.userActivity.upsert({
      where: { id: 'user-activity-1' },
      update: {},
      create: {
        id: 'user-activity-1',
        userId: studentUser.id,
        type: UserActivityType.LOGIN,
        description: 'Student logged in',
        createdAt: new Date('2025-09-26T08:00:00Z').toISOString(),
      },
    });

    const userActivity2 = await prisma.userActivity.upsert({
      where: { id: 'user-activity-2' },
      update: {},
      create: {
        id: 'user-activity-2',
        userId: studentUser.id,
        type: UserActivityType.STUDY_SESSION,
        description: 'Student completed a study session',
        createdAt: new Date('2025-09-26T09:00:00Z').toISOString(),
      },
    });
    console.log({ userActivity1, userActivity2 });

    // Add LearningPath
    const learningPath1 = await prisma.learningPath.upsert({
      where: { id: 'path-1' },
      update: {},
      create: {
        id: 'path-1',
        title: 'Advanced Cardiology',
        description: 'Deep dive into cardiovascular systems',
        difficulty: CourseDifficulty.advanced,
        estimatedDurationWeeks: 2,
        categoryId: generalCategory.id,
        createdBy: adminUser.id,
      },
    });
    console.log({ learningPath1 });

    // Add AssessmentProgress
    const assessmentProgress1 = await prisma.assessmentProgress.upsert({
      where: { id: 'assessment-progress-1' },
      update: {},
      create: {
        id: 'assessment-progress-1',
        userId: studentUser.id,
        assessmentId: 'assessment-1',
        completionPercentage: 100,
        lastAttemptedAt: new Date('2025-09-26T09:00:00Z').toISOString(),
        totalAttempts: 1,
        bestScore: 85,
        isPassed: true,
      },
    });
    console.log({ assessmentProgress1 });

    // Add LearningSuggestion
    const learningSuggestion1 = await prisma.learningSuggestion.upsert({
      where: { id: 'suggestion-1' },
      update: {},
      create: {
        id: 'suggestion-1',
        userId: studentUser.id,
        materialId: material2.id,
        score: 0.85,
        reason: 'Identified as a weak area',
      },
    });
    console.log({ learningSuggestion1 });

    // Add Recommendation
    const recommendation1 = await prisma.recommendation.upsert({
      where: { id: 'recommendation-1' },
      update: {},
      create: {
        id: 'recommendation-1',
        userId: studentUser.id,
        recommendedUnitId: unit1ForCourse1.id,
        score: 0.92,
        reason: 'Based on your learning path progress',
        algorithm: 'Rule-Based',
      },
    });
    console.log({ recommendation1 });

    console.log('Seeding finished.');
  } catch (error) {
    console.error('Error during seeding:', error);
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