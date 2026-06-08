import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  // 認証は proxy.ts の Basic 認証で行う
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

  // 各キャンペーンのイベント集計。
  // 開封率の水増し対策として「(キャンペーン,メール)単位の一意」で数える
  // （自前ピクセルとResendネイティブの二重計上・プリフェッチ重複・再送重複を排除）。
  // PostgRESTの暗黙1000件上限による無音の過少集計を避けるためページングする。
  const campaignIds = campaigns.map((c) => c.id);
  const PAGE = 1000;
  const seen: Record<string, { opened: Set<string>; bounced: Set<string> }> = {};
  for (let from = 0; ; from += PAGE) {
    const { data: events, error: evErr } = await supabase
      .from('email_events')
      .select('campaign_id, email, event_type')
      .in('campaign_id', campaignIds)
      .in('event_type', ['opened', 'bounced'])
      .range(from, from + PAGE - 1);
    if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
    if (!events || events.length === 0) break;
    for (const ev of events) {
      const bucket = (seen[ev.campaign_id] ??= { opened: new Set(), bounced: new Set() });
      const key = ev.email ?? '';
      if (ev.event_type === 'opened') bucket.opened.add(key);
      else if (ev.event_type === 'bounced') bucket.bounced.add(key);
    }
    if (events.length < PAGE) break;
  }

  const result = campaigns.map((c) => {
    const s = seen[c.id];
    const opened = s ? s.opened.size : 0;
    const bounced = s ? s.bounced.size : 0;
    const pct = (n: number) => c.total_sent > 0 ? `${((n / c.total_sent) * 100).toFixed(1)}%` : '-%';
    return {
      ...c,
      list_name: c.list_id ? (listNameMap[c.list_id] ?? '不明') : 'すべて',
      opened,
      bounced,
      open_rate: pct(opened),
      bounce_rate: pct(bounced),
    };
  });

  return NextResponse.json(result);
}
