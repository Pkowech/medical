from ts_runtime import run_typescript


def test_normalize_api_url_rewrites_progress_paths_and_preserves_queries():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { normalizeApiUrl } = require('./src/lib/core/offline/normalizeApiUrl.ts');
const origin = 'http://localhost:3000';

for (const [url, expected] of [
  ['/progress/log', '/api/backend/progress/sync'],
  ['/api/backend/progress/log', '/api/backend/progress/sync'],
  ['/v1/progress/log', '/api/backend/progress/sync'],
  ['/api/backend/progress/log?source=offline', '/api/backend/progress/sync?source=offline'],
  ['/progress/sync', '/api/backend/progress/sync'],
]) assert.equal(normalizeApiUrl(url, origin), expected);
"""
    )
