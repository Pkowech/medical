'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar,
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Filter, 
  BookOpen, 
  Beaker, 
  Users, 
  GraduationCap,
  Target 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

import type { Event } from '../../study/services/scheduleService';
import { createNotification } from '@/features/community/notificationService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePageHeader } from '@/core/providers/HeaderContext';

import useSchedule from '../../study/hooks/useSchedule';
import CalendarGrid from './CalendarGrid';
import { EventEditor } from './EventEditor';
import { EventCard } from './EventCard';

const EVENT_TYPES = {
  lecture: { label: 'Lecture', color: 'bg-blue-100 text-blue-700', icon: GraduationCap },
  lab: { label: 'Lab', color: 'bg-purple-100 text-purple-700', icon: Beaker },
  study: { label: 'Study', color: 'bg-green-100 text-green-700', icon: BookOpen },
  group: { label: 'Group', color: 'bg-orange-100 text-orange-700', icon: Users },
  exam: { label: 'Exam', color: 'bg-red-100 text-red-700 font-bold', icon: Calendar },
  goal: { label: 'Goal', color: 'bg-amber-100 text-amber-700', icon: Target },
};

export default function ScheduleComponent() {
  const { user } = useAuth();
  const { setHeader } = usePageHeader();

  useEffect(() => {
    setHeader({
      title: 'Academic Schedule',
      description: 'Manage your classes, study sessions, and exams',
    });
    return () => setHeader(null);
  }, [setHeader]);

  const {
    events,
    filteredEvents,
    isLoading,
    currentDate,
    setCurrentDate,
    view,
    selectedType,
    setSelectedType,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleCompletion,
    hasOverlap,
  } = useSchedule();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    type: 'study',
    date: new Date(),
    endDate: new Date(new Date().getTime() + 60 * 60 * 1000),
    description: '',
    location: '',
    priority: 1,
    status: 'pending',
    category: 'academic',
    allDay: false,
  });

  const validateEventTimes = (event: Partial<Event>): boolean => {
    if (!event.date || !event.endDate) return false;
    if (isNaN(event.date.getTime()) || isNaN(event.endDate.getTime())) return false;
    return event.endDate > event.date;
  };

  const checkEventOverlap = (event: Partial<Event>, excludeId?: string): boolean => {
    if (!event.date || !event.endDate) return false;
    return hasOverlap(event.date, event.endDate, excludeId);
  };

  const handleCreateEvent = async (eventData: Partial<Event>) => {
    if (isSubmitting || !eventData.title?.trim() || !eventData.date) {
      setOverlapError('Please fill in all required fields.');
      return;
    }

    const startDate = typeof eventData.date === 'string' ? new Date(eventData.date) : eventData.date;
    const endDate = typeof eventData.endDate === 'string' ? new Date(eventData.endDate) : eventData.endDate;
    
    if (isNaN(startDate.getTime()) || isNaN(endDate?.getTime() || NaN)) {
      setOverlapError('Invalid date format.');
      return;
    }

    if (!validateEventTimes({ ...eventData, date: startDate, endDate })) {
      setOverlapError('End time must be after the start time.');
      return;
    }

    if (checkEventOverlap({ ...eventData, date: startDate, endDate })) {
      setOverlapError('This event overlaps with an existing one.');
      return;
    }

    setOverlapError(null);
    try {
      setIsSubmitting(true);
      await createEvent(eventData as Omit<Event, 'id'>);

      if (user?.id) {
        const dateFormatted = (eventData.date as Date).toLocaleString(undefined, { 
          month: 'short', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        await createNotification(
          user.id, 
          `You've scheduled "${eventData.title}" for ${dateFormatted}.`,
          'New Event Scheduled',
          'success',
          '/schedule'
        );
      }

      setIsAddOpen(false);
      setNewEvent({
        title: '',
        type: 'study',
        date: new Date(),
        endDate: new Date(new Date().getTime() + 60 * 60 * 1000),
        description: '',
        location: '',
        priority: 1,
        status: 'pending',
        category: 'academic',
        allDay: false,
      });
    } catch (error) {
      console.error('Failed to create event:', error);
      setOverlapError('Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEvent = async (eventData: Partial<Event>) => {
    if (!selectedEvent || isSubmitting) return;

    const merged = { ...selectedEvent, ...eventData };
    const startDate = typeof merged.date === 'string' ? new Date(merged.date) : merged.date;
    const endDate = typeof merged.endDate === 'string' ? new Date(merged.endDate) : merged.endDate;

    if (!validateEventTimes({ ...merged, date: startDate, endDate })) {
      setOverlapError('End time must be after the start time.');
      return;
    }

    if (checkEventOverlap({ ...merged, date: startDate, endDate }, selectedEvent.id)) {
      setOverlapError('This time slot overlaps with another event.');
      return;
    }

    try {
      setOverlapError(null);
      setIsSubmitting(true);
      await updateEvent(selectedEvent.id, eventData);
      setIsDetailsOpen(false);
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to update event:', error);
      setOverlapError('Failed to update event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteEvent(id);
      setIsDetailsOpen(false);
      if (user?.id) {
        await createNotification(user.id, 'Event deleted successfully', 'Schedule Update', 'info');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    setCurrentDate(newDate);
  };

  const renderUpcomingSidebar = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysFromNow = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcoming = events
      .filter(e => e.date >= startOfToday && e.date <= sevenDaysFromNow)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return (
      <Card className="h-full border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-3">
          {upcoming.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400 italic p-4 text-center bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              No upcoming events this week.
            </div>
          ) : (
            upcoming.map((ev, index) => {
              const eventDate = typeof ev.date === 'string' ? new Date(ev.date) : (ev.date instanceof Date ? ev.date : new Date());
              const TypeIcon = EVENT_TYPES[ev.type as keyof typeof EVENT_TYPES]?.icon || Clock;
              const typeColor = EVENT_TYPES[ev.type as keyof typeof EVENT_TYPES]?.color;

              return (
                <div
                  key={`${ev.id}-${ev.type}-${index}`}
                  onClick={() => {
                    setSelectedEvent(ev);
                    setIsDetailsOpen(true);
                  }}
                  className={`flex gap-3 items-start p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    ev.completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg ${typeColor?.split(' ')[0] || 'bg-gray-100'}`}>
                    <TypeIcon className={`w-4 h-4 ${typeColor?.split(' ')[1] || 'text-gray-700'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4
                        className={`text-sm font-semibold text-gray-900 dark:text-white truncate ${
                          ev.completed ? 'line-through' : ''
                        }`}
                      >
                        {ev.title || 'Untitled Event'}
                      </h4>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap">
                        {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {ev.location || 'Online'}
                    </p>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                      {eventDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            if (!open) {
              setNewEvent({
                title: '',
                type: 'study',
                date: new Date(),
                endDate: new Date(new Date().getTime() + 60 * 60 * 1000),
                description: '',
                location: '',
                priority: 1,
                status: 'pending',
                category: 'academic',
                allDay: false,
              });
              setOverlapError(null);
            }
            setIsAddOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              {overlapError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2 text-red-700 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {overlapError}
                  </div>
                </div>
              )}
              <EventEditor
                event={newEvent}
                onUpdate={handleCreateEvent}
                onCancel={() => {
                  setIsAddOpen(false);
                  setOverlapError(null);
                }}
                isSubmitting={isSubmitting}
                showAdvanced={true}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Calendar Area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                </Button>
                <h2 className="text-lg font-semibold w-40 text-center text-gray-900 dark:text-white">
                  {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => navigateDate('next')}>
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                {/* Fix: removed invalid `value` prop from SelectValue — use only `placeholder` */}
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {Object.entries(EVENT_TYPES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="h-[500px] flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <CalendarGrid
                currentDate={currentDate}
                events={filteredEvents}
                onOpenAddForDay={(day) => {
                  const year = currentDate.getFullYear();
                  const month = currentDate.getMonth();
                  const selectedDate = new Date(year, month, day, 9, 0, 0);
                  setNewEvent({
                    ...newEvent,
                    date: selectedDate,
                    endDate: new Date(selectedDate.getTime() + 3600000),
                  });
                  setIsAddOpen(true);
                }}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setIsDetailsOpen(true);
                }}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-linear-to-br from-blue-500 to-blue-600 border-none text-white shadow-lg shadow-blue-500/20">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="text-3xl font-bold">
                    {events.filter(e => e.type === 'study').length}
                  </div>
                  <div className="text-xs opacity-90 font-medium uppercase tracking-wider mt-1">
                    Study Sessions
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-800 border-blue-100 dark:border-slate-700 shadow-sm">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {events.filter(e => e.type === 'lecture').length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider mt-1">
                    Lectures
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming List */}
            {renderUpcomingSidebar()}
          </div>
        </div>

        {/* Event Details Dialog */}
        <Dialog
          open={isDetailsOpen}
          onOpenChange={(open) => {
            setIsDetailsOpen(open);
            if (!open) setIsEditMode(false);
          }}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {isEditMode ? 'Edit Event' : selectedEvent?.title}
              </DialogTitle>
            </DialogHeader>

            {overlapError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 text-red-700 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {overlapError}
                </div>
              </div>
            )}

            {isEditMode && selectedEvent ? (
              <EventEditor
                event={selectedEvent}
                onUpdate={handleUpdateEvent}
                onCancel={() => {
                  setIsEditMode(false);
                  setOverlapError(null);
                }}
                isSubmitting={isSubmitting}
                showAdvanced={true}
              />
            ) : selectedEvent ? (
              <>
                <EventCard
                  event={selectedEvent}
                  onEdit={() => setIsEditMode(true)}
                  onDelete={handleDeleteEvent}
                  onToggleCompletion={toggleCompletion}
                  showDetails={true}
                />
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}