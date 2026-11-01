from pathlib import Path
import re

from ts_runtime import run_typescript


FRONTEND_ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


def test_offline_content_revision_is_stable_and_tracks_updated_content():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  computeOfflineContentRevision,
  isOfflineContentStale,
} = require('./src/lib/core/offline/contentRevision.ts');

const materials = [
  { id: 'pdf-2', updatedAt: '2026-03-01T00:00:00.000Z' },
  { id: 'pdf-1', updatedAt: 1772323200000 },
];
const questions = [{ id: 'question-1', updatedAt: '2026-03-02T00:00:00.000Z' }];
const revision = computeOfflineContentRevision('topic-1', materials, questions);

assert.equal(
  computeOfflineContentRevision('topic-1', [...materials].reverse(), questions),
  revision,
);
assert.equal(isOfflineContentStale(revision, revision), false);
assert.equal(
  isOfflineContentStale(
    revision,
    computeOfflineContentRevision('topic-1', materials, [
      { id: 'question-1', updatedAt: '2026-03-03T00:00:00.000Z' },
    ]),
  ),
  true,
);
assert.equal(isOfflineContentStale(undefined, revision), true);
"""
    )


def test_persistent_storage_denial_is_recorded_and_later_grant_is_reflected():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const values = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
});
const storage = {
  persisted: async () => false,
  persist: async () => false,
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { storage },
});
const {
  inspectPersistentStorage,
  readPersistentStorageStatus,
  requestPersistentStorage,
} = require('./src/lib/core/offline/requestPersistentStorage.ts');

(async () => {
  const inspected = await inspectPersistentStorage();
  assert.equal(inspected.supported, true);
  assert.equal(inspected.persisted, false);
  assert.equal(await requestPersistentStorage(), false);
  assert.equal(readPersistentStorageStatus().supported, true);
  assert.equal(readPersistentStorageStatus().persisted, false);

  storage.persist = async () => true;
  assert.equal(await requestPersistentStorage(), true);
  assert.equal(readPersistentStorageStatus().persisted, true);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_offline_revision_and_storage_feedback_are_wired_into_topic_viewer():
    topic_viewer = read_frontend("src/features/courses/components/TopicViewer.tsx")
    storage_notice = read_frontend("src/lib/core/offline/StoragePersistenceNotice.tsx")

    assert re.search(
        r"quizResult\.status === 'fulfilled'\s*\?\s*quizResult\.value\.data\s*:\s*\[\]",
        topic_viewer,
    )
    assert "currentMaterialsComplete" in topic_viewer
    assert "<StoragePersistenceNotice />" in topic_viewer
    assert "offlineBundle?.stale" in topic_viewer
    assert "The browser did not grant persistent storage." in storage_notice


def test_production_service_worker_updates_show_a_user_prompt():
    service_worker = read_frontend("src/app/ServiceWorkerRegister.tsx")

    assert "process.env.NODE_ENV !== 'production'" in service_worker
    assert "setWaitingWorker(waiting)" in service_worker
    assert "NEXT_PUBLIC_ENABLE_APP_UPDATE_BANNER" not in service_worker
    assert "waitingWorker.postMessage({ type: 'SKIP_WAITING' })" in service_worker
