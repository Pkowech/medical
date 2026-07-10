// Analytics system-related types. Keep only interfaces here; implementations belong in services/.
import { UserAnalytics } from '@/shared/types/analyticsInterface';
import { ApiResponse } from './base-responseInterface';
export interface SystemOverview {
  activeUsers?: number;
  registeredUsers?: number;
  totalUsers?: number;
  newUsersToday?: number;
  totalSessions?: number;
  averageSessionDuration?: number;
  peakConcurrentUsers?: number;
  systemHealth?: number;
  errorRate?: number;
  serverLoad?: number;
  totalCourses?: number;
  activeCourses?: number;
  totalStudyHours?: number;
  databaseMetrics?: {
    queryResponseTime?: number;
    cacheHitRate?: number;
    connections?: number;
    storageUsage?: number;
  };
  uptime?: number;
  lastUpdated?: string | number;
}

export interface UserActivityMetric {
  timestamp?: string;
  date?: string;
  activeUsers?: number;
  newRegistrations?: number;
  sessionsStarted?: number;
  engagementScore?: number;
  logins?: number;
  studySessions?: number;
  messagesSent?: number;
}

export interface ContentPerformanceMetric {
  id?: string;
  contentId: string;
  type: 'course' | 'material' | 'assessment';
  title: string;
  views: number;
  completions: number;
  avgScore: number;
  avgTimeSpent: number;
  engagement: number;
  lastUpdated?: string;
}

export interface SystemAnalyticsResponse<T> {
  success: boolean;
  data: T;
}

export interface SystemOverviewResponse extends SystemAnalyticsResponse<SystemOverview> { }
export interface UserActivityResponse extends SystemAnalyticsResponse<UserActivityMetric[]> { }
export interface ContentPerformanceResponse
  extends SystemAnalyticsResponse<ContentPerformanceMetric[]> { }

export interface SystemAnalytics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    totalCourses: number;
    activeCourses: number;
    totalStudyHours: number;
    averageSessionLength: number; // in minutes
    peakUsageTime: string; // HH:mm format
  };
  userActivity: {
    date: string; // YYYY-MM-DD
    logins: number;
    studySessions: number;
    messagesSent: number;
    uniqueUsers: number;
  }[];
  contentPerformance: {
    contentId: string;
    title: string;
    type: 'course' | 'material' | 'assessment';
    views: number;
    completions: number;
    avgScore: number;
    avgTimeSpent: number; // in minutes
    engagement: number; // 0-1 scale
  }[];
}

export interface GetUserAnalyticsResponse {
  success: boolean;
  data: UserAnalytics;
  timestamp: string;
}

export interface GetSystemAnalyticsResponse {
  success: boolean;
  data: SystemAnalytics;
  timestamp: string;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastUpdated?: string | number;
}

export interface PaginationDto {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
  status?: number;
  errorType?: 'network' | 'timeout' | 'auth' | 'validation' | 'server' | 'unknown';
  method?: string;
  timestamp?: string;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface AsyncState<T> extends LoadingState {
  data: T | null;
}

// Form states
export interface FormState<T> {
  data: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
  isActive?: boolean;
  isDisabled?: boolean;
}

// File types
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

// Search types
export interface SearchFilters {
  query?: string;
  category?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  filters: SearchFilters;
  suggestions?: string[];
}

export interface TwoFactorAuthStatus {
  enabled: boolean;
  // Allow explicit null for clients that represent 'no method set' as null
  method?: 'app' | 'sms' | 'email' | null;
  lastEnabledAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  lastActive: string;
  ipAddress?: string;
  isCurrentSession?: boolean;
}

// Consolidated with first definition above

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

// Modal types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

// Table types
export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
  sorting?: {
    column: keyof T;
    direction: 'asc' | 'desc';
    onSort: (column: keyof T, direction: 'asc' | 'desc') => void;
  };
  selection?: {
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  };
}

// Chart types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area';
  data: ChartDataPoint[];
  options?: Record<string, any>;
}
// Permission types - canonical source is in @/lib/auth/roles (Permission enum)
// For permission definitions as data objects, use the PermissionEntity below
export interface PermissionEntity {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface RoleEntity {
  id: string;
  name: string;
  permissions: PermissionEntity[];
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface CustomEvent<T = any> {
  type: string;
  payload: T;
  timestamp: string;
}

// Storage types
export interface StorageItem<T> {
  value: T;
  timestamp: string;
  expiresAt?: string;
}

// Feature flag types
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  conditions?: Record<string, any>;
}

// Settings interface
export interface Settings {
  email: string;
  theme: ThemeMode;
  language?: string;
  timezone?: string;
  notifications: {
    email: boolean;
    push: boolean;
    weeklyDigest: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    loginNotifications: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
  };
  // Privacy settings (optional) — some components expect these fields
  privacy?: {
    profileVisibility?: 'public' | 'private' | 'friends';
    showEmail?: boolean;
    showPhone?: boolean;
    showLocation?: boolean;
    allowMessages?: boolean;
  };
}

// Analytics types
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
}

// Error boundary types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Request configuration
export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

import { ResponseType } from 'axios';

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  withCredentials?: boolean;
  responseType?: ResponseType;
  onUploadProgress?: (progressEvent: ProgressEvent | import('axios').AxiosProgressEvent) => void;
  signal?: AbortSignal;
}

// API Client interface
export interface ApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>;
  patch<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
}

// Search API types
export interface SearchRequest {
  query: string;
  filters?: {
    category?: string;
    difficulty?: string;
    duration?: {
      min?: number;
      max?: number;
    };
    rating?: {
      min?: number;
      max?: number;
    };
    tags?: string[];
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResponse<T> {
  results: T[];
  total: number;
  facets: SearchFacet[];
  suggestions: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

// Health check API types
export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: ServiceHealth[];
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

// Minimal shared service-related types used across the frontend.
// Add fields as required by callers.

export interface Reward {
  id: string;
  // Some components expect `name`, `imageUrl`, `pointsCost` and `redeemedDate`.
  // Keep both `title` and `name` for compatibility.
  title: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  // Old callers used `points` while newer UI uses `pointsCost`.
  points: number;
  pointsCost?: number;
  redeemed?: boolean;
  redeemedDate?: string | null;
}

export interface Integration {
  id: string;
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
  // Optional UI metadata to render config forms
  configFields?: Array<{ key: string; label: string; type: string; default?: any }>;
  currentConfig?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  details?: any;
}

export interface LeaderboardEntry {
  userId: string;
  // UI sometimes expects `userName` and `totalPoints` fields.
  name?: string;
  userName?: string;
  score: number;
  totalPoints?: number;
  rank?: number;
}
export interface AuditLog {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  details: Record<string, any>;
}

export type GetAuditLogsResponse = AuditLog[];

export default {} as const;
