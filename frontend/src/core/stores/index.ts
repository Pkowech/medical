// src/store/index.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User as SharedUser } from '@/shared/types/authInterface';
interface Course {
  id: string /* ... */;
}
type UserState = SharedUser;
import type { Material as SharedMaterial } from '@/shared/types/materialInterface';

type Material = SharedMaterial;
interface SettingsState {
  email: string;
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  notifications: { email: boolean; push: boolean; weeklyDigest: boolean };
  security: { twoFactorEnabled: boolean; loginNotifications: boolean };
  preferences: { language: string; timezone: string };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showEmail: boolean;
    showPhone: boolean;
    showLocation: boolean;
    allowMessages: boolean;
  };
}

interface AppState {
  user: UserState | null;
  setUser: (user: UserState | null) => void;

  courses: Record<string, Course>;
  setCourses: (courses: Course[]) => void;
  addCourse: (course: Course) => void;
  updateCourse: (id: string, course: Partial<Course>) => void;
  removeCourse: (id: string) => void;

  materials: Record<string, Material>;
  setMaterials: (materials: Material[]) => void;
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, material: Partial<Material>) => void;
  removeMaterial: (id: string) => void;

  settings: SettingsState;
  updateSettings: (settings: Partial<SettingsState>) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  loading: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;

  errors: Record<string, unknown>;
  setError: (key: string, error: unknown) => void;
  clearErrors: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, _get) => ({
      // User state
      user: null,
      setUser: user => set({ user }),

      // Course state
      courses: {},
      setCourses: courses =>
        set({
          courses: courses.reduce(
            (acc, course) => ({
              ...acc,
              [course.id]: course,
            }),
            {} as Record<string, Course>
          ),
        }),
      addCourse: course =>
        set(state => ({
          courses: { ...state.courses, [course.id]: course },
        })),
      updateCourse: (id, course) =>
        set(state => ({
          courses: {
            ...state.courses,
            [id]: { ...state.courses[id], ...course },
          },
        })),
      removeCourse: id =>
        set(state => {
          const { [id]: _removed, ...courses } = state.courses;
          return { courses };
        }),

      // Material state
      materials: {},
      setMaterials: materials =>
        set({
          materials: materials.reduce(
            (acc, material) => ({
              ...acc,
              [material.id]: material,
            }),
            {} as Record<string, Material>
          ),
        }),
      addMaterial: material =>
        set(state => ({
          materials: { ...state.materials, [material.id]: material },
        })),
      updateMaterial: (id, material) =>
        set(state => ({
          materials: {
            ...state.materials,
            [id]: { ...state.materials[id], ...material },
          },
        })),
      removeMaterial: id =>
        set(state => {
          const { [id]: _removed, ...materials } = state.materials;
          return { materials };
        }),

      // Settings state
      settings: {
        email: '',
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        notifications: { email: true, push: false, weeklyDigest: false },
        security: { twoFactorEnabled: false, loginNotifications: true },
        preferences: { language: 'en', timezone: 'UTC' },
        privacy: {
          profileVisibility: 'public',
          showEmail: true,
          showPhone: false,
          showLocation: false,
          allowMessages: true,
        },
      },
      updateSettings: settings =>
        set(state => ({
          settings: { ...state.settings, ...settings },
        })),

      // UI state
      sidebarOpen: true,
      setSidebarOpen: open => set({ sidebarOpen: open }),
      theme: 'light',
      setTheme: theme => set({ theme }),

      // Loading states
      loading: {},
      setLoading: (key, loading) =>
        set(state => ({
          loading: { ...state.loading, [key]: loading },
        })),

      // Error states
      errors: {},
      setError: (key, error) =>
        set(state => ({
          errors: error
            ? { ...state.errors, [key]: error }
            : Object.fromEntries(Object.entries(state.errors).filter(([k]) => k !== key)),
        })),
      clearErrors: () => set({ errors: {} }),
    }),
    {
      name: 'app-storage',
      partialize: state => ({
        user: state.user,
        settings: state.settings,
        theme: state.theme,
      }),
    }
  )
);
