import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// Resend Webhook イベント型
type ResendEvent = {
  type: string;
  data: {
    email_id: string;
    to: string[];
    created_at: string;
    bounce?: { type?: string };
  };
};

// Resendダッシュボードで設定するWebhookエンドポイント: https://resend.com/webhooks
// 署名は svix（Resendが採用）で検証する。シークレット未設定時は fail closed（503）。
export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('RESEND_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  // 署名検証は生のリクエストボディに対して行う必要がある
  const payload = await req.text();
  const svixHeaders = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  let event: ResendEvent;
  try {
    event = new Webhook(webhookSecret).verify(payload, svixHeaders) as ResendEvent;
  } catch (err) {
    console.error('webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

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

  // resend_email_id から campaign_id を逆引き（複数行・0件でも壊れないよう maybeSingle）
  const { data: sentEvent } = await supabase
    .from('email_events')
    .select('campaign_id')
    .eq('resend_email_id', resendEmailId)
    .eq('event_type', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from('email_events').insert({
    campaign_id: sentEvent?.campaign_id ?? null,
    email,
    resend_email_id: resendEmailId,
    event_type: eventType,
  });

  // 苦情(complained)・恒久バウンス(hard bounce)は将来の送信から自動的に除外する。
  // 同意撤回後・到達不能アドレスへの再送はレピュテーション崩壊と法令違反につながるため。
  const bounceType = event.data.bounce?.type?.toLowerCase() ?? '';
  const isHardBounce = eventType === 'bounced' && bounceType !== 'soft' && bounceType !== 'transient';
  if (eventType === 'complained' || isHardBounce) {
    const { error: suppressError } = await supabase
      .from('email_lists')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('email', email)
      .is('unsubscribed_at', null);
    if (suppressError) console.error('suppression update failed:', suppressError);
  }

  return NextResponse.json({ ok: true });
}
