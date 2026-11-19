export interface EventWindow {
  date: Date;
  endDate: Date;
}

export function isValidEventWindow(startDate: Date, endDate: Date): boolean {
  return (
    Number.isFinite(startDate.getTime()) &&
    Number.isFinite(endDate.getTime()) &&
    endDate > startDate
  );
}

export function findOverlappingEvent<T extends EventWindow>(
  events: T[],
  startDate: Date,
  endDate: Date,
): T | undefined {
  return events.find(event => event.date < endDate && event.endDate > startDate);
}
