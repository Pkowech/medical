from ts_runtime import run_typescript


def test_course_overview_uses_active_enrollments_and_valid_study_sessions():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { CoursesService } =
  require('./src/modules/education/courses/services/courses.service.ts');

let enrollmentQuery;
let studySessionQuery;
const service = Object.create(CoursesService.prototype);
service.prisma = {
  courseEnrollment: {
    findMany: async query => {
      enrollmentQuery = query;
      return [
        { status: 'active' },
        { status: 'completed' },
      ];
    },
  },
  studySession: {
    aggregate: async query => {
      studySessionQuery = query;
      return { _sum: { duration: 95 } };
    },
  },
  quizAttempt: { findMany: async () => [] },
  userActivity: { findMany: async () => [] },
};
service.logger = { log: () => {}, error: () => {} };

(async () => {
  const stats = await service.getUserCourseStats('student-1');
  assert.deepEqual(enrollmentQuery.where.status.in, ['active', 'completed']);
  assert.deepEqual(studySessionQuery.where, {
    userId: 'student-1',
    isValid: true,
    endTime: { not: null },
  });
  assert.equal(stats.totalEnrolled, 2);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.hoursSpent, 1.6);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
