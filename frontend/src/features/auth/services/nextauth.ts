import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import {
  User,
  LoginResponsePayload,
  Permission,
} from '@/shared/types/authInterface'; // Rename User to avoid conflict
import { Role } from '@/shared/enums/role.enum'; // Import Role as a value
import { JWT } from 'next-auth/jwt';
import { AuthError, AuthErrorCode, AUTH_ERROR_MESSAGES } from './authErrors';

const isAbortError = (err: unknown): err is { name: string } =>
  typeof err === 'object' &&
  err !== null &&
  'name' in err &&
  (err as { name: string }).name === 'AbortError';

// This function will handle token refreshing
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    // Ensure we have a refresh token before attempting refresh
    if (!token.refreshToken) {
      console.warn('[Token Refresh] No refresh token available');
      return {
        ...token,
        error: 'RefreshAccessTokenError',
      };
    }

    const raw =
      process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:3002';
    
    console.warn('[Token Refresh] Attempting to refresh token from:', raw);
    
    const response = await fetch(`${raw}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: token.refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Token Refresh] Backend returned error:', {
        status: response.status,
        message: data.message || 'Unknown error',
        data,
      });
      throw new Error(data.message || 'Failed to refresh token');
    }

    const refreshedTokens = data.data;

    // Keep the existing refresh token if a new one wasn't provided
    const newRefreshToken = refreshedTokens.refreshToken || token.refreshToken;

    console.warn('[Token Refresh] Successfully refreshed token');

    // Update the token with new values from the refresh endpoint
    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      accessTokenExpires: new Date(refreshedTokens.expiresAt).getTime(),
      refreshToken: newRefreshToken,
      error: undefined, // Clear any previous errors
    };
  } catch (error) {
    console.error('[Token Refresh] Error refreshing access token:', error);

    // Mark the token with refresh error
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions: NextAuthOptions = {
  // Debug mode is too verbose for typical development; enable only when debugging auth specifically
  debug: false,
  providers: [
    // Credentials Provider
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          console.error('Missing credentials');
          return null;
        }

        // Prefer explicit BACKEND_URL, fall back to public envs, then default
        const raw =
          process.env.BACKEND_URL ||
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:3002';
        
        let validBase = (raw || 'http://localhost:3002').trim();
        if (!validBase.startsWith('http://') && !validBase.startsWith('https://')) {
          validBase = `https://${validBase}`;
        }
        let loginUrl: string;
        try {
          loginUrl = new URL('/v1/auth/login', validBase).href;
        } catch {
          loginUrl = 'http://localhost:3002/v1/auth/login';
        }

        const loginBody = {
          password: credentials.password,
          ...(String(credentials.identifier).includes('@')
            ? { email: credentials.identifier }
            : { username: credentials.identifier }),
        };

        // timeout for fetch
        const timeoutMs = 7000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(loginBody),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          const text = await response.text();

          let responseData: LoginResponsePayload = {};
          try {
            responseData = text ? (JSON.parse(text) as LoginResponsePayload) : {};
          } catch {
            // keep raw text if not JSON
            responseData = { raw: text };
          }

          if (!response.ok) {
            console.error('Backend authentication failed:', response.status, responseData);

            const errorMessage = responseData.message || 'Authentication failed';
            let errorCode: AuthErrorCode = AuthErrorCode.INVALID_CREDENTIALS;

            switch (responseData.message) {
              case AUTH_ERROR_MESSAGES[AuthErrorCode.INVALID_CREDENTIALS]:
                errorCode = AuthErrorCode.INVALID_CREDENTIALS;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.ACCOUNT_LOCKED]:
                errorCode = AuthErrorCode.ACCOUNT_LOCKED;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.EMAIL_NOT_VERIFIED]:
                errorCode = AuthErrorCode.EMAIL_NOT_VERIFIED;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.TOKEN_EXPIRED]:
                errorCode = AuthErrorCode.TOKEN_EXPIRED;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.INVALID_TOKEN]:
                errorCode = AuthErrorCode.INVALID_TOKEN;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.INSUFFICIENT_PERMISSIONS]:
                errorCode = AuthErrorCode.INSUFFICIENT_PERMISSIONS;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.RATE_LIMIT_EXCEEDED]:
                errorCode = AuthErrorCode.RATE_LIMIT_EXCEEDED;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.MFA_REQUIRED]:
                errorCode = AuthErrorCode.MFA_REQUIRED;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.INVALID_MFA_CODE]:
                errorCode = AuthErrorCode.INVALID_MFA_CODE;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.SESSION_EXPIRED]:
                errorCode = AuthErrorCode.SESSION_EXPIRED;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.CSRF_TOKEN_INVALID]:
                errorCode = AuthErrorCode.CSRF_TOKEN_INVALID;
                break;
              case AUTH_ERROR_MESSAGES[AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED]:
                errorCode = AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED;
                break;
              default:
                // For any other unexpected errors from backend
                errorCode = AuthErrorCode.INVALID_CREDENTIALS;
                break;
            }

            throw new AuthError(errorMessage, errorCode, response.status);
          }

          const user = responseData.data?.user;
          const accessToken = responseData.data?.accessToken;
          const refreshToken = responseData.data?.refreshToken;
          const expiresAt = responseData.data?.expiresAt; // Extract expires_at

          if (!user || !accessToken || !expiresAt) {
            console.error('Unexpected backend response shape for login:', responseData);
            throw new Error('Authentication failed: Invalid user data received from backend.');
          }

          const roles = responseData.data?.roles;
          
          const userObj: User = {
            id: (user?.id as string) || '',
            email: (user?.email as string) || '',
            firstName: (user?.firstName as string | null) || null,
            lastName: (user?.lastName as string | null) || null,
            username: (user?.username as string) || '',
            role: (roles?.role as unknown as Role) || (user?.role as unknown as Role) || Role.guest,
            roles: (roles?.roles as Role[]) || (user?.roles as Role[]) || (user?.role ? [(user.role as unknown as Role)] : []),
            isEmailVerified: (user?.isEmailVerified as boolean) || false,
            permissions: ((roles?.permissions as string[]) || (user?.permissions as string[]) || []) as unknown as Permission[],
            accessToken: accessToken,
            refreshToken: refreshToken || '',
            accessTokenExpires: new Date(expiresAt as string).getTime(),
          };

          return userObj;
        } catch (err) {
          clearTimeout(timeout);
          if (isAbortError(err)) {
            console.error('Authorize error: request to backend timed out after', timeoutMs, 'ms');
          } else {
            console.error('Authorize error calling backend:', err);
          }
          const message =
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred during authentication.';
          throw new Error(message);
        }
      },
    }),

    // Google Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // GitHub Provider
    GithubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }): Promise<JWT> {
      if (account && user) {
        const sessionUser = user as User;
        return {
          ...token,
          id: user.id,
          role: user.role as Role,
          roles: sessionUser.roles || [user.role as Role], // Store all user roles
          accessToken: sessionUser.accessToken || '',
          permissions: sessionUser.permissions || [],
          accessTokenExpires: sessionUser.accessTokenExpires || Date.now() + 24 * 60 * 60 * 1000,
          refreshToken: sessionUser.refreshToken ?? '',
          firstName: sessionUser.firstName,
          lastName: sessionUser.lastName,
          error: undefined,
        };
      }

      // If no access token expiration is set, return token as-is
      if (!token.accessTokenExpires) {
        return token;
      }

      // Return previous token if the access token has not expired yet
      // Refresh 5 minutes before expiry to avoid edge cases
      const refreshBuffer = 5 * 60 * 1000; // 5 minutes
      const timeUntilExpiry = (token.accessTokenExpires as number) - Date.now();
      
      if (
        typeof token.accessTokenExpires === 'number' &&
        timeUntilExpiry > refreshBuffer
      ) {
        return token;
      }

      console.warn('[JWT Callback] Token expiring soon or expired, attempting refresh...');

      // If token has expired or is about to expire, try to refresh it
      if (token.refreshToken) {
        const refreshedToken = await refreshAccessToken(token);

        // If refresh succeeded (no error), return the new token
        if (!refreshedToken.error) {
          return refreshedToken;
        }

        // If refresh failed but we still have a valid access token, keep using it
        if (
          token.accessToken &&
          token.accessTokenExpires &&
          Date.now() < token.accessTokenExpires
        ) {
          return token;
        }
      }

      console.error('[JWT Callback] Token refresh failed and no valid token available, marking as error');
      // If we get here, both refresh and current token are invalid
      return {
        ...token,
        error: 'TokenExpiredError',
      } as unknown as JWT;
    },

    async session({ session, token }) {
      // If token has a refresh error, create an invalid session that will force re-auth
      if (token.error === 'RefreshAccessTokenError' || token.error === 'TokenExpiredError') {
        // Return a session with error flag instead of null
        return {
          ...session,
          error: token.error,
          user: {
            ...session.user,
            accessToken: '',
            accessTokenExpires: 0, // Expired
          },
        };
      }

      // Check if session is being returned after sign-out (no access token)
      if (!token.accessToken) {
        return {
          ...session,
          error: 'NoAccessToken',
          user: {
            ...session.user,
            accessToken: '',
            accessTokenExpires: 0,
          },
        };
      }

      // Send properties to the client, such as an access_token from a provider.
      session.user.accessToken = (token.accessToken as string) || '';
      session.user.accessTokenExpires = (token.accessTokenExpires as number) || Date.now();
      session.user.refreshToken = (token.refreshToken as string) || '';
      session.error = typeof token.error === 'string' ? token.error : undefined;
      session.user.id = (token.id as string) || '';
      session.user.role = (token.role as Role) || Role.guest;
      session.user.roles = ((token.roles as Role[]) || [token.role as Role]) as Role[];
      session.user.permissions = (token.permissions as string[]) || [];
      session.user.firstName = (token.firstName as string) || '';
      session.user.lastName = (token.lastName as string) || '';
      return session;
    },



    async redirect({ url, baseUrl }) {
      try {
        let validBase = (baseUrl || 'http://localhost:3000').trim();
        if (!validBase.startsWith('http://') && !validBase.startsWith('https://')) {
          validBase = `https://${validBase}`;
        }
        if (url && url.startsWith('/')) return `${validBase}${url}`;
        if (url) {
          let validUrl = url.trim();
          if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            validUrl = `https://${validUrl}`;
          }
          if (new URL(validUrl).origin === new URL(validBase).origin) return url;
        }
        return new URL('/dashboard', validBase).toString();
      } catch {
        return '/dashboard';
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - how frequently to extend session
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days - matches session maxAge
  },

  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};
