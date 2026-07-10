/**
 * Core API response interfaces for consistent response handling
 */
import { PaginationMeta } from '@/shared/types/systemInterface';

/**
 * Base response interface for all API responses
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  metadata?: {
    timestamp: string;
    version?: string;
  };
}

/**
 * Common paginated response type with strongly typed data
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Extended paginated response with metadata
 */
export interface PaginatedResponse<T> extends ApiResponse<PaginatedResult<T>> {
  pagination: PaginationMeta;
}

/**
 * Generic error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}
