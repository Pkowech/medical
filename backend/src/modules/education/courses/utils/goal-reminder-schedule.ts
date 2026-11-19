export interface GoalReminderSettings {
  enabled?: boolean;
  frequency?: string;
  time?: string;
  timezone?: string;
  daysOfWeek?: number[];
  intervalDays?: number;
  customSchedule?: Array<{ date: string | Date; time: string }>;
}

export interface ReminderLocalTime {
  date: string;
  time: string;
  weekday: number;
}

export function getReminderLocalTime(
  date: Date,
  timezone: string,
): ReminderLocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const weekday = part('weekday');
  const hour = part('hour');
  const minute = part('minute');
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (!year || !month || !day || !weekday || !hour || !minute) {
    throw new Error('Could not resolve the local time for the configured timezone.');
  }

  const weekdayIndex = weekdays.indexOf(weekday);
  if (weekdayIndex < 0) {
    throw new Error('Could not resolve the weekday for the configured timezone.');
  }

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    weekday: weekdayIndex,
  };
}

export function isGoalReminderDue(
  settings: GoalReminderSettings,
  now: Date,
  timezone: string,
  startDate?: Date | null,
  targetDate?: Date | null,
): boolean {
  if (!settings.enabled) return false;
  if (!settings.frequency || !settings.time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.time)) {
    throw new Error('Enabled goal reminders require a valid time and frequency.');
  }

  const localNow = getReminderLocalTime(now, timezone);
  if (localNow.time !== settings.time) return false;

  const startDay = startDate?.toISOString().slice(0, 10);
  const targetDay = targetDate?.toISOString().slice(0, 10);
  if (startDay && localNow.date < startDay) return false;
  if (targetDay && localNow.date > targetDay) return false;

  switch (settings.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      if (!settings.daysOfWeek?.length) {
        throw new Error('Weekly goal reminders require at least one reminder day.');
      }
      return settings.daysOfWeek.includes(localNow.weekday);
    case 'custom': {
      if (settings.customSchedule?.length) {
        return settings.customSchedule.some(schedule => {
          const date =
            schedule.date instanceof Date
              ? schedule.date.toISOString().slice(0, 10)
              : schedule.date.slice(0, 10);
          return date === localNow.date && schedule.time === settings.time;
        });
      }
      const intervalDays = settings.intervalDays;
      if (
        typeof intervalDays !== 'number' ||
        !Number.isInteger(intervalDays) ||
        intervalDays < 1 ||
        intervalDays > 365
      ) {
        throw new Error('Custom goal reminders require an interval between 1 and 365 days.');
      }
      if (!startDay || localNow.date < startDay) return false;
      const start = Date.parse(`${startDay}T00:00:00.000Z`);
      const today = Date.parse(`${localNow.date}T00:00:00.000Z`);
      const elapsedDays = Math.floor((today - start) / 86_400_000);
      return elapsedDays % intervalDays === 0;
    }
    default:
      throw new Error(`Unsupported goal reminder frequency: ${settings.frequency}`);
  }
}
