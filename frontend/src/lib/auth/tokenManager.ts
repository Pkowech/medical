import { jwtDecode } from 'jwt-decode';

interface TokenPayload {
  exp: number;
  iat: number;
  jti: string;
  sub: string;
  role: string;
}

type CookieAccessor = {
  get?: (name: string) => { value?: string } | undefined;
  set?: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      path?: string;
      maxAge?: number;
    }
  ) => void;
  delete?: (name: string) => void;
} | null;

async function getServerCookies(): Promise<CookieAccessor> {
  if (typeof document !== 'undefined') {
    return null;
  }

  try {
    const nextHeaders = await import('next/headers');
    return nextHeaders.cookies?.() ?? null;
  } catch {
    return null;
  }
}

export class TokenManager {
  private static readonly ACCESS_TOKEN_COOKIE = 'next-auth.access-token';
  private static readonly REFRESH_TOKEN_COOKIE = 'next-auth.refresh-token';
  private static readonly TOKEN_REFRESH_THRESHOLD = 5 * 60; // 5 minutes in seconds

  static async setTokens(accessToken: string, refreshToken: string) {
    if (typeof document !== 'undefined') {
      document.cookie = `${this.ACCESS_TOKEN_COOKIE}=${accessToken}; path=/; max-age=${60 * 15}; ${process.env.NODE_ENV === 'production' ? 'secure;' : ''} SameSite=Strict;`;
      document.cookie = `${this.REFRESH_TOKEN_COOKIE}=${refreshToken}; path=/; max-age=${60 * 60 * 24 * 7}; ${process.env.NODE_ENV === 'production' ? 'secure;' : ''} SameSite=Strict;`;
      return;
    }

    const cookieStore = await getServerCookies();
    cookieStore?.set?.(this.ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 15,
    });
    cookieStore?.set?.(this.REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  static async getAccessToken(): Promise<string | null> {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(
        new RegExp('(^| )' + this.ACCESS_TOKEN_COOKIE + '=([^;]+)')
      );
      return match ? decodeURIComponent(match[2]) : null;
    }

    const cookieStore = await getServerCookies();
    return cookieStore?.get?.(this.ACCESS_TOKEN_COOKIE)?.value ?? null;
  }

  static async getRefreshToken(): Promise<string | null> {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(
        new RegExp('(^| )' + this.REFRESH_TOKEN_COOKIE + '=([^;]+)')
      );
      return match ? decodeURIComponent(match[2]) : null;
    }

    const cookieStore = await getServerCookies();
    return cookieStore?.get?.(this.REFRESH_TOKEN_COOKIE)?.value ?? null;
  }

  static async shouldRefreshToken(token: string): Promise<boolean> {
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp - now <= this.TOKEN_REFRESH_THRESHOLD;
    } catch {
      return true;
    }
  }

  static async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { accessToken, refreshToken: newRefreshToken } = await response.json();
      await this.setTokens(accessToken, newRefreshToken);
      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  static async clearTokens() {
    if (typeof document !== 'undefined') {
      document.cookie = `${this.ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
      document.cookie = `${this.REFRESH_TOKEN_COOKIE}=; path=/; max-age=0`;
      return;
    }

    const cookieStore = await getServerCookies();
    cookieStore?.delete?.(this.ACCESS_TOKEN_COOKIE);
    cookieStore?.delete?.(this.REFRESH_TOKEN_COOKIE);
  }
}
