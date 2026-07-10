import { User, Course, Material, Settings } from './index';
export interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;

  // Course state
  courses: Record<string, Course>;
  setCourses: (courses: Course[]) => void;
  addCourse: (course: Course) => void;
  updateCourse: (id: string, course: Partial<Course>) => void;
  removeCourse: (id: string) => void;

  // Material state
  materials: Record<string, Material>;
  setMaterials: (materials: Material[]) => void;
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, material: Partial<Material>) => void;
  removeMaterial: (id: string) => void;

  // Settings state
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Loading states
  loading: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;

  // Error states
  errors: Record<string, string>;
  setError: (key: string, error: string | null) => void;
  clearErrors: () => void;
}
