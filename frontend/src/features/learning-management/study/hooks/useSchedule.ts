'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import scheduleService, { Event } from '../services/scheduleService';

export default function useSchedule(initialDate: Date = new Date()) {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Bug fix #3: Use date string to prevent infinite loops
  const dateKey = useMemo(() => currentDate.toISOString().split('T')[0], [currentDate]);

  const fetchEvents = useCallback(async (date = currentDate) => {
    try {
      setIsLoading(true);
      const year = date.getFullYear();
      const month = date.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const data = await scheduleService.getSessions(session?.user?.id, startDate, endDate);

      const processed = (data || []).map(e => ({
        ...e,
        date: e.date instanceof Date ? e.date : new Date(e.date),
        endDate: e.endDate instanceof Date ? e.endDate : new Date(e.endDate),
      })).filter(e => !isNaN(e.date.getTime()));

      setEvents(processed);
    } catch (err) {
      console.error('useSchedule: fetchEvents failed', err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, session?.user?.id]);

  // Bug fix #3: Use dateKey instead of currentDate object
  // Guard: only fetch when session is authenticated
  useEffect(() => {
    // Wait for session to be available before fetching
    if (status !== 'authenticated') {
      console.warn('[useSchedule] Waiting for session authentication', { status });
      setIsLoading(false); // Set to false so dashboard knows session check is in progress
      return;
    }
    
    console.warn('[useSchedule] Session authenticated, fetching events');
    fetchEvents();
  }, [dateKey, view, fetchEvents, status]);

  const createEvent = useCallback(async (payload: Omit<Event, 'id'>) => {
    const created = await scheduleService.createEvent(payload);
    // Refresh list
    await fetchEvents();
    return created;
  }, [fetchEvents]);

  const updateEvent = useCallback(async (id: string, patch: Partial<Omit<Event, 'id'>>) => {
    const updated = await scheduleService.updateEvent(id, patch);
    await fetchEvents();
    return updated;
  }, [fetchEvents]);

  const deleteEvent = useCallback(async (id: string) => {
    await scheduleService.deleteEvent(id);
    await fetchEvents();
  }, [fetchEvents]);

  const toggleCompletion = useCallback(async (event: Event) => {
    const updatePayload: Partial<Omit<Event, 'id'>> = {
      completed: !event.completed,
    };
    await scheduleService.updateEvent(event.id, updatePayload);
    await fetchEvents();
  }, [fetchEvents]);

  const hasOverlap = useCallback((start: Date, end: Date, excludeId?: string) => {
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return events.some(e => {
      if (excludeId && e.id === excludeId) return false;
      return start < e.endDate && e.date < end;
    });
  }, [events]);

  const filteredEvents = selectedType === 'all' ? events : events.filter(e => e.type === selectedType);

  return {
    events,
    filteredEvents,
    isLoading,
    currentDate,
    setCurrentDate,
    view,
    setView,
    selectedType,
    setSelectedType,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleCompletion,
    hasOverlap,
  } as const;
}
