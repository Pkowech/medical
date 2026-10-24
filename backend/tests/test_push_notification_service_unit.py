from ts_runtime import run_typescript


def test_removing_one_device_keeps_push_enabled_until_last_subscription_is_removed():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { PushNotificationsService } =
  require('./src/modules/engagement-communication/services/push-notifications.service.ts');

async function removeSubscription(endpoint, remainingSubscriptions) {
  const calls = [];
  const tx = {
    user: {
      findUnique: async args => {
        calls.push(['findUnique', args]);
        return { preferences: { theme: 'dark', notifications: { email: true } } };
      },
      update: async args => calls.push(['update', args]),
    },
    pushSubscription: {
      deleteMany: async args => calls.push(['deleteMany', args]),
      count: async args => {
        calls.push(['count', args]);
        return remainingSubscriptions;
      },
    },
  };
  const prisma = {
    $transaction: async callback => callback(tx),
  };
  const service = new PushNotificationsService(prisma);
  await service.removeSubscription('user-1', endpoint);
  return calls;
}

(async () => {
  const withOtherDevice = await removeSubscription('device-1', 1);
  assert.deepEqual(withOtherDevice.find(([name]) => name === 'deleteMany')[1], {
    where: { userId: 'user-1', endpoint: 'device-1' },
  });
  assert.equal(withOtherDevice.find(([name]) => name === 'count')[1].where.userId, 'user-1');
  const preservedPreferences = withOtherDevice.find(([name]) => name === 'update')[1].data.preferences;
  assert.equal(preservedPreferences.theme, 'dark');
  assert.equal(preservedPreferences.notifications.email, true);
  assert.equal(preservedPreferences.notifications.push, true);

  const lastDevice = await removeSubscription('device-2', 0);
  const disabledPreferences = lastDevice.find(([name]) => name === 'update')[1].data.preferences;
  assert.equal(disabledPreferences.notifications.push, false);

  const accountOptOut = await removeSubscription(undefined, 0);
  assert.deepEqual(accountOptOut.find(([name]) => name === 'deleteMany')[1], {
    where: { userId: 'user-1' },
  });
  assert.equal(accountOptOut.some(([name]) => name === 'count'), false);
  assert.equal(
    accountOptOut.find(([name]) => name === 'update')[1].data.preferences.notifications.push,
    false,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
