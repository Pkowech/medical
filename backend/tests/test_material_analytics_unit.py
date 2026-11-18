from ts_runtime import run_typescript


def test_material_stats_use_event_aggregates_and_require_course_manager_access():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { MaterialsService } =
  require('./src/modules/education/courses/services/materials.service.ts');

const service = Object.create(MaterialsService.prototype);
service.findOne = async () => ({
  id: 'material-1',
  userId: 'owner-1',
  courseId: null,
});
const aggregateQueries = [];
service.prisma = {
  materialEvent: {
    aggregate: async query => {
      aggregateQueries.push(query);
      return {
        _sum: {
          viewCount: query.where.eventType === 'view' ? 12 : 0,
          downloadCount: query.where.eventType === 'download' ? 3 : 0,
        },
      };
    },
    count: async ({ where }) => {
      assert.deepEqual(where, { materialId: 'material-1', eventType: 'view' });
      return 2;
    },
  },
};
service.logger = { error: () => {} };

(async () => {
  const stats = await service.getMaterialStats('material-1', 'owner-1');
  assert.deepEqual(stats, { views: 12, downloads: 3, uniqueViewers: 2 });
  assert.deepEqual(
    aggregateQueries.map(query => query.where.eventType).sort(),
    ['download', 'view'],
  );

  service.findOne = async () => ({
    id: 'material-1',
    userId: 'owner-1',
    courseId: 'course-1',
  });
  service.assertCanManageCourseMaterials = async () => {
    throw new ForbiddenException('Not a course manager');
  };
  await assert.rejects(
    service.getMaterialStats('material-1', 'student-1'),
    ForbiddenException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_recent_materials_exclude_materials_the_user_can_no_longer_read():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { MaterialsService } =
  require('./src/modules/education/courses/services/materials.service.ts');

const events = [
  {
    materialId: 'visible-1',
    lastOccurredAt: new Date('2025-01-03T00:00:00Z'),
    material: { id: 'visible-1', title: 'Visible one' },
  },
  {
    materialId: 'revoked',
    lastOccurredAt: new Date('2025-01-02T00:00:00Z'),
    material: { id: 'revoked', title: 'Revoked' },
  },
  {
    materialId: 'visible-2',
    lastOccurredAt: new Date('2025-01-01T00:00:00Z'),
    material: { id: 'visible-2', title: 'Visible two' },
  },
];
let eventQuery;
const service = Object.create(MaterialsService.prototype);
service.prisma = {
  materialEvent: {
    findMany: async query => {
      eventQuery = query;
      return events;
    },
  },
};
service.assertCanReadMaterial = async (material, userId) => {
  assert.equal(userId, 'student-1');
  if (material.id === 'revoked') {
    throw new ForbiddenException('Access was revoked');
  }
};
service.logger = { error: () => {} };

(async () => {
  const recent = await service.getRecentlyViewedMaterials('student-1');
  assert.deepEqual(recent.map(material => material.id), ['visible-1', 'visible-2']);
  assert.deepEqual(eventQuery.where, { userId: 'student-1', eventType: 'view' });
  assert.deepEqual(eventQuery.orderBy, { lastOccurredAt: 'desc' });
  assert.equal(eventQuery.take, 30);
  assert.equal(recent[0].lastViewedAt, events[0].lastOccurredAt);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
