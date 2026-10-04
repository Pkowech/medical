const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LearningStreaks {
  currentStreak: number;
  longestStreak: number;
}

export function calculateLearningStreaks(
  activityDates: readonly Date[],
  now: Date = new Date(),
): LearningStreaks {
  // UTC day boundaries keep streak calculations independent of server timezone.
  const activityDays = [
    ...new Set(
      activityDates.map(
        (date) =>
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
          MILLISECONDS_PER_DAY,
      ),
    ),
  ].sort((a, b) => b - a);

  if (activityDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const today =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
    MILLISECONDS_PER_DAY;
  let currentStreak = 0;
  let expectedDay =
    activityDays[0] === today
      ? today
      : activityDays[0] === today - 1
        ? today - 1
        : null;

  if (expectedDay !== null) {
    for (const activityDay of activityDays) {
      if (activityDay !== expectedDay) {
        break;
      }
      currentStreak++;
      expectedDay--;
    }
  }

  let longestStreak = 1;
  let consecutiveDays = 1;
  for (let index = 1; index < activityDays.length; index++) {
    if (activityDays[index - 1] - activityDays[index] === 1) {
      consecutiveDays++;
      longestStreak = Math.max(longestStreak, consecutiveDays);
    } else {
      consecutiveDays = 1;
    }
  }

  return { currentStreak, longestStreak };
}
