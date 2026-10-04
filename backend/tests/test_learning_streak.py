import json
import shutil
import subprocess
from pathlib import Path

import pytest


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
