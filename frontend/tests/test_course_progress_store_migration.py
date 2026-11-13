from ts_runtime import run_typescript


def test_course_progress_migration_sanitizes_data_and_preserves_user_scope():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const NodeModule = require('node:module');

const storage = new Map();
global.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
global.window = { localStorage: global.localStorage };

let activeUserId = 'user/one';
const originalLoad = NodeModule._load;
NodeModule._load = function (request, parent, isMain) {
  if (request === 'zustand') {
    const zustand = originalLoad.call(this, request, parent, isMain);
    return { ...zustand, useStore: store => store.getState() };
  }
  if (request === '@/features/auth/store/useAuthStore') {
    return {
      useAuthStore: selector => selector({ user: { id: activeUserId } }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createUserScopedCourseProgressStore } =
  require('./src/features/courses/hooks/createUserScopedCourseProgressStore.ts');
const storageKey = 'course-progress:user%2Fone';
storage.set(storageKey, JSON.stringify({
  version: 1,
  state: {
    progress: {
      completed: true,
      incomplete: false,
      invalid: 'yes',
      nested: { value: true },
    },
    bookmarks: ['lesson-a', 4, 'lesson-a'],
    notes: {
      'lesson-a': [
        { id: 'note-1', text: 'Keep', timestamp: '2025-01-01T00:00:00.000Z' },
        { id: 2, text: 'Drop', timestamp: 'invalid' },
      ],
      broken: 'not-an-array',
    },
    markLessonComplete: 'not-an-action',
    toggleBookmark: null,
    extra: 'discarded',
  },
}));

const useProgress = createUserScopedCourseProgressStore('course-progress');
const migrated = useProgress();
assert.deepEqual(migrated.progress, { completed: true, incomplete: false });
assert.deepEqual(migrated.bookmarks, ['lesson-a']);
assert.deepEqual(migrated.notes, {
  'lesson-a': [
    { id: 'note-1', text: 'Keep', timestamp: '2025-01-01T00:00:00.000Z' },
  ],
});
assert.equal(typeof migrated.markLessonComplete, 'function');
assert.equal(typeof migrated.toggleBookmark, 'function');
migrated.markLessonComplete('new-lesson');
assert.equal(useProgress().progress['new-lesson'], true);

activeUserId = 'user-two';
assert.deepEqual(useProgress().progress, {});
useProgress().markLessonComplete('private-lesson');
activeUserId = 'user/one';
assert.equal(useProgress().progress['private-lesson'], undefined);
assert.deepEqual(
  JSON.parse(storage.get(storageKey)).state,
  {
    progress: {
      completed: true,
      incomplete: false,
      'new-lesson': true,
    },
    bookmarks: ['lesson-a'],
    notes: {
      'lesson-a': [
        { id: 'note-1', text: 'Keep', timestamp: '2025-01-01T00:00:00.000Z' },
      ],
    },
  },
);
"""
    )
