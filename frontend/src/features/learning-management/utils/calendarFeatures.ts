import { Event } from '../study/services/scheduleService';

export const PRIORITY_LEVELS = {
  1: { label: 'Normal', color: 'bg-blue-100 text-blue-700', icon: '🟢' },
  2: { label: 'Important', color: 'bg-orange-100 text-orange-700', icon: '🟠' },
  3: { label: 'Urgent', color: 'bg-red-100 text-red-700 font-bold', icon: '🔴' },
};

export const EVENT_STATUS = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: '⏳' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: '✅' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: '❌' },
};

export const RECURRENCE_PATTERNS = {
  none: { label: 'None', value: 'none' },
  daily: { label: 'Daily', value: 'daily' },
  weekly: { label: 'Weekly', value: 'weekly' },
  monthly: { label: 'Monthly', value: 'monthly' },
  yearly: { label: 'Yearly', value: 'yearly' },
};

export const DEFAULT_REMINDERS = [
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
];

export const formatPriority = (priority?: number): string => {
  return PRIORITY_LEVELS[priority as keyof typeof PRIORITY_LEVELS]?.label || 'Normal';
};

export const getPriorityColor = (priority?: number): string => {
  return PRIORITY_LEVELS[priority as keyof typeof PRIORITY_LEVELS]?.color || 'bg-blue-100 text-blue-700';
};

export const formatStatus = (status?: string): string => {
  return EVENT_STATUS[status as keyof typeof EVENT_STATUS]?.label || 'Pending';
};

export const getStatusColor = (status?: string): string => {
  return EVENT_STATUS[status as keyof typeof EVENT_STATUS]?.color || 'bg-gray-100 text-gray-700';
};

export const formatCategory = (category?: string): string => {
  if (!category) return 'Academic';
  return category.charAt(0).toUpperCase() + category.slice(1);
};

export const getCategoryStyle = (category?: string) => {
  const styles: Record<string, { color: string; textColor: string }> = {
    academic: { color: '#dcfce7', textColor: 'text-green-700' },
    social: { color: '#ffedd5', textColor: 'text-orange-700' },
    personal: { color: '#f3e8ff', textColor: 'text-purple-700' },
    work: { color: '#dbeafe', textColor: 'text-blue-700' },
  };
  return styles[category?.toLowerCase() || 'academic'] || styles.academic;
};

export const formatReminderTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) > 1 ? 's' : ''} before`;
  return `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) > 1 ? 's' : ''} before`;
};

export const isEventOverdue = (event: Event): boolean => {
  if (event.completed || event.status === 'completed') return false;
  const now = new Date();
  const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
  return eventDate < now;
};
