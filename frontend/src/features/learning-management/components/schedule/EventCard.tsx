// Enhanced event display card with calendar features
import React from 'react';
import {
  Clock,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle,
  Bell,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { Event } from '@/features/learning-management/study/services/scheduleService';
import {
  formatPriority,
  getPriorityColor,
  formatStatus,
  getStatusColor,
  formatCategory,
  getCategoryStyle,
  formatReminderTime,
  isEventOverdue,
} from '../../utils/calendarFeatures';

interface EventCardProps {
  event: Event;
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  onToggleCompletion?: (event: Event) => void;
  showDetails?: boolean;
}

export function EventCard({
  event,
  onEdit,
  onDelete,
  onToggleCompletion,
  showDetails = false,
}: EventCardProps) {
  // Bug fix #9: Handle missing event
  if (!event) return null;
  
  const isOverdue = isEventOverdue(event);
  const categoryStyle = getCategoryStyle(event.category);

  return (
    <div
      className={`p-4 rounded-lg border-l-4 transition-all hover:shadow-md ${showDetails ? 'shadow-md' : ''}`}
      style={{ borderLeftColor: event.color || '#6366f1' }}
    >
      {/* Header with title and badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3
            className={`font-semibold text-sm ${
              event.completed || event.status === 'completed' ? 'line-through text-gray-400' : ''
            } ${isOverdue ? 'text-red-600' : ''}`}
          >
            {event.title}
          </h3>
          <div className="flex gap-2 flex-wrap mt-1">
            {/* Priority Badge */}
            <Badge className={`text-xs ${getPriorityColor(event.priority)}`}>
              {formatPriority(event.priority)}
            </Badge>

            {/* Category Badge */}
            <Badge
              variant="outline"
              className={`text-xs ${categoryStyle.textColor}`}
              style={{ backgroundColor: categoryStyle.color }}
            >
              {formatCategory(event.category)}
            </Badge>

            {/* Status Badge */}
            {event.status && (
              <Badge className={`text-xs ${getStatusColor(event.status)}`}>
                {formatStatus(event.status)}
              </Badge>
            )}

            {/* Overdue Badge */}
            {isOverdue && event.status !== 'completed' && (
              <Badge className="text-xs bg-red-100 text-red-700">Overdue</Badge>
            )}

            {/* Recurring Badge */}
            {event.isRecurring && (
              <Badge variant="outline" className="text-xs">
                <RotateCcw className="w-3 h-3 mr-1" />
                Repeats
              </Badge>
            )}
          </div>
        </div>

        {/* Completion Button */}
        {onToggleCompletion && event.status !== 'cancelled' && (
          <button
            onClick={() => onToggleCompletion(event)}
            className="ml-2 p-1 hover:bg-gray-100 rounded"
            title={event.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {event.completed ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Main event info */}
      <div className="space-y-1 mb-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>
            {formatEventTime(event.date, event.endDate, event.allDay)}
          </span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{event.location}</span>
          </div>
        )}

        {event.instructor && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{event.instructor}</span>
          </div>
        )}
      </div>

      {/* Description - show only in detail view */}
      {showDetails && event.description && (
        <p className="text-sm text-gray-700 mb-3 bg-gray-50 p-2 rounded">
          {event.description}
        </p>
      )}

      {/* Attendees */}
      {showDetails && event.attendees && event.attendees.length > 0 && (
        <div className="mb-3 text-sm">
          <p className="font-semibold text-gray-700 mb-1">Attendees:</p>
          <div className="flex flex-wrap gap-2">
            {event.attendees.map((attendee) => (
              <Badge key={attendee} variant="outline" className="text-xs">
                {attendee}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Reminders */}
      {showDetails && event.reminders && event.reminders.length > 0 && (
        <div className="mb-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4" />
            <p className="font-semibold text-gray-700">Reminders:</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.reminders.map((reminder) => (
              <Badge key={reminder} variant="outline" className="text-xs">
                {formatReminderTime(reminder)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recurrence Info */}
      {showDetails && event.isRecurring && event.recurrencePattern && (
        <div className="mb-3 text-sm bg-blue-50 p-2 rounded">
          <p className="text-gray-700">
            <strong>Repeats:</strong> {event.recurrencePattern.frequency}
            {event.recurrencePattern.endDate && ` until ${formatDate(event.recurrencePattern.endDate)}`}
          </p>
        </div>
      )}

      {/* Actions */}
      {showDetails && (
        <div className="flex gap-2 border-t pt-3 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(event)}
            className="text-xs"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(event.id)}
            className="text-xs"
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Format event time for display
 */
function formatEventTime(
  start: Date | string,
  end: Date | string,
  allDay: boolean = false
): string {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  const sameDay = startDate.toDateString() === endDate.toDateString();

  if (allDay) {
    return startDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  const timeFormat = { hour: '2-digit', minute: '2-digit' } as const;

  if (sameDay) {
    return `${startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${startDate.toLocaleTimeString(undefined, timeFormat)} - ${endDate.toLocaleTimeString(undefined, timeFormat)}`;
  }

  return `${startDate.toLocaleDateString(undefined, timeFormat)} - ${endDate.toLocaleDateString(undefined, timeFormat)}`;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
