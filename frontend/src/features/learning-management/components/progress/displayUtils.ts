import { format, parseISO } from 'date-fns';

export function formatDateSafe(dateInput?: string | number | null) {
  if (!dateInput) return '—';
  try {
    let d: Date;
    if (typeof dateInput === 'number') d = new Date(dateInput);
    else if (/^\d+$/.test(String(dateInput))) d = new Date(Number(dateInput));
    else d = parseISO(String(dateInput));
    if (isNaN(d.getTime())) return '—';
    return format(d, 'MMM d, yyyy, h:mm a');
  } catch {
    return '—';
  }
}

export function formatLastUpdatedSafe(timestamp?: number) {
  if (!timestamp) return 'Not synced';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default formatDateSafe;
