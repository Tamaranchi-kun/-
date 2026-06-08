import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyToken } from '@/lib/email-compliance';

export const runtime = 'nodejs';

// 1x1 透明GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function gif() {
  return new NextResponse(new Uint8Array(TRANSPARENT_GIF), {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('cid');
  const email = searchParams.get('email');
  const token = searchParams.get('t');

  // 署名付きURLのみ受理（偽の開封注入・開封率水増しを防止）。失敗時も常にGIFは返す。
  if (
    campaignId &&
    email &&
    UUID_RE.test(campaignId) &&
    verifyToken('track', `${campaignId}:${email.trim().toLowerCase()}`, token)
  ) {
    try {
      const supabase = getSupabaseAdmin();
      // 同一(キャンペーン,メール)の開封は1回だけ記録（プリフェッチ等による水増しを抑制）
      const { data: existing } = await supabase
        .from('email_events')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('email', email)
        .eq('event_type', 'opened')
        .limit(1)
        .maybeSingle();
      if (!existing) {
        await supabase.from('email_events').insert({ campaign_id: campaignId, email, event_type: 'opened' });
      }
    } catch {
      // トラッキング失敗はサイレント
    }
  }

  return gif();
}
