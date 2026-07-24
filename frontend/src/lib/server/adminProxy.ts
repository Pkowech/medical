import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/features/auth/services/nextauth';
import { Role } from '@/shared/enums/role.enum';

export async function proxyToAdmin(req: NextRequest, backendPath: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin =
      session.user.role === Role.admin ||
      session.user.roles?.includes(Role.admin);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const base = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
    const url = `${base}${backendPath}${req.nextUrl.search || ''}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.user.accessToken}`,
    };

    // copy content-type if present
    const ct = req.headers.get('content-type');
    if (ct) headers['Content-Type'] = ct;

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // preserve raw body
      const body = await req.text();
      init.body = body;
    }

    const res = await fetch(url, init);
    const bodyText = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json';

    return new NextResponse(bodyText, {
      status: res.status,
      headers: { 'content-type': contentType },
    });
  } catch (error) {
    console.error('adminProxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
