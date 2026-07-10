import { SetMetadata } from '@nestjs/common';

export const actionKey = 'action';

/**
 * Attach an action name to a route.
 * Example: @Action('create')
 */
export const Action = (action: string) => SetMetadata(actionKey, action);
