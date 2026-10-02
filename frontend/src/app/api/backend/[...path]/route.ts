import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function backendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!raw) {
    throw new Error('BACKEND_URL is not configured');
  }

  const normalized = raw.trim().replace(/\/+$/, '');
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

async function forward(request: NextRequest, path: string[]) {
  let targetUrl: URL;
  try {
    targetUrl = new URL(
      `${backendBaseUrl()}/${path.map(segment => encodeURIComponent(segment)).join('/')}`,
    );
  } catch (error) {
    console.error('[Backend Proxy] Invalid backend configuration:', error);
    return NextResponse.json(
      { success: false, message: 'Backend API is not configured' },
      { status: 500 },
    );
  }

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  if (token?.accessToken) {
    headers.set('authorization', `Bearer ${token.accessToken}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
      signal: controller.signal,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Backend request timed out'
      : 'Backend request failed';
    console.error('[Backend Proxy] Request failed:', error);
    return NextResponse.json({ success: false, message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}
