import React from 'react';
import { Clock } from 'lucide-react';
import type { Event } from '../../study/services/scheduleService';

interface Props {
  currentDate: Date;
  events: Event[];
  onOpenAddForDay: (day: number) => void;
  onSelectEvent: (ev: Event) => void;
}

const isSameDay = (d1: Date, year: number, month: number, day: number) => {
  if (!(d1 instanceof Date) || isNaN(d1.getTime())) return false;
  const compareDate = new Date(year, month, day);
  return d1.toLocaleDateString() === compareDate.toLocaleDateString();
};

const CalendarGrid: React.FC<Props> = ({ currentDate, events, onOpenAddForDay, onSelectEvent }) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div role="group" aria-label={`${currentDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })} calendar`} className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-border bg-card shadow-sm dark:border-border">
      {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
        <div key={d} className="border-b border-r border-border bg-background/50 p-1 text-center text-[10px] font-bold tracking-wider text-muted-foreground dark:border-border dark:bg-card/50 sm:p-3 sm:text-xs">{d}</div>
      ))}

      {days.map((day, idx) => {
        if (day === null) return <div key={`empty-${idx}`} aria-hidden="true" className="h-24 border-b border-r border-border bg-background/30 dark:border-border dark:bg-card/30 sm:h-32" />;

        const date = new Date(year, month, day);
        const isToday = new Date().toDateString() === date.toDateString();
        const dayEvents = events.filter(e => isSameDay(e.date, year, month, day));

        return (
          <div key={day} role="group" aria-label={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} className={`group relative h-24 border-b border-r border-border bg-card p-1.5 transition-colors hover:bg-background dark:border-border dark:bg-card dark:hover:bg-secondary sm:h-32 sm:p-2 ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}>
            <div className="flex justify-between items-start mb-1">
              <button
                type="button"
                onClick={() => onOpenAddForDay(day)}
                aria-label={`Add event on ${date.toLocaleDateString()}`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-7 sm:w-7 sm:text-sm ${isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted dark:text-muted-foreground dark:hover:bg-secondary'}`}
              >
                {day}
              </button>
              {dayEvents.length > 5 && (<span className="text-[10px] bg-muted dark:bg-secondary text-muted-foreground dark:text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">+{dayEvents.length - 5}</span>)}
            </div>

            <div className="max-h-14 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700 sm:max-h-20">
              {dayEvents.slice(0,5).map(ev => {
                const TypeIcon = Clock; // keep a simple icon fallback here to keep the component focused
                return (
                  <button type="button" key={`${ev.id}-${ev.type}-${ev.date.getTime()}`} onClick={() => onSelectEvent(ev)} aria-label={`${ev.title}, ${ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} className={`block w-full rounded border border-transparent bg-muted px-1.5 py-0.5 text-left text-[10px] transition-all hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-secondary dark:text-muted-foreground dark:hover:border-border ${ev.completed ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                    <div className="flex items-center justify-between gap-1 overflow-hidden">
                      <div className="flex items-center gap-1 truncate">
                        {ev.completed ? (
                          <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-card rounded-full" /></div>
                        ) : (
                          <TypeIcon className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span className={`truncate font-medium ${ev.completed ? 'line-through decoration-gray-400' : ''}`}>{ev.title}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[8px] opacity-60">
                        {ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CalendarGrid;
