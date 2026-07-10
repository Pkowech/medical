import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SecurityService } from '../services/security.service';
// request.user is added by authentication middleware; keep typing flexible

@Injectable()
export class EmailVerificationGuard implements CanActivate {
  constructor(private securityService: SecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest(); // allow access to `user`
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const isVerified = await this.securityService.isEmailVerified(user.id);

    if (!isVerified) {
      throw new UnauthorizedException('Email verification required');
    }

    return true;
  }
}
