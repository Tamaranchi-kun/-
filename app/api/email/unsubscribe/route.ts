import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken, escapeHtml } from '@/lib/email-compliance';

export const runtime = 'nodejs';

// 配信停止エンドポイント（特定電子メール法 第3条 受信拒否対応）。
// Basic認証から除外（middleware.ts）し、HMAC署名トークンで本人性を担保する。
//  - GET : 人間向けの確認ページを返しつつ、トークンが正しければ配信停止を確定する
//  - POST: RFC 8058 List-Unsubscribe One-Click（メールクライアントが自動送信）

async function unsubscribe(email: string, token: string | null): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!verifyToken('unsub', normalized, token)) return false;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('email_lists')
    .update({ unsubscribed_at: new Date().toISOString() })
    .ilike('email', normalized);
  if (error) {
    console.error('unsubscribe update failed:', error);
    return false;
  }
  return true;
}

function page(title: string, message: string, ok: boolean): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0;">
  <div style="max-width:480px;margin:64px auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">${ok ? '✅' : '⚠️'}</div>
    <h1 style="font-size:18px;color:#111827;margin:0 0 12px;">${escapeHtml(title)}</h1>
    <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0;">${escapeHtml(message)}</p>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  if (!email) return page('エラー', 'リクエストが不正です。', false);

  const ok = await unsubscribe(email, token);
  return ok
    ? page('配信停止が完了しました', '今後このアドレスへのメール配信を停止しました。ご利用ありがとうございました。', true)
    : page('配信停止に失敗しました', 'リンクが無効か期限切れの可能性があります。お手数ですが送信元までご連絡ください。', false);
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  if (!email) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const ok = await unsubscribe(email, token);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'invalid token' }, { status: 400 });
}
