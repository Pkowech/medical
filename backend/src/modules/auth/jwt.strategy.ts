import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import type { AuthenticatedUser } from '#common/dto';
import type { JwtPayload } from '#common/dto/security.dto';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret =
      configService.get<string>('JWT_SECRET') ||
      configService.get<string>('NEXTAUTH_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_SECRET or NEXTAUTH_SECRET environment variable is not set',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });

    this.jwtSecret = secret;
    this.logger.debug('JWT strategy initialized successfully');
  }

  async validate(
    _req: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    try {
      if (!payload.sub) {
        this.logger.error('JWT payload missing "sub" claim', payload);
        throw new UnauthorizedException('Invalid token: missing subject');
      }

      const user: AuthenticatedUser =
        await this.authService.validateUser(payload);
      
      if (!user) {
        this.logger.warn(`User not found for token subject: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${(error as any).message}`, {
        payload: { ...payload, sub: '[REDACTED]' },
      });
      throw error;
    }
  }
}
