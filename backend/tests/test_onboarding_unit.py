from ts_runtime import run_typescript


def test_onboarding_dto_rejects_unknown_stages_and_out_of_range_years():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CompleteOnboardingDto } =
  require('./src/common/dto/onboarding.dto.ts');

(async () => {
  const invalidStage = plainToInstance(CompleteOnboardingDto, {
    healthcareField: 'pharmacy',
    careerStage: 'resident',
    studyYear: 2,
  });
  const invalidStageErrors = await validate(invalidStage);
  assert(invalidStageErrors.some(error => error.property === 'careerStage'));

  const invalidYear = plainToInstance(CompleteOnboardingDto, {
    healthcareField: 'pharmacy',
    careerStage: 'student',
    studyYear: 7,
  });
  const invalidYearErrors = await validate(invalidYear);
  assert(invalidYearErrors.some(error => error.property === 'studyYear'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_registration_dto_rejects_client_supplied_roles():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { RegisterDto } = require('./src/common/dto/user.dto.ts');

(async () => {
  const registration = plainToInstance(RegisterDto, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    username: 'ada',
    password: 'StrongPass123!',
    confirmPassword: 'StrongPass123!',
    acceptTerms: true,
    role: 'admin',
  });
  const errors = await validate(registration, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  assert(errors.some(error => error.property === 'role'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_profile_dto_accepts_postgraduate_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { UpdateUserDto } = require('./src/common/dto/user.dto.ts');

(async () => {
  const profile = plainToInstance(UpdateUserDto, {
    careerStage: 'postgraduate',
    studyYear: 2,
  });
  const errors = await validate(profile);
  assert.deepEqual(errors, []);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_onboarding_service_rejects_stage_inappropriate_profile_fields():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { OnboardingService } =
  require('./src/modules/engagement-communication/services/onboarding.service.ts');

const service = new OnboardingService(
  {
    user: {
      findUnique: async () => ({ id: 'user-1', preferences: null }),
    },
  },
  {},
);

(async () => {
  await assert.rejects(
    () => service.completeOnboarding('user-1', {
      healthcareField: 'pharmacy',
      careerStage: 'professional',
      studyYear: 2,
      yearOfExperience: 3,
    }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.completeOnboarding('user-1', {
      healthcareField: 'pharmacy',
      careerStage: 'postgraduate',
      yearOfExperience: 2,
    }),
    BadRequestException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_onboarding_path_ranking_honors_specialty_exam_and_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { OnboardingService } =
  require('./src/modules/engagement-communication/services/onboarding.service.ts');

const specialtyPath = {
  id: 'specialty-path',
  title: 'Clinical Pharmacy Review',
  description: '',
  difficulty: 'intermediate',
  estimatedDurationWeeks: 12,
  estimatedHoursPerWeek: 6,
  specialization: 'Clinical Pharmacy',
  targetCareerStages: ['student'],
  pathType: 'STANDARD_STUDY',
  category: { name: 'Pharmacy' },
};
const fieldPath = {
  ...specialtyPath,
  id: 'field-path',
  title: 'Pharmacy Foundations',
  specialization: 'Foundations',
};
const examPath = {
  ...specialtyPath,
  id: 'exam-path',
  title: 'Pharmacy Board Exam Preparation',
  specialization: 'Board Exam',
};

let query;
let profile = {
  healthcareField: 'pharmacy',
  specialization: 'Clinical Pharmacy',
  careerStage: 'student',
  preferences: {},
};
let candidates = [fieldPath, specialtyPath];
const service = new OnboardingService(
  {
    user: { findUnique: async () => profile },
    learningPath: {
      findMany: async args => {
        query = args;
        return candidates;
      },
    },
    learningPathProgress: { findMany: async () => [] },
  },
);

(async () => {
  const specialtyFirst = await service.getSuggestedStarterPaths('user-1', 4);
  assert.deepEqual(
    specialtyFirst.map(path => path.id),
    ['specialty-path', 'field-path'],
  );
  assert.equal(query.where.status, 'published');
  assert.deepEqual(query.where.targetCareerStages, { has: 'student' });

  candidates = [specialtyPath, examPath];
  profile = { ...profile, preferences: { targetExam: 'Board Exam' } };
  const examFirst = await service.getSuggestedStarterPaths('user-1', 4);
  assert.deepEqual(
    examFirst.map(path => path.id),
    ['exam-path', 'specialty-path'],
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_onboarding_path_recommendations_return_empty_without_field_matches():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { OnboardingService } =
  require('./src/modules/engagement-communication/services/onboarding.service.ts');

let queryCount = 0;
const service = new OnboardingService(
  {
    user: {
      findUnique: async () => ({
        healthcareField: 'physiotherapy',
        specialization: null,
        careerStage: 'professional',
        preferences: {},
      }),
    },
    learningPath: {
      findMany: async () => {
        queryCount++;
        return [];
      },
    },
    learningPathProgress: { findMany: async () => [] },
  },
);

(async () => {
  const paths = await service.getSuggestedStarterPaths('user-1', 4);
  assert.deepEqual(paths, []);
  assert.equal(queryCount, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_learning_path_eligibility_rejects_missing_or_mismatched_audiences():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathEligibilityService } =
  require('./src/modules/education/courses/services/learning-path-eligibility.service.ts');

const eligibility = new LearningPathEligibilityService();
const studentPath = { targetCareerStages: ['student'] };

assert.equal(
  eligibility.evaluate(studentPath, { careerStage: 'student' }).eligible,
  true,
);
assert.deepEqual(
  eligibility.evaluate(studentPath, { careerStage: 'professional' }).reasons,
  ['CAREER_STAGE_MISMATCH'],
);
assert.deepEqual(
  eligibility.evaluate({ targetCareerStages: [] }, { careerStage: 'student' }).reasons,
  ['AUDIENCE_UNSPECIFIED'],
);
assert.deepEqual(
  eligibility.evaluate(studentPath, {}).reasons,
  ['CAREER_STAGE_REQUIRED'],
);
"""
    )


def test_personalized_recommendations_filter_analytics_results_by_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');
const { LearningPathEligibilityService } =
  require('./src/modules/education/courses/services/learning-path-eligibility.service.ts');

let query;
const service = new LearningPathsService(
  {
    user: {
      findUnique: async () => ({
        healthcareField: 'pharmacy',
        specialization: null,
        careerStage: 'student',
      }),
    },
    learningPath: {
      findMany: async args => {
        query = args;
        return [{
          id: 'professional-path',
          targetCareerStages: ['professional'],
        }];
      },
    },
  },
  {},
  { getPathRecommendations: async () => [{ pathId: 'professional-path' }] },
  {},
  new LearningPathEligibilityService(),
);

(async () => {
  const paths = await service.getRecommendedPaths('user-1');
  assert.deepEqual(query.where.targetCareerStages, { has: 'student' });
  assert.deepEqual(paths, []);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_personalized_recommendations_preserve_rank_and_fill_from_eligible_paths():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');
const { LearningPathEligibilityService } =
  require('./src/modules/education/courses/services/learning-path-eligibility.service.ts');

let requestedLimit;
const service = new LearningPathsService(
  {
    user: {
      findUnique: async () => ({
        healthcareField: 'pharmacy',
        specialization: null,
        careerStage: 'student',
      }),
    },
    learningPath: {
      findMany: async () => [
        { id: 'eligible-second', targetCareerStages: ['student'] },
        { id: 'eligible-first', targetCareerStages: ['student'] },
      ],
    },
  },
  {},
  {
    getPathRecommendations: async (_userId, limit) => {
      requestedLimit = limit;
      return [
        { pathId: 'professional-only' },
        { pathId: 'eligible-first' },
        { pathId: 'eligible-second' },
      ];
    },
  },
  {},
  new LearningPathEligibilityService(),
);

(async () => {
  const paths = await service.getRecommendedPaths('user-1', 2);
  assert.equal(requestedLimit, 10);
  assert.deepEqual(paths.map(path => path.id), [
    'eligible-first',
    'eligible-second',
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_legacy_and_collaborative_recommendations_filter_by_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathRecommendationsService } =
  require('./src/modules/ai-analytics/services/learning-path-recommendations.service.ts');

const queries = [];
const prisma = {
  user: {
    findUnique: async () => ({ careerStage: 'student' }),
  },
  learningPath: {
    findMany: async args => {
      queries.push(args);
      return [{ id: 'professional-path', targetCareerStages: ['professional'] }];
    },
  },
};
const analytics = {
  getPathRecommendations: async () => [{
    pathId: 'professional-path',
    score: 1,
    reasons: [],
    confidence: 1,
  }],
  getCollaborativeRecommendations: async () => [{
    item_id: 'professional-path',
    score: 1,
    reason: 'similar users',
  }],
};
const redis = { get: async () => null, set: async () => {} };
const service = new LearningPathRecommendationsService(
  prisma,
  analytics,
  {},
  redis,
);

(async () => {
  assert.deepEqual(await service.getRecommendations('user-1'), []);
  assert.deepEqual(await service.getCollaborativeRecommendations('user-1'), []);
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.deepEqual(query.where.targetCareerStages, { has: 'student' });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_enrollment_rejects_a_path_for_another_career_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { LearningPathProgressService } =
  require('./src/modules/education/courses/services/learning-path-progress.service.ts');
const { LearningPathEligibilityService } =
  require('./src/modules/education/courses/services/learning-path-eligibility.service.ts');

let progressCreated = false;
const service = new LearningPathProgressService(
  {
    user: { findUnique: async () => ({ id: 'user-1', careerStage: 'student' }) },
    learningPath: {
      findUnique: async () => ({
        id: 'path-1',
        status: 'published',
        targetCareerStages: ['professional'],
      }),
    },
    learningPathProgress: {
      findFirst: async () => null,
      create: async () => { progressCreated = true; },
    },
  },
  {},
  new LearningPathEligibilityService(),
);

(async () => {
  await assert.rejects(
    () => service.startLearningPath('user-1', { learningPathId: 'path-1' }),
    BadRequestException,
  );
  assert.equal(progressCreated, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_learning_path_enrollment_is_idempotent_and_rechecks_eligibility():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathProgressService } =
  require('./src/modules/education/courses/services/learning-path-progress.service.ts');

const existingProgress = { id: 'progress-1' };
let eligibilityChecks = 0;
const service = new LearningPathProgressService(
  {
    user: { findUnique: async () => ({ id: 'user-1', careerStage: 'student' }) },
    learningPath: {
      findUnique: async () => ({
        id: 'path-1',
        status: 'published',
        targetCareerStages: ['student'],
      }),
    },
    learningPathProgress: {
      findUnique: async () => existingProgress,
      create: async () => {
        throw new Error('Existing enrollment must not create progress again');
      },
    },
  },
  {},
  {
    assertEligible: () => { eligibilityChecks++; },
  },
);

(async () => {
  const first = await service.startLearningPath('user-1', { learningPathId: 'path-1' });
  const second = await service.startLearningPath('user-1', { learningPathId: 'path-1' });
  assert.equal(first, existingProgress);
  assert.equal(second, existingProgress);
  assert.equal(eligibilityChecks, 2);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_published_paths_require_target_career_stages():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');

const service = new LearningPathsService({}, {}, {}, {}, {});

(async () => {
  await assert.rejects(
    () => service.validatePathForPublishing({
      title: 'Path',
      description: 'Description',
      targetCareerStages: [],
      phases: [{ modules: [{ type: 'resource', resourceId: 'resource-1' }] }],
    }),
    /At least one target career stage is required/,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_structural_path_edits_are_rejected_after_enrollment():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');

let pathUpdated = false;
const service = new LearningPathsService(
  {
    learningPath: {
      findUnique: async () => ({ id: 'path-1', createdBy: 'user-1' }),
    },
    $transaction: async callback => callback({
      learningPathProgress: { count: async () => 1 },
      learningPath: {
        update: async () => { pathUpdated = true; },
      },
    }),
  },
  {},
  {},
  {},
  {},
);

(async () => {
  await assert.rejects(
    () => service.update('path-1', {
      pathStructure: {
        phases: [{ id: 'phase-1', title: 'Phase', modules: [] }],
      },
    }, 'user-1'),
    error => error instanceof BadRequestException &&
      /Duplicate the path/.test(error.message),
  );
  assert.equal(pathUpdated, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_onboarding_writes_use_stable_idempotency_keys_in_one_transaction():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { OnboardingService } =
  require('./src/modules/engagement-communication/services/onboarding.service.ts');

const goalUpserts = [];
const activityUpserts = [];
const outboxUpserts = [];
let transactionCount = 0;
const prisma = {
  $transaction: async callback => {
    transactionCount++;
    return callback({
      user: {
        findUnique: async () => ({ id: 'user-1', preferences: null }),
        update: async () => ({}),
      },
      learningGoal: {
        count: async () => 0,
        upsert: async args => { goalUpserts.push(args); },
      },
      userActivity: {
        upsert: async args => { activityUpserts.push(args); },
      },
      applicationOutboxEvent: {
        upsert: async args => { outboxUpserts.push(args); },
      },
    });
  },
  user: {
    findUnique: async () => ({
      id: 'user-1',
      healthcareField: 'pharmacy',
      careerStage: 'student',
      studyYear: 2,
      yearOfExperience: null,
      specialization: null,
      preferences: { onboardingCompleted: true },
    }),
  },
  learningPath: { findMany: async () => [] },
  learningPathProgress: { findMany: async () => [] },
};
const service = new OnboardingService(prisma);

(async () => {
  const dto = {
    healthcareField: 'pharmacy',
    careerStage: 'student',
    studyYear: 2,
  };
  await service.completeOnboarding('user-1', dto);
  await service.completeOnboarding('user-1', dto);

  assert.equal(transactionCount, 2);
  assert.deepEqual(
    goalUpserts.map(call => call.where.sourceKey),
    ['onboarding-starter-goal:user-1', 'onboarding-starter-goal:user-1'],
  );
  assert.deepEqual(
    activityUpserts.map(call => call.where.sourceKey),
    ['onboarding-completed:user-1', 'onboarding-completed:user-1'],
  );
  assert.equal(outboxUpserts.length, 2);
  assert.equal(
    outboxUpserts[1].where.dedupeKey,
    outboxUpserts[0].where.dedupeKey,
  );
  assert.match(outboxUpserts[0].where.dedupeKey, /^[a-f0-9]{64}$/);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_onboarding_preserves_optional_preferences_when_omitted_and_clears_explicitly():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { OnboardingService } =
  require('./src/modules/engagement-communication/services/onboarding.service.ts');

let storedPreferences = {
  institution: 'Kenyatta University',
  targetExam: 'Board Exam',
  dailyGoalMinutes: 60,
};
const prisma = {
  $transaction: async callback => callback({
    user: {
      findUnique: async () => ({ id: 'user-1', preferences: storedPreferences }),
      update: async ({ data }) => {
        storedPreferences = data.preferences;
      },
    },
    learningGoal: { count: async () => 1 },
    userActivity: { upsert: async () => ({}) },
    applicationOutboxEvent: { upsert: async () => ({}) },
  }),
  user: {
    findUnique: async () => ({
      id: 'user-1',
      healthcareField: 'pharmacy',
      careerStage: 'student',
      studyYear: 2,
      yearOfExperience: null,
      specialization: null,
      preferences: storedPreferences,
    }),
  },
  learningPath: { findMany: async () => [] },
  learningPathProgress: { findMany: async () => [] },
};
const service = new OnboardingService(prisma);

(async () => {
  const base = {
    healthcareField: 'pharmacy',
    careerStage: 'student',
    studyYear: 2,
  };
  await service.completeOnboarding('user-1', base);
  assert.equal(storedPreferences.institution, 'Kenyatta University');
  assert.equal(storedPreferences.targetExam, 'Board Exam');
  assert.equal(storedPreferences.dailyGoalMinutes, 60);

  await service.completeOnboarding('user-1', {
    ...base,
    institution: '',
    targetExam: '',
  });
  assert.equal(storedPreferences.institution, null);
  assert.equal(storedPreferences.targetExam, null);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_outbox_dispatch_marks_events_processed_and_scrubs_payload():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ApplicationOutboxProcessor } =
  require('./src/modules/engagement-communication/services/application-outbox.processor.ts');

let claimed = false;
let emitted;
let processedUpdate;
const prisma = {
  $transaction: async callback => callback({
    $queryRaw: async () => {
      if (claimed) return [];
      claimed = true;
      return [{ id: 'event-1' }];
    },
    applicationOutboxEvent: {
      update: async () => ({
        id: 'event-1',
        eventType: 'user.onboarding.completed',
        payload: { userId: 'user-1' },
        attempts: 0,
      }),
    },
  }),
  applicationOutboxEvent: {
    update: async args => { processedUpdate = args; },
  },
};
const processor = new ApplicationOutboxProcessor(prisma, {
  listenerCount: () => 1,
  emitAsync: async (eventType, payload) => { emitted = { eventType, payload }; },
});

(async () => {
  await processor.processPendingEvents();
  assert.deepEqual(emitted, {
    eventType: 'user.onboarding.completed',
    payload: { userId: 'user-1' },
  });
  assert.equal(processedUpdate.where.id, 'event-1');
  assert.ok(processedUpdate.data.processedAt instanceof Date);
  assert.equal(processedUpdate.data.aggregateId, null);
  assert.deepEqual(processedUpdate.data.payload, {});
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_legacy_onboarding_status_does_not_suggest_paths_without_a_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { OnboardingService } =
  require('./src/modules/engagement-communication/services/onboarding.service.ts');

let pathQueries = 0;
const service = new OnboardingService({
  user: {
    findUnique: async () => ({
      id: 'legacy-user',
      healthcareField: 'pharmacy',
      careerStage: null,
      studyYear: null,
      yearOfExperience: null,
      specialization: null,
      preferences: null,
    }),
  },
  learningPath: {
    findMany: async () => {
      pathQueries++;
      return [];
    },
  },
});

(async () => {
  const status = await service.getOnboardingStatus('legacy-user');
  assert.equal(status.isCompleted, false);
  assert.deepEqual(status.suggestedStarterPaths, []);
  assert.equal(pathQueries, 0);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_path_deletion_preserves_completed_learner_progress():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');

let pathDeleted = false;
const service = new LearningPathsService(
  {
    learningPath: {
      findUnique: async () => ({
        id: 'path-1',
        createdBy: 'owner-1',
        phases: [],
        milestones: [],
        _count: { progress: 1 },
      }),
    },
    $transaction: async callback => callback({
      learningPathProgress: {
        count: async args => {
          assert.deepEqual(args.where, { learningPathId: 'path-1' });
          return 1;
        },
      },
      learningPathPhase: { findMany: async () => [] },
      learningPath: { delete: async () => { pathDeleted = true; } },
    }),
  },
  {},
  {},
  {},
  {},
);

(async () => {
  await assert.rejects(
    () => service.remove('path-1', 'owner-1'),
    error => error instanceof BadRequestException &&
      /learner progress/.test(error.message),
  );
  assert.equal(pathDeleted, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_structural_path_edits_preserve_relational_phase_progress():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');

let phasesDeleted = false;
const service = new LearningPathsService(
  {
    learningPath: {
      findUnique: async () => ({
        id: 'path-1',
        createdBy: 'owner-1',
        phases: [],
        milestones: [],
        _count: { progress: 0 },
      }),
    },
    $transaction: async callback => callback({
      learningPathProgress: { count: async () => 0 },
      learningPathPhase: {
        findMany: async () => [{ id: 'phase-1', modules: [{ id: 'module-1' }] }],
        deleteMany: async () => { phasesDeleted = true; },
      },
      learningPathPhaseProgress: { count: async () => 1 },
      learningPathModuleProgress: { count: async () => 0 },
      learningPath: { update: async () => assert.fail('path must not update') },
    }),
  },
  {},
  {},
  {},
  {},
);

(async () => {
  await assert.rejects(
    () => service.update('path-1', {
      pathStructure: {
        phases: [{ id: 'phase-2', title: 'Revised', modules: [] }],
      },
    }, 'owner-1'),
    error => error instanceof BadRequestException &&
      /learners have progress/.test(error.message),
  );
  assert.equal(phasesDeleted, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_outbox_does_not_ack_events_without_a_consumer():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ApplicationOutboxProcessor } =
  require('./src/modules/engagement-communication/services/application-outbox.processor.ts');

let claimed = false;
let emitted = false;
let retryUpdate;
const prisma = {
  $transaction: async callback => callback({
    $queryRaw: async () => {
      if (claimed) return [];
      claimed = true;
      return [{ id: 'event-1' }];
    },
    applicationOutboxEvent: {
      update: async () => ({
        id: 'event-1',
        eventType: 'unhandled.event',
        payload: { userId: 'user-1' },
        attempts: 0,
      }),
    },
  }),
  applicationOutboxEvent: {
    update: async args => { retryUpdate = args; },
  },
};
const processor = new ApplicationOutboxProcessor(prisma, {
  listenerCount: () => 0,
  emitAsync: async () => { emitted = true; },
});
processor.logger = { error: () => {} };

(async () => {
  await processor.processPendingEvents();
  assert.equal(emitted, false);
  assert.equal(retryUpdate.where.id, 'event-1');
  assert.equal(retryUpdate.data.attempts.increment, 1);
  assert.equal(retryUpdate.data.lockedAt, null);
  assert.equal(retryUpdate.data.processedAt, undefined);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_onboarding_completion_listener_uses_an_idempotent_analytics_event():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { OnboardingCompletedListener } =
  require('./src/modules/ai-analytics/services/onboarding-completed.listener.ts');

let tracked;
const listener = new OnboardingCompletedListener({
  trackEvent: async (...args) => { tracked = args; },
});

(async () => {
  await listener.handle({
    userId: 'user-1',
    timestamp: '2026-11-11T12:00:00.000Z',
    data: {
      healthcareField: 'pharmacy',
      careerStage: 'student',
      institution: 'not copied to analytics',
    },
  });
  assert.deepEqual(tracked, [
    'user-1',
    'user.onboarding.completed',
    { healthcareField: 'pharmacy', careerStage: 'student' },
    '2026-11-11T12:00:00.000Z',
    'onboarding-completed:user-1:2026-11-11T12:00:00.000Z',
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_analytics_event_source_key_uses_a_unique_upsert():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AiAnalyticsService } =
  require('./src/modules/ai-analytics/services/ai-analytics.service.ts');

let upsertArgs;
const service = Object.create(AiAnalyticsService.prototype);
service.prisma = {
  studyEvent: {
    upsert: async args => {
      upsertArgs = args;
      return { id: 'event-1' };
    },
    create: async () => assert.fail('idempotent event must upsert'),
  },
};
service.invalidateUserCaches = async () => {};
service.logger = { error: () => {} };

(async () => {
  await service.trackEvent(
    'user-1',
    'user.onboarding.completed',
    { careerStage: 'student' },
    '2026-11-11T12:00:00.000Z',
    'onboarding-completed:user-1:2026-11-11T12:00:00.000Z',
  );
  assert.equal(
    upsertArgs.where.sourceKey,
    'onboarding-completed:user-1:2026-11-11T12:00:00.000Z',
  );
  assert.equal(upsertArgs.create.eventType, 'user.onboarding.completed');
  assert.deepEqual(upsertArgs.update, {});
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
