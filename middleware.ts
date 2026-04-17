import { NextRequest, NextResponse } from 'next/server';

// Basic認証で /admin と管理系API（/api/email/*、ただし cron/webhook/track は除外）を保護する
const REALM = 'Admin Area';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 除外: cron / webhook / track はサーバー側で独自認証
  if (
    pathname.startsWith('/api/email/cron') ||
    pathname.startsWith('/api/email/webhook') ||
    pathname.startsWith('/api/email/track')
  ) {
    return NextResponse.next();
  }

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数未設定の場合は誤って素通りさせない
  if (!user || !pass) {
    return new NextResponse('Admin credentials are not configured', { status: 503 });
  }

  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return unauthorized();

  let decoded = '';
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return unauthorized();
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  if (!timingSafeEqual(u, user) || !timingSafeEqual(p, pass)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/email/:path*'],
};
