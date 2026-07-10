import { SetMetadata } from '@nestjs/common';

export const resourceKey = 'resource';

/**
 * Attach a resource name to a route.
 * Example: @Resource('courses')
 */
export const Resource = (resource: string) =>
  SetMetadata(resourceKey, resource);
