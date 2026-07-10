// Temporary wrapper to ensure Nest Logger outputs to console so we capture startup errors
const nestCommon = require('@nestjs/common');
const origLogger = nestCommon.Logger;

// Route Logger methods to console for visibility
['log', 'error', 'warn', 'debug', 'verbose'].forEach((m) => {
  if (typeof origLogger[m] === 'function') {
    origLogger[m] = function () {
      // eslint-disable-next-line no-console
      console[m === 'error' ? 'error' : 'log'](...arguments);
    };
  }
});

try {
  require('./dist/main');
} catch (e) {
  // Ensure any synchronous errors are visible
  // eslint-disable-next-line no-console
  console.error('Synchronous require error:', e && e.stack ? e.stack : e);
  process.exit(1);
}
