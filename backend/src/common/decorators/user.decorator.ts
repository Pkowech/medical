import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as UserModel } from '@prisma/client';

export const UserParam = createParamDecorator(
  (data: keyof UserModel, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: UserModel }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Backwards-compatible alias: some controllers import { User } from this file
// so export `User` as an alias to `UserParam`.
export const User = UserParam;
