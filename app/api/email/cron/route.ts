import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  requireAbsoluteBaseUrl,
  buildTrackingUrl,
  buildComplianceFooter,
  listUnsubscribeHeaders,
} from '@/lib/email-compliance';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_SIZE = 50;
const PAGE = 1000;
const IN_CHUNK = 200;

type Recipient = { email: string; name: string | null };

async function fetchAllMemberEmails(supabase: SupabaseClient, listId: string): Promise<string[]> {
  const emails: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('email_list_members').select('email').eq('list_id', listId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    emails.push(...data.map((m: { email: string }) => m.email));
    if (data.length < PAGE) break;
  }
  return emails;
}

async function fetchAllActiveRecipients(supabase: SupabaseClient): Promise<Recipient[]> {
  const out: Recipient[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('email_lists').select('email, name').is('unsubscribed_at', null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as Recipient[]));
    if (data.length < PAGE) break;
  }
  return out;
}

async function fetchActiveRecipientsByEmails(supabase: SupabaseClient, emails: string[]): Promise<Recipient[]> {
  const out: Recipient[] = [];
  for (let i = 0; i < emails.length; i += IN_CHUNK) {
    const chunk = emails.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('email_lists').select('email, name').is('unsubscribed_at', null).in('email', chunk);
    if (error) throw new Error(error.message);
    if (data) out.push(...(data as Recipient[]));
  }
  return out;
}

export async function GET(req: Request) {
  // Vercel Cron認証（CRON_SECRET未設定なら素通りさせず503で停止）
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let baseUrl: string;
  try {
    baseUrl = requireAbsoluteBaseUrl();
  } catch {
    return NextResponse.json({ error: 'NEXT_PUBLIC_BASE_URL not configured' }, { status: 500 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);

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
    // status='scheduled' → 'sending' に更新できた場合のみロック獲得（二重送信防止）
    const { data: locked, error: lockError } = await supabase
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id)
      .eq('status', 'scheduled')
      .select('id');
    if (lockError || !locked || locked.length === 0) continue;

    let recipients: Recipient[];
    try {
      if (campaign.list_id) {
        const memberEmails = await fetchAllMemberEmails(supabase, campaign.list_id);
        recipients = memberEmails.length ? await fetchActiveRecipientsByEmails(supabase, memberEmails) : [];
      } else {
        recipients = await fetchAllActiveRecipients(supabase);
      }
    } catch (err) {
      console.error('cron fetch recipients failed:', err);
      await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
      continue;
    }

    if (recipients.length === 0) {
      await supabase.from('email_campaigns').update({ status: 'sent', total_sent: 0, sent_at: new Date().toISOString() }).eq('id', campaign.id);
      processed++;
      continue;
    }

    const buildHtml = (email: string) => {
      const trackUrl = buildTrackingUrl(baseUrl, campaign.id, email);
      const footer = buildComplianceFooter(baseUrl, email).html;
      return campaign.body_html + footer + `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
    };
    const buildText = (email: string) =>
      campaign.body_text ? campaign.body_text + buildComplianceFooter(baseUrl, email).text : undefined;

    let totalSent = 0;
    let lastError: string | null = null;
    const eventInserts: { campaign_id: string; email: string; resend_email_id: string | null; event_type: string }[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const messages = batch.map((r) => {
        const text = buildText(r.email);
        return {
          from: `${campaign.from_name} <${campaign.from_email}>`,
          to: r.email,
          subject: campaign.subject,
          html: buildHtml(r.email),
          headers: listUnsubscribeHeaders(baseUrl, r.email),
          ...(text ? { text } : {}),
        };
      });
      try {
        const { data: batchResult, error: sendError } = await resend.batch.send(messages, {
          idempotencyKey: `campaign-${campaign.id}-batch-${i}`,
        });
        if (sendError) {
          lastError = JSON.stringify(sendError);
          console.error('cron batch send error:', sendError);
          continue;
        }
        const results = batchResult?.data ?? [];
        for (let j = 0; j < batch.length; j++) {
          eventInserts.push({ campaign_id: campaign.id, email: batch[j].email, resend_email_id: results[j]?.id ?? null, event_type: 'sent' });
        }
        totalSent += batch.length;
      } catch (err) {
        lastError = String(err);
        console.error('cron send error:', err);
      }
    }

    if (eventInserts.length > 0) await supabase.from('email_events').insert(eventInserts);
    if (lastError) console.error(`cron campaign ${campaign.id} partial failure:`, lastError);

    const finalStatus = totalSent === 0 ? 'failed' : totalSent < recipients.length ? 'partial' : 'sent';
    await supabase.from('email_campaigns').update({ status: finalStatus, total_sent: totalSent, sent_at: new Date().toISOString() }).eq('id', campaign.id);
    processed++;
  }

  return NextResponse.json({ processed });
}
