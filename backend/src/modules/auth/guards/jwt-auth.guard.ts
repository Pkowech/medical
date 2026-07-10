import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { isPublicKey } from '#common/constants/auth.constants';
import { TokenBlacklistService } from '../services/token-blacklist.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(isPublicKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Skip authentication for public endpoints
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const routePath = request.route?.path || request.url;

    if (!authHeader) {
      this.logger.warn(`Missing authorization header for ${routePath}`);
      throw new UnauthorizedException('Missing authorization header');
    }

    try {
      // Try JWT authentication
      const result = await super.canActivate(context);

      if (result && request.user) {
        this.logger.debug(`User authenticated for ${routePath}: ${request.user.id}`);
        
        // Check if token is blacklisted
        const token = authHeader?.replace('Bearer ', '');

        if (token) {
          // Check if token has been blacklisted (e.g., after logout)
          const isBlacklisted =
            await this.tokenBlacklistService.isBlacklisted(token);
          if (isBlacklisted) {
            this.logger.warn(`Token blacklisted for ${routePath}`);
            throw new UnauthorizedException('Token has been revoked');
          }
        }
      } else {
        this.logger.error(`JWT validation failed for ${routePath}: no user in request`);
      }

      return result as boolean;
    } catch (error) {
      const errorMsg = (error as any).message || 'Unknown error';
      this.logger.error(`JWT validation error for ${routePath}: ${errorMsg}`);
      throw new UnauthorizedException(
        `JWT validation failed: ${errorMsg}`,
      );
    }
  }

  /**
   * Handle JWT authentication errors more gracefully
   */
  // Use generic signature to match AuthGuard's handleRequest typing
  handleRequest<TUser = any>(
    err: any,
    user: TUser | null,
    info: any,
  ): TUser | null {
    if (err || !user) {
      this.logger.error(`JWT Auth failed. err: ${err}, info: ${info?.message || info}`);
      throw err || new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
