from ts_runtime import run_typescript


def test_study_group_discovery_is_limited_to_public_groups():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { StudyGroupsService } =
  require('./src/modules/education/courses/services/study-groups.service.ts');

let query;
let cacheKey;
const service = Object.create(StudyGroupsService.prototype);
service.redisService = {
  get: async key => {
    cacheKey = key;
    return null;
  },
  set: async () => {},
};
service.prisma = {
  studyGroup: {
    findMany: async input => {
      query = input;
      return [];
    },
  },
};

(async () => {
  await service.findAll();
  assert.equal(query.where.privacy, 'public');
  assert.match(cacheKey, /^study_groups:v2:/);
  assert.deepEqual(query.include.members.select, {
    userId: true,
    role: true,
    status: true,
    joinedAt: true,
  });

  await service.findAll({ privacy: 'invite_only' });
  assert.equal(query.where.privacy, 'public');

  await service.findAll({ userId: 'student-1' });
  assert.deepEqual(query.where.members, {
    some: { userId: 'student-1', status: 'active' },
  });
  assert.equal(query.where.privacy, undefined);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
