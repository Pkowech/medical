import { SetMetadata } from '@nestjs/common';
import { isPublicKey } from '../constants/auth.constants';

/**
 * Mark endpoint as public (no authentication required)
 */
export const Public = () => SetMetadata(isPublicKey, true);
