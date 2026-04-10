import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const BATCH_SIZE = 50; // Resend推奨バッチサイズ

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-admin-key');
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subject, body_html, body_text, from_name, from_email, list_id, scheduled_at } = await req.json();
  if (!subject || !body_html || !from_name || !from_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  // 予約送信の場合はDBに保存してすぐ返す
  if (scheduled_at && new Date(scheduled_at) > new Date()) {
    const { error } = await supabase.from('email_campaigns').insert({
      subject, body_html, body_text, from_name, from_email,
      status: 'scheduled', list_id: list_id || null, scheduled_at,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scheduled: true, scheduled_at });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // キャンペーンレコードを作成
  const { data: campaign, error: campaignError } = await supabase
    .from('email_campaigns')
    .insert({ subject, body_html, body_text, from_name, from_email, status: 'sending', list_id: list_id || null })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }

  // 配信停止していない受信者を取得（list_idでフィルタ可能）
  let recipientEmails: string[] | null = null;
  if (list_id) {
    const { data: members } = await supabase
      .from('email_list_members')
      .select('email')
      .eq('list_id', list_id);
    recipientEmails = (members ?? []).map((m: { email: string }) => m.email);
  }
  let recipientsQuery = supabase
    .from('email_lists')
    .select('email, name')
    .is('unsubscribed_at', null);
  if (recipientEmails) recipientsQuery = recipientsQuery.in('email', recipientEmails);
  const { data: recipients, error: listError } = await recipientsQuery;

  if (listError || !recipients) {
    await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
    return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
  }

  if (recipients.length === 0) {
    await supabase.from('email_campaigns').update({ status: 'sent', total_sent: 0, sent_at: new Date().toISOString() }).eq('id', campaign.id);
    return NextResponse.json({ campaign_id: campaign.id, total_sent: 0 });
  }

  // トラッキングピクセルを本文に埋め込む
  const buildHtml = (email: string) => {
    const trackUrl = `${baseUrl}/api/email/track?cid=${campaign.id}&email=${encodeURIComponent(email)}`;
    const pixel = `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
    return body_html + pixel;
  };

  // バッチ送信（50件ずつ）
  let totalSent = 0;
  let lastError: string | null = null;
  const eventInserts: { campaign_id: string; email: string; resend_email_id: string | null; event_type: string }[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const messages = batch.map((r) => ({
      from: `${from_name} <${from_email}>`,
      to: r.email,
      subject,
      html: buildHtml(r.email),
      ...(body_text ? { text: body_text } : {}),
    }));

    try {
      const { data: batchResult, error: sendError } = await resend.batch.send(messages);
      if (sendError) {
        lastError = JSON.stringify(sendError);
        console.error('Batch send error:', sendError);
        continue;
      }
      const results = batchResult?.data ?? [];
      for (let j = 0; j < batch.length; j++) {
        eventInserts.push({
          campaign_id: campaign.id,
          email: batch[j].email,
          resend_email_id: results[j]?.id ?? null,
          event_type: 'sent',
        });
      }
      totalSent += batch.length;
    } catch (err) {
      lastError = String(err);
      console.error('Send error:', err);
    }
  }

  // イベントを一括挿入
  if (eventInserts.length > 0) {
    await supabase.from('email_events').insert(eventInserts);
  }

  // キャンペーンを完了状態に更新
  await supabase
    .from('email_campaigns')
    .update({ status: 'sent', total_sent: totalSent, sent_at: new Date().toISOString() })
    .eq('id', campaign.id);

  return NextResponse.json({ campaign_id: campaign.id, total_sent: totalSent, ...(lastError ? { error_detail: lastError } : {}) });
}
