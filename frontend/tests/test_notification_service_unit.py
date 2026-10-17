from ts_runtime import run_typescript


def test_notification_service_fetches_and_normalizes_notifications():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const TestModule = require('node:module');
const originalLoad = TestModule._load;
const calls = [];
const responses = [];
const apiClient = {
  get: async url => {
    calls.push(url);
    return responses.shift();
  },
};

TestModule._load = function (request, parent, isMain) {
  if (request === '../auth/services/apiClient' &&
      parent?.filename.replaceAll('\\', '/').endsWith('/notificationService.ts')) {
    return { __esModule: true, default: apiClient };
  }
  return originalLoad.call(this, request, parent, isMain);
};

(async () => {
  const { notificationService } = require('./src/features/community/notificationService.ts');
  responses.push({ data: [] });
  assert.deepEqual(await notificationService.getNotifications(), []);
  assert.equal(calls.pop(), '/notifications?page=1&limit=10');

  responses.push({ data: [] });
  assert.deepEqual(await notificationService.getNotifications(2, 5), []);
  assert.equal(calls.pop(), '/notifications?page=2&limit=5');

  responses.push({
    data: [
      { id: '1', metadata: { title: 'Test Notification 1' }, read: false },
      { id: '2', read: true },
    ],
  });
  assert.deepEqual(await notificationService.getNotifications(), [
    { id: '1', metadata: { title: 'Test Notification 1' }, read: false, title: 'Test Notification 1' },
    { id: '2', read: true, title: 'Notification' },
  ]);

  const existingTitle = {
    id: '1',
    title: 'Existing title',
    metadata: { title: 'Metadata title' },
    read: false,
  };
  responses.push({ data: [existingTitle] });
  const preserved = await notificationService.getNotifications();
  assert.equal(preserved[0].title, 'Existing title');
  assert.deepEqual(preserved[0].metadata, { title: 'Metadata title' });

  const original = { id: '2', message: 'A course update is available', read: true, userId: 'user-1' };
  responses.push({ data: [original] });
  assert.deepEqual((await notificationService.getNotifications())[0], {
    ...original,
    title: 'Notification',
  });

  responses.push([{ id: '3', metadata: { title: 'Direct response title' }, read: false }]);
  assert.deepEqual(await notificationService.getNotifications(), [
    { id: '3', metadata: { title: 'Direct response title' }, read: false, title: 'Direct response title' },
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
