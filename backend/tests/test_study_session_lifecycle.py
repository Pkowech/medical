from ts_runtime import run_typescript


def response_payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_short_study_session_is_not_counted_as_learning_activity(
    user_factory,
):
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    base_url = user_factory.base_url
    session = user_factory.session

    start_response = session.post(
        f"{base_url}/study/session/start",
        headers=headers,
        json={},
        timeout=30,
    )
    assert start_response.status_code == 201, start_response.text
    started = response_payload(start_response)

    end_response = session.put(
        f"{base_url}/study/session/{started['id']}/end",
        headers=headers,
        json={"activities": [], "durationSeconds": 0},
        timeout=30,
    )
    assert end_response.status_code == 200, end_response.text
    ended = response_payload(end_response)

    assert ended["id"] == started["id"]
    assert ended["duration"] == 0
    assert ended["isValid"] is False
    assert ended["invalidReason"]

    activity_response = session.get(
        f"{base_url}/progress/activities",
        headers=headers,
        timeout=30,
    )
    assert activity_response.status_code == 200, activity_response.text
    activities = response_payload(activity_response)
    assert not any(
        (activity.get("details") or {}).get("sessionId") == started["id"]
        for activity in activities
    )

    dashboard_response = session.get(
        f"{base_url}/progress/dashboard/{student['id']}",
        headers=headers,
        timeout=30,
    )
    assert dashboard_response.status_code == 200, dashboard_response.text
    dashboard = response_payload(dashboard_response)
    assert dashboard["streaks"]["currentStreak"] == 0
    assert dashboard["streaks"]["longestStreak"] == 0


def test_ending_a_study_session_twice_does_not_change_its_outcome(user_factory):
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    base_url = user_factory.base_url
    session = user_factory.session

    start_response = session.post(
        f"{base_url}/study/session/start",
        headers=headers,
        json={},
        timeout=30,
    )
    assert start_response.status_code == 201, start_response.text
    started = response_payload(start_response)

    first_end_response = session.put(
        f"{base_url}/study/session/{started['id']}/end",
        headers=headers,
        json={"activities": [], "durationSeconds": 0},
        timeout=30,
    )
    assert first_end_response.status_code == 200, first_end_response.text
    first_end = response_payload(first_end_response)

    second_end_response = session.put(
        f"{base_url}/study/session/{started['id']}/end",
        headers=headers,
        json={"activities": [], "durationSeconds": 600},
        timeout=30,
    )
    assert second_end_response.status_code == 200, second_end_response.text
    second_end = response_payload(second_end_response)

    assert second_end["id"] == first_end["id"]
    assert second_end["endTime"] == first_end["endTime"]
    assert second_end["duration"] == first_end["duration"]
    assert second_end["isValid"] is first_end["isValid"]


def test_study_session_duration_is_not_written_to_topic_progress():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { StudyService } =
  require('./src/modules/education/courses/services/study.service.ts');
const service = Object.create(StudyService.prototype);
const session = {
  id: 'session-1',
  userId: 'user-1',
  startTime: new Date(Date.now() - 10 * 60 * 1000),
  topicId: null,
  materialId: null,
  topic: null,
};
let savedSession;
service.prisma = {
  studySession: {
    findFirst: async () => session,
  },
  $transaction: async callback => callback({
    studySession: {
      update: async ({ data }) => {
        savedSession = { ...session, ...data };
        return savedSession;
      },
    },
    userActivity: { upsert: async () => ({}) },
    applicationOutboxEvent: { upsert: async () => ({}) },
  }),
};
service.progressService = {
  invalidateUserProgressCache: async () => {},
};
service.logger = { log: () => {} };

(async () => {
  const result = await service.endStudySession(
    'user-1',
    'session-1',
    [],
    undefined,
    300,
    0,
  );
  assert.equal(result.duration, 5);
  assert.equal(result.isValid, true);
  assert.equal(savedSession.duration, 5);
  assert.equal('progress' in service.prisma, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_material_read_sets_content_completion_consistently():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');
const service = Object.create(ProgressService.prototype);
let createdProgress;
let createdActivities = [];
service.prisma = {
  material: {
    findUnique: async () => ({ id: 'material-1', unitId: 'unit-1', topicId: 'topic-1' }),
  },
  unit: {
    findUnique: async () => ({ id: 'unit-1', courseId: 'course-1' }),
  },
  $transaction: async callback => callback({
    progress: {
      findFirst: async () => null,
      create: async ({ data }) => {
        createdProgress = data;
        return { id: 'progress-1', ...data };
      },
    },
    userActivity: {
      createMany: async ({ data, skipDuplicates }) => {
        createdActivities.push(...data);
        assert.equal(skipDuplicates, true);
        return { count: data.length };
      },
    },
  }),
};

(async () => {
  service.clearCache = async () => {};
  service.calculateCourseProgress = async () => null;
  service.events = { emit: () => {} };
  service.logger = { log: () => {} };
  const occurredAt = new Date('2026-11-11T12:00:00.000Z');
  await service.markMaterialAsRead(
    'user-1',
    'material-1',
    BigInt(occurredAt.getTime()),
    'read-1',
  );
  assert.equal(createdProgress.isCompleted, true);
  assert.equal(createdProgress.status, 'completed');
  assert.equal(createdProgress.progressPercentage, 100);
  assert.equal(createdProgress.completionPercentage, 100);
  assert.equal(createdActivities[0].sourceKey, 'material-read:user-1:read-1');
  assert.equal(createdActivities[0].createdAt.toISOString(), occurredAt.toISOString());
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_progress_sync_retry_with_same_idempotency_key_is_a_no_op():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');
const service = Object.create(ProgressService.prototype);
const sourceKeys = new Set();
let progressCreates = 0;
let analyticsEvents = 0;
service.prisma = {
  $transaction: async callback => callback({
    userActivity: {
      createMany: async ({ data }) => {
        const [activity] = data;
        if (sourceKeys.has(activity.sourceKey)) return { count: 0 };
        sourceKeys.add(activity.sourceKey);
        return { count: 1 };
      },
    },
    topic: { findUnique: async () => ({ id: 'topic-1' }) },
    progress: {
      findFirst: async () => null,
      create: async ({ data }) => {
        progressCreates += 1;
        return { id: 'progress-1', ...data };
      },
    },
  }),
};

(async () => {
  service.clearCache = async () => {};
  service.logger = { log: () => {} };
  service.aiAnalyticsService = {
    trackEvent: async () => { analyticsEvents += 1; },
  };
  const update = {
    topicId: 'topic-1',
    timeSpent: 12,
    idempotencyKey: 'offline-item-1',
  };
  await service.updateUnitMaterialTopicProgress('user-1', update);
  await service.updateUnitMaterialTopicProgress('user-1', update);
  assert.equal(progressCreates, 1);
  assert.equal(sourceKeys.size, 1);
  assert.equal(analyticsEvents, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_study_time_summary_uses_only_valid_completed_sessions():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');
const service = Object.create(ProgressService.prototype);
const now = new Date();
const today = new Date(now);
today.setUTCHours(0, 0, 0, 0);
const sessionEnd = new Date(today.getTime() + 60 * 60 * 1000);
service.prisma = {
  studySession: {
    aggregate: async ({ where }) => {
      assert.deepEqual(where, {
        userId: 'user-1',
        isValid: true,
        endTime: { not: null },
      });
      return { _sum: { duration: 42 } };
    },
    findMany: async ({ where }) => {
      assert.equal(where.userId, 'user-1');
      assert.equal(where.isValid, true);
      assert.equal(where.endTime.gte < where.endTime.lt, true);
      return [{ duration: 42, endTime: sessionEnd }];
    },
  },
};

(async () => {
  const summary = await service.getStudyTimeSummary('user-1');
  assert.equal(summary.totalMinutes, 42);
  assert.equal(summary.weeklyStudyTime.at(-1).minutes, 42);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
