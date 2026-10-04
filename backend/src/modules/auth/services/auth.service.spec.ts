import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { Role } from '../constants/role.constants';
import { AuditLogService } from './audit-log.service';
import { AuthService } from './auth.service';
import { PermissionCalculationService } from './permission-calculation.service';
import { RefreshTokenService } from './refresh-token.service';
import { RolesService } from './roles.service';
import { SecurityService } from './security.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { UsersService } from './users.service';
import { RoleLimitingService } from './role-limiting.service';

describe('AuthService Google authentication', () => {
  const profile = {
    sub: 'google-subject',
    email: 'student@example.com',
    email_verified: true,
    given_name: 'Medical',
    family_name: 'Student',
    picture: 'https://example.com/avatar.png',
  };
  const user = {
    id: 'user-1',
    email: profile.email,
    username: 'medical-student',
    firstName: profile.given_name,
    lastName: profile.family_name,
    isActive: true,
    isLocked: false,
    lockedUntil: null,
    userRoles: [{ role: { name: Role.student } }],
  };

  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    userSecuritySettings: { upsert: jest.Mock };
  };
  let usersService: { create: jest.Mock };
  let verifyIdToken: jest.SpyInstance;

  const setGoogleProfile = (googleProfile: typeof profile) => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => googleProfile,
    });
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      userSecuritySettings: { upsert: jest.fn() },
    };
    usersService = { create: jest.fn().mockResolvedValue({ id: user.id }) };

    service = new AuthService(
      prisma as unknown as PrismaService,
      { signAsync: jest.fn().mockResolvedValue('app-access-token') } as unknown as JwtService,
      { isEmailVerified: jest.fn().mockResolvedValue(true) } as unknown as SecurityService,
      {
        createRefreshToken: jest.fn().mockResolvedValue('app-refresh-token'),
      } as unknown as RefreshTokenService,
      {} as TokenBlacklistService,
      { log: jest.fn() } as unknown as AuditLogService,
      {} as RedisService,
      {
        getEffectivePermissionsForRole: jest.fn().mockResolvedValue(['access_courses']),
      } as unknown as PermissionCalculationService,
      usersService as unknown as UsersService,
      {} as RolesService,
      {} as RoleLimitingService,
      {
        get: jest.fn((key: string) =>
          key === 'GOOGLE_CLIENT_ID' ? 'google-client-id' : undefined,
        ),
      } as unknown as ConfigService,
    );

    verifyIdToken = jest.spyOn(google.auth.OAuth2.prototype, 'verifyIdToken');
    setGoogleProfile(profile);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a verified student account only after accepted terms and issues app tokens', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const result = await service.loginWithGoogle(
      { idToken: 'google-id-token', acceptTerms: true },
      '127.0.0.1',
      'test-agent',
    );

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'google-id-token',
      audience: 'google-client-id',
    });
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: profile.email,
        firstName: profile.given_name,
        lastName: profile.family_name,
        role: Role.student,
        acceptTerms: true,
      }),
    );
    expect(prisma.userSecuritySettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id },
        update: { isEmailVerified: true },
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'app-access-token',
      refreshToken: 'app-refresh-token',
      user: { id: user.id, email: profile.email, isEmailVerified: true },
      roles: { role: Role.student },
    });
  });

  it('authenticates a matching verified email without creating another account', async () => {
    prisma.user.findFirst.mockResolvedValue(user);

    const result = await service.loginWithGoogle({ idToken: 'google-id-token' });

    expect(usersService.create).not.toHaveBeenCalled();
    expect(prisma.userSecuritySettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id },
        update: { isEmailVerified: true },
        create: {
          userId: user.id,
          isEmailVerified: true,
          acceptTerms: false,
        },
      }),
    );
    expect(result.user.id).toBe(user.id);
  });

  it('requires terms acceptance before provisioning a new student account', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.loginWithGoogle({ idToken: 'google-id-token' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('rejects Google identities without a verified email', async () => {
    setGoogleProfile({ ...profile, email_verified: false });

    await expect(
      service.loginWithGoogle({
        idToken: 'google-id-token',
        acceptTerms: true,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an invalid Google ID token', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(
      service.loginWithGoogle({
        idToken: 'invalid-google-id-token',
        acceptTerms: true,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('fails explicitly when Google authentication is not configured', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const unconfiguredService = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      {} as SecurityService,
      {} as RefreshTokenService,
      {} as TokenBlacklistService,
      {} as AuditLogService,
      {} as RedisService,
      {} as PermissionCalculationService,
      usersService as unknown as UsersService,
      {} as RolesService,
      {} as RoleLimitingService,
      config,
    );

    await expect(
      unconfiguredService.loginWithGoogle({ idToken: 'google-id-token' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
