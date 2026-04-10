import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const BATCH_SIZE = 50;

export async function GET(req: Request) {
  // Vercel Cron認証
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  // 送信時刻を過ぎた予約済みキャンペーンを取得
  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString());

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const campaign of campaigns) {
    // 送信中に更新（二重送信防止）
    const { error: lockError } = await supabase
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id)
      .eq('status', 'scheduled');
    if (lockError) continue;

    // 受信者を取得
    let recipientEmails: string[] | null = null;
    if (campaign.list_id) {
      const { data: members } = await supabase
        .from('email_list_members').select('email').eq('list_id', campaign.list_id);
      recipientEmails = (members ?? []).map((m: { email: string }) => m.email);
    }
    let query = supabase.from('email_lists').select('email, name').is('unsubscribed_at', null);
    if (recipientEmails) query = query.in('email', recipientEmails);
    const { data: recipients } = await query;

    if (!recipients || recipients.length === 0) {
      await supabase.from('email_campaigns').update({ status: 'sent', total_sent: 0, sent_at: new Date().toISOString() }).eq('id', campaign.id);
      continue;
    }

    const buildHtml = (email: string) => {
      const trackUrl = `${baseUrl}/api/email/track?cid=${campaign.id}&email=${encodeURIComponent(email)}`;
      return campaign.body_html + `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
    };

    let totalSent = 0;
    const eventInserts: { campaign_id: string; email: string; resend_email_id: string | null; event_type: string }[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const messages = batch.map((r) => ({
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: r.email,
        subject: campaign.subject,
        html: buildHtml(r.email),
        ...(campaign.body_text ? { text: campaign.body_text } : {}),
      }));
      try {
        const { data: batchResult } = await resend.batch.send(messages);
        const results = batchResult?.data ?? [];
        for (let j = 0; j < batch.length; j++) {
          eventInserts.push({ campaign_id: campaign.id, email: batch[j].email, resend_email_id: results[j]?.id ?? null, event_type: 'sent' });
        }
        totalSent += batch.length;
      } catch { /* continue */ }
    }

    if (eventInserts.length > 0) await supabase.from('email_events').insert(eventInserts);
    await supabase.from('email_campaigns').update({ status: 'sent', total_sent: totalSent, sent_at: new Date().toISOString() }).eq('id', campaign.id);
    processed++;
  }

  return NextResponse.json({ processed });
}
