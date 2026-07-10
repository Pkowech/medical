// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { cleanup } from '@testing-library/react';

// Mock the 'idb' library
jest.mock('idb', () => ({
  openDB: jest.fn(async (name, version, { upgrade }) => {
    const mockDb = {
      objectStoreNames: {
        contains: jest.fn(() => true),
      },
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
          clear: jest.fn(),
          getAll: jest.fn(),
        })),
        commit: jest.fn(),
        abort: jest.fn(),
      })),
      close: jest.fn(),
    };

    if (upgrade) {
      upgrade(mockDb);
    }

    return mockDb;
  }),
}));

// Mock performance API
global.performance = {
  // Mock methods used by PerformanceMonitor
  now: jest.fn(() => 0),
  getEntriesByType: jest.fn(type => {
    if (type === 'navigation') {
      return [
        {
          loadEventEnd: 0,
          startTime: 0,
          domContentLoadedEventEnd: 0,
          domInteractive: 0,
        },
      ];
    }
    if (type === 'paint') {
      return [
        {
          name: 'first-contentful-paint',
          startTime: 0,
        },
      ];
    }
    if (type === 'largest-contentful-paint') {
      return [
        {
          startTime: 0,
        },
      ];
    }
    return [];
  }),
  // Mock other properties if needed
  memory: {
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
  },
  // Add other methods that might be called, e.g., addEventListener, removeEventListener
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Ensure window.performance points to the mocked performance object
window.performance = global.performance;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

// Mock indexedDB
const mockIndexedDB = {
  open: jest.fn(() => ({
    // Mock IDBOpenDBRequest
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {},
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        get: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        getAll: jest.fn(),
      })),
      commit: jest.fn(),
      abort: jest.fn(),
    })),
    close: jest.fn(),
  })),
  deleteDatabase: jest.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIndexedDB,
});

// Add TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock IndexedDB global constructors
global.IDBRequest = class IDBRequest {};
global.IDBOpenDBRequest = class IDBOpenDBRequest {};
global.IDBFactory = class IDBFactory {};
global.IDBDatabase = class IDBDatabase {};
global.IDBTransaction = class IDBTransaction {};
global.IDBObjectStore = class IDBObjectStore {};
global.IDBIndex = class IDBIndex {};
global.IDBCursor = class IDBCursor {};
global.IDBCursorWithValue = class IDBCursorWithValue {};
global.IDBKeyRange = class IDBKeyRange {};

// Import performanceMonitor after we've mocked global performance and browser APIs
import { performanceMonitor } from './src/features/analytics/services/performanceMonitor';

// Reset performance monitor before each test
beforeEach(() => {
  performanceMonitor['metrics'] = [];
  performanceMonitor['pageLoadMetrics'] = [];
  performanceMonitor['apiMetrics'] = [];
  performanceMonitor['resourceMetrics'] = [];
});

// Clean up after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: {},
      asPath: '',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession() {
    return {
      data: null,
      status: 'unauthenticated',
    };
  },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Custom matchers
expect.extend({
  toHaveBeenCalledWithMatch(received, expected) {
    const pass = received.mock.calls.some(call => expect(call[0]).toMatchObject(expected));
    return {
      pass,
      message: () =>
        `expected ${received.getMockName()} to have been called with an object matching ${JSON.stringify(
          expected
        )}`,
    };
  },
});
