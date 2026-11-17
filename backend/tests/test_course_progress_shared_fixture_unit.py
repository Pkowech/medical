import json
from pathlib import Path

from ts_runtime import run_typescript


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared_fixtures"
    / "course-progress-history.json"
)


def test_database_course_progress_matches_shared_cross_service_history():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    run_typescript(
        f"""
const assert = require('node:assert/strict');
const {{ ProgressService }} =
  require('./src/modules/education/courses/services/progress.service.ts');
const fixture = {json.dumps(fixture)};
const service = Object.create(ProgressService.prototype);
const unitQueries = [];
service.prisma = {{
  unit: {{
    findMany: async query => {{
      unitQueries.push(query);
      return fixture.units.map(unit => ({{
        id: unit.id,
        topics: unit.topics.filter(topic => topic.status === 'published'),
      }}));
    }},
  }},
  progress: {{
    findMany: async query => {{
      if (query.where.materialId?.in) return [];
      if (query.where.topicId?.not === null) return fixture.topicProgress;
      return fixture.unitProgress;
    }},
  }},
  material: {{ findMany: async () => [] }},
}};
service.logger = {{ warn: () => {{}} }};

(async () => {{
  const result = await service.calculateCourseProgressFromDatabase(
    fixture.userId,
    fixture.courseId,
  );
  assert.deepEqual(unitQueries[0].select.topics.where, {{ status: 'published' }});
  assert.deepEqual(
    {{
      percentage: result.percentage,
      completedUnits: result.completedUnits,
      totalUnits: result.totalUnits,
    }},
    {{
      percentage: fixture.expected.percentage,
      completedUnits: fixture.expected.completedUnits,
      totalUnits: fixture.expected.totalUnits,
    }},
  );

  service.courseAnalyticsService = {{
    calculateCourseProgress: async () => ({{
      progressPercentage: 0,
      completedUnits: 0,
      totalUnits: fixture.units.length,
    }}),
  }};
  const liveProgress = await service.calculateCourseProgress(
    fixture.userId,
    fixture.courseId,
  );
  assert.equal(liveProgress.percentage, fixture.expected.percentage);

  const enrollments = [0, 1, 100].map(percentage => ({{
    userId: fixture.userId,
    courseId: `course-${{percentage}}`,
    enrolledAt: new Date(),
    course: {{ id: `course-${{percentage}}`, title: 'Course', name: 'Course' }},
    percentage,
  }}));
  service.prisma.courseEnrollment = {{
    findMany: async () => enrollments,
  }};
  service.redisService = {{ get: async () => null, set: async () => undefined }};
  service.calculateCourseProgress = async (_userId, courseId) => ({{
    percentage: Number(courseId.split('-').at(-1)),
    completedUnits: 0,
    totalUnits: 1,
  }});
  const statusResults = await service.getCourseProgress(fixture.userId);
  assert.deepEqual(
    statusResults.map(course => course.status),
    ['notStarted', 'inProgress', 'completed'],
  );
}})().catch(error => {{
  console.error(error);
  process.exitCode = 1;
}});
"""
    )
