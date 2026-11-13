import json
import shutil
import subprocess
from pathlib import Path

import pytest

from ts_runtime import run_typescript

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def streak_results() -> dict[str, dict[str, int]]:
    probe = r'''import { calculateLearningStreaks } from "./src/modules/education/courses/utils/learning-streak.ts";
const utcDate = (day: number) => new Date(Date.UTC(2026, 9, day, 12));
const today = utcDate(4);
console.log(JSON.stringify({
  todayWithDuplicates: calculateLearningStreaks([utcDate(4), utcDate(4), utcDate(3), utcDate(2)], today),
  yesterday: calculateLearningStreaks([utcDate(3), utcDate(2), utcDate(1)], today),
  missedDay: calculateLearningStreaks([utcDate(1), utcDate(2), utcDate(4)], today),
  noActivity: calculateLearningStreaks([], today),
}));'''
    completed = subprocess.run(
        [
            shutil.which("node") or "node",
            str(BACKEND_DIR / "node_modules" / "tsx" / "dist" / "cli.mjs"),
            "--eval",
            probe,
        ],
        cwd=BACKEND_DIR,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def test_counts_streak_ending_today_and_ignores_duplicate_activity(
    streak_results: dict[str, dict[str, int]],
) -> None:
    assert streak_results["todayWithDuplicates"] == {
        "currentStreak": 3,
        "longestStreak": 3,
    }


def test_keeps_streak_active_when_latest_activity_was_yesterday(
    streak_results: dict[str, dict[str, int]],
) -> None:
    assert streak_results["yesterday"] == {
        "currentStreak": 3,
        "longestStreak": 3,
    }


def test_resets_current_streak_after_missed_day_and_retains_longest(
    streak_results: dict[str, dict[str, int]],
) -> None:
    assert streak_results["missedDay"] == {
        "currentStreak": 1,
        "longestStreak": 2,
    }


def test_returns_zero_streaks_without_learning_activity(
    streak_results: dict[str, dict[str, int]],
) -> None:
    assert streak_results["noActivity"] == {
        "currentStreak": 0,
        "longestStreak": 0,
    }


def test_quiz_attempts_are_included_in_user_streaks() -> None:
    probe = r'''import { ProgressService } from "./src/modules/education/courses/services/progress.service.ts";
const service = Object.create(ProgressService.prototype);
let queriedTypes: string[] = [];
service.logger = { debug() {}, error() {} };
service.prisma = {
  userActivity: {
    findMany: async ({ where }: { where: { type: { in: string[] } } }) => {
      queriedTypes = where.type.in;
      return [{ createdAt: new Date() }];
    },
  },
};
(async () => {
  const streaks = await service.getUserStreaks("user-1");
  console.log(JSON.stringify({ streaks, queriedTypes }));
})();'''
    completed = subprocess.run(
        [
            shutil.which("node") or "node",
            str(BACKEND_DIR / "node_modules" / "tsx" / "dist" / "cli.mjs"),
            "--eval",
            probe,
        ],
        cwd=BACKEND_DIR,
        check=True,
        capture_output=True,
        text=True,
    )
    result = json.loads(completed.stdout)
    assert "QUIZ_ATTEMPT" in result["queriedTypes"]
    assert "LEARNING" in result["queriedTypes"]
    assert "LOGIN" not in result["queriedTypes"]
    assert result["streaks"]["currentStreak"] == 1


def test_backend_streak_matches_shared_utc_activity_history() -> None:
    fixture_path = BACKEND_DIR.parent / "shared_fixtures" / "learning-activity-history.json"
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    run_typescript(
        f"""
const assert = require('node:assert/strict');
const {{ ProgressService }} =
  require('./src/modules/education/courses/services/progress.service.ts');
const fixture = {json.dumps(fixture)};
const service = Object.create(ProgressService.prototype);
const expectedDbTypes = [
  'LEARNING',
  'QUIZ_ATTEMPT',
  'STUDY_SESSION',
  'FLASHCARD_REVIEW',
  'FLASHCARD_SESSION',
];
service.logger = {{ debug: () => {{}}, error: () => {{}} }};
service.prisma = {{
  userActivity: {{
    findMany: async ({{ where }}) => {{
      assert.deepEqual(where.type.in, expectedDbTypes);
      const allowed = new Set(fixture.qualifyingTypes);
      return fixture.activities
        .filter(activity => allowed.has(activity.type))
        .map(activity => ({{ createdAt: new Date(activity.createdAt) }}));
    }},
  }},
}};

(async () => {{
  const result = await service.getUserStreaks(
    fixture.userId,
    new Date(fixture.now),
  );
  assert.deepEqual(
    {{ currentStreak: result.currentStreak, longestStreak: result.longestStreak }},
    fixture.expected,
  );
}})().catch(error => {{
  console.error(error);
  process.exitCode = 1;
}});
"""
    )
