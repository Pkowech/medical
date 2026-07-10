'use client';

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  ReactNode,
  useEffect,
} from 'react';
// AuthProvider removed — using Zustand `useAuthStore` as single source of truth
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import SessionWrapper from '@/features/auth/components/SessionWrapper';
import { triggerNotificationsRefresh } from '@/features/community/notificationEvents';

// Theme context interface
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Custom hook to access theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Centralized theme provider supporting 'system' preference and sync
const SimpleThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  type Theme = 'light' | 'dark' | 'system';
  const STORAGE_KEY = 'medtrack-theme';

  const [theme, setThemeState] = useState<Theme>('system');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  // Initialize theme synchronously on first paint (useLayoutEffect)
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw === 'dark' || raw === 'light' ? (raw as Theme) : 'system';
      setThemeState(saved);
      // apply resolved scheme immediately
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = saved === 'system' ? (prefersDark ? 'dark' : 'light') : saved;
      setColorScheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    } catch {
      // If localStorage is unavailable, fall back to system
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = prefersDark ? 'dark' : 'light';
      setColorScheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    }
  }, []);

  // Effect: react to theme state changes and persist
  useEffect(() => {
    try {
      // resolve color scheme
      let resolved: 'light' | 'dark';
      if (theme === 'system') {
        const prefersDark =
          window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolved = prefersDark ? 'dark' : 'light';
        setColorScheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        // don't persist 'system' as a concrete class, store as 'system'
        localStorage.setItem(STORAGE_KEY, 'system');
      } else {
        resolved = theme === 'dark' ? 'dark' : 'light';
        setColorScheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        localStorage.setItem(STORAGE_KEY, theme);
      }

      // Helpful debug line to confirm which theme was applied at runtime
      try {
        console.warn('[Theme] applied', { theme, resolved });
      } catch {}
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const resolved = e.matches ? 'dark' : 'light';
        setColorScheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const raw = e.newValue;
        const newTheme = raw === 'dark' || raw === 'light' ? (raw as Theme) : 'system';
        setThemeState(newTheme);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = React.useMemo(
    () => ({ theme, colorScheme, setTheme, toggleTheme }),
    [theme, colorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Export canonical ThemeProvider alias for other imports
export const ThemeProvider = SimpleThemeProvider;

// Providers wrapper for theme and auth
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (failureCount: number, error: unknown) => {
              const status = (error as { status?: number })?.status;
              if (status === 404) return false;
              return failureCount < 3;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  // Lightweight WebSocket client to listen for server-side events and trigger
  // a notifications refresh when the backend signals new notifications.
  // Configuration: set NEXT_PUBLIC_WS_URL to the full ws:// or wss:// URL if the
  // server lives on a different host. Otherwise we default to `${window.location.host}/ws`.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const defaultProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const envUrl = (process.env as { NEXT_PUBLIC_WS_URL?: string }).NEXT_PUBLIC_WS_URL;
    const wsUrl = envUrl || `${defaultProtocol}://${window.location.host}/ws`;

    let ws: WebSocket | null = null;
    let reconnectDelay = 1000; // start with 1s
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let manuallyClosed = false;

    const scheduleReconnect = () => {
      if (manuallyClosed) return;
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000); // cap at 30s
        connect();
      }, reconnectDelay);
    };

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        // Could not construct WebSocket (invalid URL etc.)
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        // reset backoff
        reconnectDelay = 1000;
      };

      ws.onmessage = ev => {
        try {
          const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          const type = payload?.type ?? payload?.event;
          // Recognise a few common notification event types; call the trigger helper
          if (
            type === 'notifications:update' ||
            type === 'notifications:new' ||
            payload?.notifications
          ) {
            try {
              triggerNotificationsRefresh();
            } catch {
              // swallow errors from the trigger helper
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        ws = null;
        if (!manuallyClosed) scheduleReconnect();
      };

      ws.onerror = () => {
        // Let onclose handle reconnect scheduling
        try {
          ws?.close();
        } catch {}
      };
    };

    connect();

    return () => {
      manuallyClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  return (
    <SimpleThemeProvider>
      <QueryClientProvider client={client}>
        <SessionWrapper>{children}</SessionWrapper>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SimpleThemeProvider>
  );
}
