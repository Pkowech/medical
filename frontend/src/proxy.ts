import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { JWT } from 'next-auth/jwt';
import { Role } from '@/shared/enums/role.enum';
import { getRolePermissions, hasPermission } from '@/lib/auth/roles';

interface AuthenticatedRequest extends NextRequest {
  nextauth: {
    token: JWT | null;
  };
}

// Minimal typed shape for the JWT payload used in middleware
// Use an intersection type with JWT to avoid incompatible redeclaration
export type CustomToken = JWT & {
  accessToken?: string;
  refreshToken?: string;
  error?: string | null;
  exp?: number;
  permissions?: string[];
  // Role may be an enum value or a string from older tokens
  role?: Role | string;
};

// Define protected routes and required permissions
const protectedRoutes: Record<string, string> = {
  '/dashboard': 'access_courses',
  '/profile': 'manage_profile',
  '/courses/manage': 'manage_courses',
  '/courses/create': 'create_content',
  '/admin': 'manage_system',
  '/admin/users': 'manage_users',
  '/admin/roles': 'manage_roles',
  '/admin/audit': 'view_audit_logs',
  '/analytics': 'view_analytics',
  '/study-groups': 'join_study_groups',
  '/study-groups/manage': 'manage_study_groups',
  '/assessments': 'take_assessments',
  '/assessments/manage': 'manage_assessments',
  '/content/moderate': 'moderate_content',
};

const publicPathRoots = [
  '/',
  '/about',
  '/contact',
  '/features',
  '/pricing',
  '/privacy',
  '/terms',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/resend-verification',
  '/error',
  '/auth/error',
  '/unauthorized',
];

function isPublicPath(pathname: string): boolean {
  return publicPathRoots.some(
    path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))
  );
}

function redirectToLogin(req: NextRequest): NextResponse {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set(
    'callbackUrl',
    `${req.nextUrl.pathname}${req.nextUrl.search}`
  );
  return NextResponse.redirect(loginUrl);
}

// Debug logger
function log(message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug(`[Auth Middleware] ${message}`, data ?? '');
  }
}

export default withAuth(
  function proxy(req: AuthenticatedRequest) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Cast token to access custom properties with an explicit type
    const customToken = (token as unknown as CustomToken) ?? null;

    // Log incoming request for diagnosis
    log('Incoming request', {
      pathname,
      hasToken: Boolean(token),
      hasAccessToken: Boolean(customToken?.accessToken),
      error: customToken?.error,
      tokenExpiry: customToken && typeof customToken.exp === 'number'
        ? new Date(customToken.exp * 1000).toISOString()
        : 'none',
    });

    // Check token validity: must have token AND accessToken AND no error
    const hasValidToken = Boolean(token && customToken?.accessToken && !customToken?.error);

    const isPublic = isPublicPath(pathname);

    // If it's a public path, allow access. If user is authenticated, redirect to dashboard.
    if (isPublic) {
      if (hasValidToken && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
        log('Authenticated user redirected from auth pages to dashboard');
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      return NextResponse.next();
    }

    // If no valid token, redirect to login (not home page)
    if (!hasValidToken) {
      log('Session invalid or expired, redirecting to login', {
        pathname,
        hasToken: Boolean(token),
        hasAccessToken: Boolean(customToken?.accessToken),
        error: customToken?.error,
      });
      return redirectToLogin(req);
    }

    const userRole = token?.role as Role | undefined;
    const userPermissions = (token?.permissions as string[]) || [];

    log('Checking route protection');
    // Sort routes by length descending to match more specific paths first
    const sortedRoutes = Object.keys(protectedRoutes).sort((a, b) => b.length - a.length);

    // Find the first protected route that matches the current pathname
    const requiredPermissionKey = sortedRoutes.find(route => pathname.startsWith(route));

    if (requiredPermissionKey) {
      const requiredPermission = protectedRoutes[requiredPermissionKey];

      // The user must be authenticated to access any protected route.
      // The `withAuth` HOC already handles redirection for unauthenticated users
      // based on the `authorized` callback, but an explicit check here is safer.
      if (!token || !userRole) {
        log('Access denied: Unauthenticated user trying to access protected route', { pathname });
        // Redirect to login page
        return NextResponse.redirect(new URL('/login', req.url));
      }

      // Check if user has access via role-based permissions or explicit permissions
      const hasRolePermission = hasPermission(
        userRole,
        requiredPermission as never
      );
      const hasExplicitPermission = userPermissions.includes(requiredPermission);
      const hasAccess = hasRolePermission || hasExplicitPermission;
      log('Permission check:', {
        route: requiredPermissionKey,
        requiredPermission,
        userRole,
        hasAccess,
        inheritedPermissions: getRolePermissions(userRole),
      });

      if (!hasAccess) {
        log('Access denied - redirecting to unauthorized', {
          pathname,
          userRole,
          requiredPermission,
        });
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    log('Access granted');
    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Always allow public paths
        if (isPublicPath(pathname)) {
          return true;
        }

        // Check if token exists and is not marked with an error
        const customToken = token as CustomToken | null;
        if (!token || customToken?.error) {
          return false;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!api/auth|api/backend|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
