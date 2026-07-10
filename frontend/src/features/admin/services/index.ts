// Export all admin services from a single location
export { adminService } from './adminService';
export { settingsService, type SystemSettings } from './settingsService';
export { courseService } from '@/features/courses/services/courseService';
export { auditLogService } from './auditLogService';

export type { AdminUserDetails, AdminUser, AdminUserSummary } from '@/shared/types/adminInterface';
