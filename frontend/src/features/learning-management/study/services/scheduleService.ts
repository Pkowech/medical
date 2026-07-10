import { apiService } from '@/features/auth/services/apiClient';
import type { ScheduleEvent } from '@/shared/types/studyInterface';
export type { ScheduleEvent as Event };
export type { ScheduleEvent };

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Serialize errors safely for logging so we show useful fields
 * (message, stack, status, code, details, rawResponse) instead of
 * printing an often-empty object.
 */
function serializeError(err: unknown): Record<string, unknown> {
  const e = err as any;
  const out: Record<string, unknown> = {};
  try {
    out.message = e?.message ?? (typeof e === 'string' ? e : String(e));
    if (e?.stack) out.stack = e.stack;
    if (e?.status) out.status = e.status;
    if (e?.code) out.code = e.code;
    if (e?.details) out.details = e.details;
    if (e?.rawResponse) out.rawResponse = e.rawResponse;
    // include enumerable keys for debugging
    try { out.keys = Object.keys(e || {}); } catch {}
  } catch {
    out.message = String(err);
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const parseDate = (dateVal: unknown): Date | null => {
  if (dateVal == null) return null;
  const d = new Date(dateVal as Date | string | number);
  return isNaN(d.getTime()) ? null : d;
};

const safeString = (val: unknown, fallback = ''): string => {
  if (val == null) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
};

const scheduleService = {
  async getSessions(userId?: string, _startDate?: Date, _endDate?: Date): Promise<ScheduleEvent[]> {
    try {
      const [events, studySessions, goals, groups, deadlines] = await Promise.all([
        this.getRawEvents(_startDate, _endDate),
        this.getStudySessions(userId, _startDate, _endDate),
        this.getGoals(userId, _startDate, _endDate),
        this.getStudyGroups(_startDate, _endDate),
        this.getDeadlines(userId, _startDate, _endDate),
      ]);

      const allMerged = [...events, ...studySessions, ...goals, ...groups, ...deadlines];
      
      // Deduplicate by ID to prevent React key collision errors
      const seen = new Set<string>();
      const deduplicated = allMerged.filter(ev => {
        if (!ev.id) return true; // Keep items without ID (though they should have one)
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      });

      console.warn(
        `scheduleService: Total merged: ${allMerged.length}, Deduplicated: ${deduplicated.length} (ScheduleEvents: ${events.length}, Sessions: ${studySessions.length}, Goals: ${goals.length}, Groups: ${groups.length}, Deadlines: ${deadlines.length})`,
      );
      return deduplicated;
    } catch (error) {
      console.error('Error fetching merged sessions:', error);
      return [];
    }
  },

  async getDeadlines(userId?: string, _startDate?: Date, _endDate?: Date): Promise<ScheduleEvent[]> {
    try {
      const endpoint = '/study/deadlines';
      const response = await apiService.get(endpoint);
      const raw = response as unknown;
      const maybeData = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : undefined;
      const data = Array.isArray(raw) ? (raw as unknown[]) : Array.isArray(maybeData) ? (maybeData as unknown[]) : maybeData ? [maybeData] as unknown[] : [];

      return data
        .map((deadline: unknown) => {
          const d = deadline as { [k: string]: unknown };
          const parsedDate = parseDate(d.dueDate ?? d.date);
          if (!parsedDate) return null;

          if (_startDate && parsedDate < _startDate) return null;
          if (_endDate && parsedDate > _endDate) return null;

          return {
            id: safeString(d.id),
            title: `Deadline: ${safeString(d.title)}`,
            description: safeString(d.description ?? ''),
            date: parsedDate,
            endDate: parsedDate,
            type: safeString(d.type, 'exam'),
            location: 'Academic Portal',
            completed: !!d.completed,
          } as ScheduleEvent;
        })
        .filter(Boolean) as ScheduleEvent[];
    } catch (error) {
      console.error('Error fetching deadlines:', serializeError(error));
      return [];
    }
  },

  async getRawEvents(_startDate?: Date, _endDate?: Date): Promise<ScheduleEvent[]> {
    try {
      let url = '/events';
      if (_startDate && _endDate) {
        url += `?startDate=${_startDate.toISOString()}&endDate=${_endDate.toISOString()}`;
      }
      const response = await apiService.get(url);
      const raw = response as unknown;
      const maybeData = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : undefined;
      const data = Array.isArray(raw) ? (raw as unknown[]) : Array.isArray(maybeData) ? (maybeData as unknown[]) : maybeData ? [maybeData] as unknown[] : [];

      return data
        .map((session: unknown) => {
          const s = session as { [k: string]: unknown };
          const dateRaw = s.date ?? s.startDate;
          const endDateRaw = s.endDate;
          const parsedDate = parseDate(dateRaw);
          if (!parsedDate) return null;

          const metadata = (s.metadata as { completed?: unknown }) || {};

          return {
            id: safeString(s.id),
            title: safeString(s.title, 'Untitled ScheduleEvent'),
            description: safeString(s.description ?? s.notes ?? ''),
            date: parsedDate,
            endDate: parseDate(endDateRaw) ?? new Date(parsedDate.getTime() + 3600000),
            type: safeString(s.type, 'study'),
            location: safeString(s.location, ''),
            instructor: (typeof s.instructor === 'string' ? s.instructor : null),
            completed: !!metadata.completed,
          } as ScheduleEvent;
        })
        .filter(Boolean) as ScheduleEvent[];
    } catch (error) {
      console.error('Error fetching raw events:', serializeError(error));
      return [];
    }
  },

  async getStudySessions(userId?: string, _startDate?: Date, _endDate?: Date): Promise<ScheduleEvent[]> {
    try {
      let url = '/study/sessions';
      if (_startDate && _endDate) {
        url += `?startDate=${_startDate.toISOString()}&endDate=${_endDate.toISOString()}`;
      }
      const response = await apiService.get(url);
      const raw = response as unknown;
      const maybeData = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : undefined;
      const data = Array.isArray(raw) ? (raw as unknown[]) : Array.isArray(maybeData) ? (maybeData as unknown[]) : maybeData ? [maybeData] as unknown[] : [];

      return data
        .map((session: unknown) => {
          const s = session as { [k: string]: unknown };
          const parsedDate = parseDate(s.startTime ?? s.startDate);
          if (!parsedDate) return null;

          const duration = typeof s.duration === 'number' ? s.duration : Number(s.duration ?? 60);

          const topicTitle = (s.topic && typeof s.topic === 'object') ? (s.topic as { title?: unknown }).title : undefined;
          return {
            id: safeString(s.id),
            title: safeString(topicTitle ?? 'Study Session'),
            description: safeString(s.notes ?? ''),
            date: parsedDate,
            endDate: parseDate(s.endTime) ?? new Date(parsedDate.getTime() + duration * 60000),
            type: 'study',
            location: 'Virtual Classroom',
            completed: !!s.endTime,
          } as ScheduleEvent;
        })
        .filter(Boolean) as ScheduleEvent[];
    } catch (error) {
      console.error('Error fetching study sessions:', serializeError(error));
      return [];
    }
  },

  async getGoals(userId?: string, _startDate?: Date, _endDate?: Date): Promise<ScheduleEvent[]> {
    try {
      const response = await apiService.get('/learning-goals');
      const raw = response as unknown;
      const maybeData = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : undefined;
      const data = Array.isArray(raw) ? (raw as unknown[]) : Array.isArray(maybeData) ? (maybeData as unknown[]) : maybeData ? [maybeData] as unknown[] : [];

      return data
        .map((goal: unknown) => {
          const g = goal as { [k: string]: unknown };
          const parsedDate = parseDate(g.targetDate ?? g.startDate);
          if (!parsedDate) return null;

          if (_startDate && parsedDate < _startDate) return null;
          if (_endDate && parsedDate > _endDate) return null;

          return {
            id: safeString(g.id),
            title: `Goal: ${safeString(g.title)}`,
            description: safeString(g.description ?? ''),
            date: parsedDate,
            endDate: parsedDate,
            type: 'goal',
            location: safeString(g.category, 'Personal'),
            completed: safeString(g.status) === 'completed',
          } as ScheduleEvent;
        })
        .filter(Boolean) as ScheduleEvent[];
    } catch (error) {
      console.error('Error fetching learning goals:', serializeError(error));
      return [];
    }
  },

  async getStudyGroups(_startDate?: Date, _endDate?: Date): Promise<ScheduleEvent[]> {
    try {
      const response = await apiService.get('/study-groups/my-groups');
      const raw = response as unknown;
      const maybeData = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : undefined;
      const data = Array.isArray(raw) ? (raw as unknown[]) : Array.isArray(maybeData) ? (maybeData as unknown[]) : maybeData ? [maybeData] as unknown[] : [];

      return data
        .map((group: unknown) => {
          const g = group as { [k: string]: unknown };
          const parsedDate = parseDate(g.nextMeeting);
          if (!parsedDate) return null;

          if (_startDate && parsedDate < _startDate) return null;
          if (_endDate && parsedDate > _endDate) return null;

          return {
            id: safeString(g.id),
            title: `Group: ${safeString(g.name)}`,
            description: safeString(g.description ?? ''),
            date: parsedDate,
            endDate: parsedDate,
            type: 'group',
            location: safeString(g.type, 'Social'),
            completed: false,
          } as ScheduleEvent;
        })
        .filter(Boolean) as ScheduleEvent[];
    } catch (error) {
      console.error('Error fetching study groups:', serializeError(error));
      return [];
    }
  },

  async getEventById(id: string): Promise<ScheduleEvent> {
    try {
      const response = await apiService.get(`/events/${id}`);
      const raw = response as unknown;
      const data = (raw && typeof raw === 'object' && 'data' in (raw as object)) ? (raw as { data?: unknown }).data ?? raw : raw;

      const d = data as { [k: string]: unknown };
      return {
        id: safeString(d.id),
        title: safeString(d.title),
        description: safeString(d.description ?? ''),
        date: new Date(safeString(d.date, String(Date.now()))),
        endDate: new Date(safeString(d.endDate, String(Date.now()))),
        type: safeString(d.type),
        location: safeString(d.location),
        instructor: (typeof d.instructor === 'string' ? d.instructor : null),
      } as ScheduleEvent;
    } catch (error) {
      console.error('Error fetching event by ID:', error);
      throw error;
    }
  },

  async createEvent(event: Omit<ScheduleEvent, 'id'>): Promise<ScheduleEvent> {
    try {
      const payload = {
        title: event.title,
        description: event.description || '',
        date: event.date.toISOString(),
        endDate: event.endDate.toISOString(),
        type: event.type || 'study',
        location: event.location || '',
      };

      // Debug: log payload before sending to help diagnose server 500s
      console.warn('scheduleService.createEvent payload:', payload);

      const response = await apiService.post('/events', payload);
      const raw = response as unknown;
      const data = (raw && typeof raw === 'object' && 'data' in (raw as object)) ? (raw as { data?: unknown }).data ?? raw : raw;

      const d = data as { [k: string]: unknown };
      const dateRaw = d.date ?? d.startDate;
      const endDateRaw = d.endDate;

      if (!dateRaw) {
        console.warn('scheduleService: Create response missing date fields:', Object.keys(d));
      }

      return {
        id: safeString(d.id),
        title: safeString(d.title, 'Untitled ScheduleEvent'),
        description: safeString(d.description ?? d.notes ?? ''),
        date: new Date(safeString(dateRaw ?? event.date, String(event.date))),
        endDate: new Date(safeString(endDateRaw ?? event.endDate ?? (new Date(safeString(dateRaw ?? event.date, String(event.date))).getTime() + 3600000), String(event.endDate))),
        type: safeString(d.type, 'study'),
        location: safeString(d.location, ''),
      } as ScheduleEvent;
    } catch (error) {
      // Provide richer debug output when requests fail
      try {
        const e = error as unknown as Record<string, unknown>;
        console.error('Error creating event:', serializeError(e), {
          details: e?.details,
          rawResponse: e?.rawResponse,
        });
      } catch {
        console.error('Error creating event (secondary):', String(error));
      }
      throw error;
    }
  },

  async updateEvent(id: string, event: Partial<Omit<ScheduleEvent, 'id'>>): Promise<ScheduleEvent> {
    try {
      const payload = { ...event } as { [k: string]: unknown };
      if (event.date) payload.date = (event.date as Date).toISOString();
      if (event.endDate) payload.endDate = (event.endDate as Date).toISOString();

      const response = await apiService.patch(`/events/${id}`, payload);
      const raw = response as unknown;
      const data = (raw && typeof raw === 'object' && 'data' in (raw as object)) ? (raw as { data?: unknown }).data ?? raw : raw;

      const d = data as { [k: string]: unknown };
      return {
        id: safeString(d.id),
        title: safeString(d.title, ''),
        description: safeString(d.description, ''),
        date: new Date(safeString(d.date ?? event.date ?? Date.now(), String(Date.now()))),
        endDate: new Date(safeString(d.endDate ?? event.endDate ?? Date.now(), String(Date.now()))),
        type: safeString(d.type, ''),
        location: safeString(d.location, ''),
      } as ScheduleEvent;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  async deleteEvent(id: string): Promise<void> {
    try {
      await apiService.delete(`/events/${id}`);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },
};

export default scheduleService;
