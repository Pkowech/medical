self.addEventListener('sync', event => {
  if (event.tag !== 'sync-outbox') return;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      if (clients.length === 0) {
        throw new Error('No open MedTrack window is available to sync the outbox.');
      }

      const results = await Promise.all(
        clients.map(client => {
          const channel = new MessageChannel();
          return new Promise(resolve => {
              const timeout = setTimeout(() => {
                channel.port1.close();
                resolve(false);
              }, 60_000);
              channel.port1.onmessage = response => {
                clearTimeout(timeout);
                channel.port1.close();
                resolve(response.data?.success === true);
              };
              client.postMessage({ type: 'SYNC_OUTBOX' }, [channel.port2]);
            });
        }),
      );

      if (!results.some(Boolean)) {
        throw new Error('No MedTrack window completed the requested outbox sync.');
      }
    })(),
  );
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'MedTrack Hub';
  const body = typeof payload.body === 'string' ? payload.body : 'You have a new notification.';
  const url = typeof payload.url === 'string' ? payload.url : '/notifications';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      data: { url },
      tag: 'medtrack-notification',
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  let targetUrl = new URL('/notifications', self.location.origin);
  try {
    const requestedUrl = new URL(event.notification.data?.url ?? '/', self.location.origin);
    if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl;
  } catch {
    targetUrl = new URL('/notifications', self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      for (const client of clients) {
        if (new URL(client.url).origin === targetUrl.origin && 'focus' in client) {
          await client.navigate(targetUrl.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl.href);
    }),
  );
});
