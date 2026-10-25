import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Lightweight same-origin probe for offline sync / connectivity checks. */
export function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export function HEAD() {
  return GET();
}
