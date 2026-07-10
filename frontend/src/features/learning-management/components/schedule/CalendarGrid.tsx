import React from 'react';
import { Clock, Plus } from 'lucide-react';
import { Event } from '../../study/services/scheduleService';

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
    <div className="grid grid-cols-7 border-t border-l border-gray-100 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
      {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
        <div key={d} className="bg-gray-50/50 dark:bg-slate-900/50 p-3 text-center text-xs font-bold text-gray-400 dark:text-slate-500 tracking-wider border-r border-b border-gray-100 dark:border-slate-700">{d}</div>
      ))}

      {days.map((day, idx) => {
        if (day === null) return <div key={`empty-${idx}`} className="bg-gray-50/30 dark:bg-slate-900/30 border-r border-b border-gray-100 dark:border-slate-700 h-32" />;

        const date = new Date(year, month, day);
        const isToday = new Date().toDateString() === date.toDateString();
        const dayEvents = events.filter(e => isSameDay(e.date, year, month, day));

        return (
          <div key={day} onClick={() => onOpenAddForDay(day)} className={`bg-white dark:bg-slate-800 h-32 p-2 transition-colors hover:bg-gray-50 dark:hover:bg-slate-750 cursor-pointer relative group border-r border-b border-gray-100 dark:border-slate-700 ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}>
            <div className="flex justify-between items-start mb-1">
              <span className={`text-sm font-semibold inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-slate-300 group-hover:bg-gray-100 dark:group-hover:bg-slate-700'}`}>{day}</span>
              {dayEvents.length > 5 && (<span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-medium">+{dayEvents.length - 5}</span>)}
            </div>

            <div className="space-y-1 overflow-y-auto max-h-20 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              {dayEvents.slice(0,5).map(ev => {
                const TypeIcon = Clock; // keep a simple icon fallback here to keep the component focused
                return (
                  <div key={`${ev.id}-${ev.type}-${ev.date.getTime()}`} onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }} className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition-all cursor-pointer bg-gray-100 dark:bg-slate-700 dark:text-slate-200 ${ev.completed ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                    <div className="flex items-center justify-between gap-1 overflow-hidden">
                      <div className="flex items-center gap-1 truncate">
                        {ev.completed ? (
                          <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
                        ) : (
                          <TypeIcon className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span className={`truncate font-medium ${ev.completed ? 'line-through decoration-gray-400' : ''}`}>{ev.title}</span>
                      </div>
                      <span className="text-[8px] opacity-60 shrink-0 font-mono">{ev.date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', hour12: false })}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button title="Add event" className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded-full text-blue-600 transition-all" onClick={(e) => { e.stopPropagation(); onOpenAddForDay(day); }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default CalendarGrid;
