import { SetMetadata } from '@nestjs/common';

export const rolesKey = 'roles';
export const resourceKey = 'resource';
export const actionKey = 'action';
export const allowguestKey = 'allowguest';
export const isPublicKey = 'isPublic';
export const Public = () => SetMetadata(isPublicKey, true);
