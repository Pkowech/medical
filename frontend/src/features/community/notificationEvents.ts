// Small helper for firing/listening to a notification refresh event.
export const NOTIFICATIONS_REFRESH_EVENT = 'medtrack:notifications-refresh';

export function triggerNotificationsRefresh() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
  } catch (err) {
    // some browsers may throw for custom events in restricted contexts; ignore
    console.warn('triggerNotificationsRefresh failed to dispatch event', err);
  }
}

// Optional: convenience listener adder, not strictly required but handy
export function addNotificationsRefreshListener(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handler);
}
