from ts_runtime import run_typescript


def test_learning_path_queries_hide_unpublished_paths_from_other_users():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');
const service = Object.create(LearningPathsService.prototype);
const draft = {
  id: 'draft-path',
  status: 'draft',
  createdBy: 'owner-1',
  phases: [],
  milestones: [],
};
let listQuery;
service.prisma = {
  learningPath: {
    findUnique: async () => draft,
    findMany: async query => {
      listQuery = query;
      return [];
    },
  },
};

(async () => {
  await assert.rejects(service.findOne('draft-path', 'other-user'), /not found/i);
  const ownerPath = await service.findOne('draft-path', 'owner-1');
  assert.equal(ownerPath.id, 'draft-path');

  await service.findAll({}, 'other-user');
  assert.deepEqual(listQuery.where.AND[1].OR, [
    { status: 'published' },
    { createdBy: 'other-user' },
  ]);
  await service.findAll({});
  assert.deepEqual(listQuery.where.AND[1], { status: 'published' });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_reducing_completed_goal_progress_reopens_goal_and_clears_completion():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningGoalsService } =
  require('./src/modules/education/courses/services/learning-goals.service.ts');

const service = Object.create(LearningGoalsService.prototype);
const goal = {
  id: 'goal-1',
  userId: 'user-1',
  status: 'completed',
  progress: 100,
  completedAt: new Date(),
  metadata: {},
};
let updatedGoal;
service.prisma = {
  learningGoal: {
    findFirst: async () => goal,
    update: async ({ data }) => {
      updatedGoal = data;
      return { ...goal, ...data };
    },
  },
};
service.eventEmitter = { emit: () => {} };

(async () => {
  await service.update('goal-1', { progressPercentage: 40 }, 'user-1');
  assert.equal(updatedGoal.progress, 40);
  assert.equal(updatedGoal.status, 'inProgress');
  assert.equal(updatedGoal.completedAt, null);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
