from ts_runtime import run_typescript


def test_unit_creation_requires_course_management_permission():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '#common/utils/fts.utils') {
    return { FtsUtils: { updateFtsVector: async () => undefined } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { ForbiddenException } = require('@nestjs/common');
const { UnitsService } =
  require('./src/modules/education/courses/services/units.service.ts');

function makeService(role, ownerId, assigned = false) {
  let transactionCalls = 0;
  const service = Object.create(UnitsService.prototype);
  service.prisma = {
    course: { findUnique: async () => ({ id: 'course-1', createdById: ownerId }) },
    userRole: {
      findMany: async () => [{ role: { name: role } }],
    },
    courseInstructor: {
      findUnique: async () => assigned ? { id: 'assignment-1' } : null,
    },
    $transaction: async work => {
      transactionCalls += 1;
      return work({
        unit: {
          findFirst: async () => null,
          create: async () => ({ id: 'unit-1', courseId: 'course-1' }),
        },
      });
    },
  };
  service.setCacheForUnit = async () => undefined;
  service.searchSync = { syncEntity: async () => undefined };
  service.logger = { log: () => undefined, error: () => undefined };
  return { service, transactionCalls: () => transactionCalls };
}

(async () => {
  const student = makeService('student', 'student-1');
  await assert.rejects(
    student.service.create({ courseId: 'course-1', title: 'Unit' }, 'student-1'),
    error => error instanceof ForbiddenException,
  );
  assert.equal(student.transactionCalls(), 0);

  const otherInstructor = makeService('instructor', 'owner-1');
  await assert.rejects(
    otherInstructor.service.create(
      { courseId: 'course-1', title: 'Unit' },
      'instructor-2',
    ),
    error => error instanceof ForbiddenException,
  );
  assert.equal(otherInstructor.transactionCalls(), 0);

  const owner = makeService('instructor', 'instructor-1');
  const created = await owner.service.create(
    { courseId: 'course-1', title: 'Unit', order: 1 },
    'instructor-1',
  );
  assert.equal(created.id, 'unit-1');
  assert.equal(owner.transactionCalls(), 1);

  const assignedInstructor = makeService('instructor', 'owner-1', true);
  await assignedInstructor.service.create(
    { courseId: 'course-1', title: 'Assigned unit', order: 1 },
    'assigned-instructor',
  );
  assert.equal(assignedInstructor.transactionCalls(), 1);

  const admin = makeService('admin', 'owner-1');
  await admin.service.create(
    { courseId: 'course-1', title: 'Admin unit', order: 1 },
    'admin-1',
  );
  assert.equal(admin.transactionCalls(), 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_unit_create_route_declares_instructor_and_admin_roles():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { UnitsController } =
  require('./src/modules/education/courses/controllers/units.controller.ts');
const { rolesKey } = require('./src/common/decorators/roles.decorator.ts');

assert.deepEqual(
  Reflect.getMetadata(rolesKey, UnitsController.prototype.create),
  ['instructor', 'admin'],
);
"""
    )


def test_topic_creation_requires_instructor_or_admin_course_access():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { TopicsService } =
  require('./src/modules/education/courses/services/topics.service.ts');

const service = Object.create(TopicsService.prototype);
let topicQueries = 0;
service.prisma = {
  userRole: {
    findMany: async () => [{ role: { name: 'student' } }],
  },
  courseInstructor: { findUnique: async () => null },
  unit: {
    findUnique: async () => ({
      id: 'unit-1',
      course: { id: 'course-1', createdById: 'instructor-1' },
    }),
  },
  topic: {
    findFirst: async () => { topicQueries += 1; return null; },
  },
};

(async () => {
  await assert.rejects(
    service.create(
      { unitId: 'unit-1', name: 'Restricted topic' },
      'student-1',
    ),
    error => error instanceof ForbiddenException,
  );
  assert.equal(topicQueries, 0);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_course_detail_hides_unpublished_content_from_students_but_not_admins():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '#common/utils/fts.utils') {
    return { FtsUtils: { updateFtsVector: async () => undefined } };
  }
  if (request === '../../../auth/services/users.service') {
    return { UsersService: class UsersService {} };
  }
  if (request === '../../../ai-analytics/services/ai-analytics.service') {
    return { AiAnalyticsService: class AiAnalyticsService {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { ForbiddenException, NotFoundException } = require('@nestjs/common');
const { CoursesService } =
  require('./src/modules/education/courses/services/courses.service.ts');

function makeCourse(status = 'published') {
  return {
    id: 'course-1',
    status,
    createdById: 'owner-1',
    category: null,
    materials: [],
    units: [
      { id: 'published-unit', isPublished: true, materials: [], topics: [] },
      { id: 'draft-unit', isPublished: false, materials: [], topics: [] },
    ],
    createdBy: null,
    prerequisites: [],
    enrollments: [],
  };
}

function makeService(course) {
  const service = Object.create(CoursesService.prototype);
  service.prisma = {
    course: { findUnique: async () => course },
    courseEnrollment: {
      findUnique: async () => ({ status: 'active', progressPercentage: 10, lastAccessed: null }),
    },
  };
  service.logger = { log: () => undefined, warn: () => undefined, error: () => undefined };
  return service;
}

(async () => {
  const student = makeService(makeCourse('draft'));
  student.canManageCourse = async () => false;
  await assert.rejects(
    student.findOne('course-1', 'student-1'),
    error => error instanceof NotFoundException,
  );

  const publishedCourse = makeService(makeCourse());
  publishedCourse.canManageCourse = async () => false;
  const studentView = await publishedCourse.findOne('course-1', 'student-1');
  assert.deepEqual(studentView.units.map(unit => unit.id), ['published-unit']);

  const admin = makeService(makeCourse('draft'));
  admin.canManageCourse = async () => true;
  const adminView = await admin.findOne('course-1', 'admin-1');
  assert.deepEqual(adminView.units.map(unit => unit.id), [
    'published-unit',
    'draft-unit',
  ]);

  const unauthorizedAssigner = Object.create(CoursesService.prototype);
  unauthorizedAssigner.prisma = {
    course: {
      findUnique: async () => ({
        id: 'course-1',
        createdById: 'owner-1',
      }),
    },
    userRole: {
      findMany: async () => [{ role: { name: 'student' } }],
    },
  };
  unauthorizedAssigner.logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  await assert.rejects(
    unauthorizedAssigner.assignInstructor(
      'course-1',
      'instructor-2',
      'student-1',
    ),
    error => error instanceof ForbiddenException,
  );

  const studentCreator = Object.create(CoursesService.prototype);
  studentCreator.prisma = {
    userRole: {
      findMany: async () => [{ role: { name: 'student' } }],
    },
  };
  studentCreator.logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  await assert.rejects(
    studentCreator.create({ title: 'Forbidden course' }, 'student-1'),
    error => error instanceof ForbiddenException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_unpublished_course_material_requires_direct_share_or_management():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '#common/utils/error.utils') {
    return { handleServiceError: (_error, _logger, _method) => undefined };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { ForbiddenException } = require('@nestjs/common');
const { MaterialsService } =
  require('./src/modules/education/courses/services/materials.service.ts');

function makeService(directShare, courseStatus = 'draft', unitPublished = false) {
  const service = Object.create(MaterialsService.prototype);
  service.prisma = {
    materialShare: {
      findUnique: async () => directShare ? { id: 'share-1' } : null,
    },
    course: {
      findUnique: async () => ({ id: 'course-1', createdById: 'owner-1', status: courseStatus }),
    },
    unit: { findUnique: async () => ({ isPublished: unitPublished }) },
    courseInstructor: { findUnique: async () => null },
    courseEnrollment: {
      findUnique: async () => courseStatus === 'published' ? { status: 'active' } : null,
    },
    studyGroupMember: { findMany: async () => [] },
    userRole: {
      findMany: async () => [{ role: { name: 'student' } }],
    },
  };
  service.logger = { error: () => undefined };
  return service;
}

(async () => {
  const unpublishedMaterial = {
    id: 'material-1',
    userId: 'owner-1',
    courseId: 'course-1',
    unitId: 'unit-1',
    metadata: { shareWithCourse: true },
  };
  await assert.rejects(
    makeService(false).assertCanReadMaterial(unpublishedMaterial, 'student-1'),
    error => error instanceof ForbiddenException,
  );
  await makeService(true).assertCanReadMaterial(unpublishedMaterial, 'student-1');
  await makeService(false, 'published', true).assertCanReadMaterial(
    unpublishedMaterial,
    'student-1',
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_student_course_list_cannot_request_draft_courses():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '#common/utils/fts.utils') {
    return { FtsUtils: { updateFtsVector: async () => undefined } };
  }
  if (request === '../../../auth/services/users.service') {
    return { UsersService: class UsersService {} };
  }
  if (request === '../../../ai-analytics/services/ai-analytics.service') {
    return { AiAnalyticsService: class AiAnalyticsService {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { CoursesService } =
  require('./src/modules/education/courses/services/courses.service.ts');
let query;
const service = Object.create(CoursesService.prototype);
service.prisma = {
  userRole: {
    findMany: async () => [{ role: { name: 'student' } }],
  },
  course: {
    findMany: async args => { query = args; return []; },
    count: async () => 0,
  },
};
service.redisService = { get: async () => null };
service.logger = { log: () => undefined, warn: () => undefined, error: () => undefined };

(async () => {
  await service.findAll(
    { status: 'draft', page: 1, limit: 10 },
    { page: 1, limit: 10 },
    'student-1',
  );
  assert.ok(query.where.AND.some(condition => condition.status === 'published'));
  assert.ok(!query.where.AND.some(condition => condition.status === 'draft'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_student_cannot_retrieve_unpublished_unit_or_topic_by_id():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
const { UnitsService } =
  require('./src/modules/education/courses/services/units.service.ts');
const { TopicsService } =
  require('./src/modules/education/courses/services/topics.service.ts');

const unitService = Object.create(UnitsService.prototype);
unitService.prisma = {
  unit: {
    findUnique: async () => ({
      id: 'unit-1',
      courseId: 'course-1',
      isPublished: false,
      course: {
        id: 'course-1',
        title: 'Course',
        status: 'published',
        createdById: 'instructor-1',
        materials: [],
      },
      materials: [],
      topics: [],
    }),
  },
  userRole: {
    findMany: async () => [{ role: { name: 'student' } }],
  },
  courseInstructor: { findUnique: async () => null },
};
unitService.logger = { error: () => undefined };

const topicService = Object.create(TopicsService.prototype);
topicService.prisma = {
  topic: {
    findUnique: async () => ({
      id: 'topic-1',
      unitId: 'unit-1',
      name: 'Topic',
      materials: [],
      unit: {
        id: 'unit-1',
        isPublished: false,
        course: {
          id: 'course-1',
          status: 'published',
          createdById: 'instructor-1',
          instructors: [],
        },
      },
    }),
  },
  userRole: {
    findMany: async () => [{ role: { name: 'student' } }],
  },
  courseInstructor: { findUnique: async () => null },
};

(async () => {
  await assert.rejects(
    unitService.findOne('unit-1', 'student-1'),
    error => error instanceof NotFoundException,
  );
  await assert.rejects(
    topicService.findOne('topic-1', 'student-1'),
    error => error instanceof NotFoundException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
