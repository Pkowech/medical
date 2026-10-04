import { calculateLearningStreaks } from './learning-streak';

const utcDate = (day: number) => new Date(Date.UTC(2026, 9, day, 12));

describe('calculateLearningStreaks', () => {
  const today = utcDate(4);

  it('counts a streak ending today and ignores duplicate activity on a day', () => {
    expect(
      calculateLearningStreaks(
        [utcDate(4), utcDate(4), utcDate(3), utcDate(2)],
        today,
      ),
    ).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('keeps a streak active when the latest activity was yesterday', () => {
    expect(
      calculateLearningStreaks([utcDate(3), utcDate(2), utcDate(1)], today),
    ).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('resets the current streak after a missed day but retains the longest', () => {
    expect(
      calculateLearningStreaks(
        [utcDate(1), utcDate(2), utcDate(4)],
        today,
      ),
    ).toEqual({ currentStreak: 1, longestStreak: 2 });
  });

  it('returns zero streaks when there is no learning activity', () => {
    expect(calculateLearningStreaks([], today)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });
});
