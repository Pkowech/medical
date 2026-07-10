export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

export const getCurrentDate = (): string => {
  return formatDate(new Date());
};

export const isDateExpired = (date: string | Date): boolean => {
  return new Date(date) < new Date();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.round(months / 12);
  return `${years} years ago`;
};
