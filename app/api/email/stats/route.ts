import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { searchParams } = new URL(req.url);
  const filterListId = searchParams.get('list_id');

  // キャンペーン一覧を取得（list_id・body_html含む）
  let query = supabase
    .from('email_campaigns')
    .select('id, subject, body_html, body_text, status, total_sent, created_at, sent_at, list_id')
    .order('created_at', { ascending: false });
  if (filterListId) query = query.eq('list_id', filterListId);
  const { data: campaigns, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!campaigns || campaigns.length === 0) return NextResponse.json([]);

  // リスト名を取得
  const listIds = [...new Set(campaigns.map((c) => c.list_id).filter(Boolean))];
  const listNameMap: Record<string, string> = {};
  if (listIds.length > 0) {
    const { data: lists } = await supabase.from('email_list_groups').select('id, name').in('id', listIds);
    for (const l of lists ?? []) listNameMap[l.id] = l.name;
  }

  // 各キャンペーンのイベント集計
  const campaignIds = campaigns.map((c) => c.id);
  const { data: events } = await supabase
    .from('email_events')
    .select('campaign_id, event_type')
    .in('campaign_id', campaignIds)
    .in('event_type', ['opened', 'bounced']);

  const stats: Record<string, { opened: number; bounced: number }> = {};
  for (const ev of events ?? []) {
    if (!stats[ev.campaign_id]) stats[ev.campaign_id] = { opened: 0, bounced: 0 };
    if (ev.event_type === 'opened') stats[ev.campaign_id].opened++;
    if (ev.event_type === 'bounced') stats[ev.campaign_id].bounced++;
  }

  const result = campaigns.map((c) => {
    const s = stats[c.id] ?? { opened: 0, bounced: 0 };
    const pct = (n: number) => c.total_sent > 0 ? `${((n / c.total_sent) * 100).toFixed(1)}%` : '-%';
    return {
      ...c,
      list_name: c.list_id ? (listNameMap[c.list_id] ?? '不明') : 'すべて',
      opened: s.opened,
      bounced: s.bounced,
      open_rate: pct(s.opened),
      bounce_rate: pct(s.bounced),
    };
  });

  return NextResponse.json(result);
}
