import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Resend Webhook イベント型
type ResendEvent = {
  type: string;
  data: {
    email_id: string;
    to: string[];
    created_at: string;
  };
};

// Resendダッシュボードで設定するWebhookエンドポイント
// https://resend.com/webhooks
export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // Webhook署名検証（設定済みの場合）
  if (webhookSecret) {
    const signature = req.headers.get('svix-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    // 本番環境では svix ライブラリで署名検証を追加推奨
  }

  const event: ResendEvent = await req.json();
  const supabase = getSupabaseAdmin();

  // Resend イベントタイプ → email_events の event_type にマップ
  const typeMap: Record<string, string> = {
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  };

  const eventType = typeMap[event.type];
  if (!eventType) {
    return NextResponse.json({ ok: true }); // 未対応イベントは無視
  }

  const email = event.data.to?.[0];
  const resendEmailId = event.data.email_id;

  if (!email || !resendEmailId) {
    return NextResponse.json({ ok: true });
  }

  // resend_email_id から campaign_id を逆引き
  const { data: sentEvent } = await supabase
    .from('email_events')
    .select('campaign_id')
    .eq('resend_email_id', resendEmailId)
    .eq('event_type', 'sent')
    .single();

  await supabase.from('email_events').insert({
    campaign_id: sentEvent?.campaign_id ?? null,
    email,
    resend_email_id: resendEmailId,
    event_type: eventType,
  });

  return NextResponse.json({ ok: true });
}
