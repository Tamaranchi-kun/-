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
// 大量送信がVercel既定タイムアウトで途中停止しないよう上限を引き上げる。
export const maxDuration = 300;

const BATCH_SIZE = 50; // Resend推奨バッチサイズ
const PAGE = 1000; // PostgRESTの暗黙行数上限を超えてページングするための単位
const IN_CHUNK = 200; // .in() のURL長制限を避けるためのチャンク単位

type Recipient = { email: string; name: string | null };

// リストメンバーのメールを全件ページングして取得（暗黙の1000件上限による無音切り捨てを防ぐ）
async function fetchAllMemberEmails(supabase: SupabaseClient, listId: string): Promise<string[]> {
  const emails: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('email_list_members')
      .select('email')
      .eq('list_id', listId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    emails.push(...data.map((m: { email: string }) => m.email));
    if (data.length < PAGE) break;
  }
  return emails;
}

// 配信停止していない受信者を全件ページングして取得
async function fetchAllActiveRecipients(supabase: SupabaseClient): Promise<Recipient[]> {
  const out: Recipient[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('email_lists')
      .select('email, name')
      .is('unsubscribed_at', null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as Recipient[]));
    if (data.length < PAGE) break;
  }
  return out;
}

// 指定メール群のうち配信停止していない受信者を、.in() をチャンク分割して取得
async function fetchActiveRecipientsByEmails(supabase: SupabaseClient, emails: string[]): Promise<Recipient[]> {
  const out: Recipient[] = [];
  for (let i = 0; i < emails.length; i += IN_CHUNK) {
    const chunk = emails.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('email_lists')
      .select('email, name')
      .is('unsubscribed_at', null)
      .in('email', chunk);
    if (error) throw new Error(error.message);
    if (data) out.push(...(data as Recipient[]));
  }
  return out;
}

export async function POST(req: Request) {
  // 認証は middleware.ts の Basic 認証で行う
  const { subject, body_html, body_text, from_name, from_email, list_id, scheduled_at } = await req.json();
  if (!subject || !body_html || !from_name || !from_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 予約送信の場合はDBに保存してすぐ返す
  if (scheduled_at && new Date(scheduled_at) > new Date()) {
    const { error } = await supabase.from('email_campaigns').insert({
      subject, body_html, body_text, from_name, from_email,
      status: 'scheduled', list_id: list_id || null, scheduled_at,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scheduled: true, scheduled_at });
  }

  // 送信にはトラッキング・配信停止リンクのため絶対httpsのベースURLが必須
  let baseUrl: string;
  try {
    baseUrl = requireAbsoluteBaseUrl();
  } catch {
    return NextResponse.json({ error: 'NEXT_PUBLIC_BASE_URL（https）が未設定のため送信できません' }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY が未設定です' }, { status: 500 });
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

  // 配信停止していない受信者を取得（list_id指定時はジャンクション経由・大量対応）
  let recipients: Recipient[];
  try {
    if (list_id) {
      const memberEmails = await fetchAllMemberEmails(supabase, list_id);
      recipients = memberEmails.length ? await fetchActiveRecipientsByEmails(supabase, memberEmails) : [];
    } else {
      recipients = await fetchAllActiveRecipients(supabase);
    }
  } catch (err) {
    await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
    console.error('fetch recipients failed:', err);
    return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
  }

  if (recipients.length === 0) {
    await supabase.from('email_campaigns').update({ status: 'sent', total_sent: 0, sent_at: new Date().toISOString() }).eq('id', campaign.id);
    return NextResponse.json({ campaign_id: campaign.id, total_sent: 0 });
  }

  // 本文に「署名付きトラッキングピクセル」＋「法定フッター（送信者表示＋配信停止）」を付与
  const buildHtml = (email: string) => {
    const trackUrl = buildTrackingUrl(baseUrl, campaign.id, email);
    const footer = buildComplianceFooter(baseUrl, email).html;
    const pixel = `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
    return body_html + footer + pixel;
  };
  const buildText = (email: string) =>
    body_text ? body_text + buildComplianceFooter(baseUrl, email).text : undefined;

  // バッチ送信（50件ずつ）
  let totalSent = 0;
  let lastError: string | null = null;
  const eventInserts: { campaign_id: string; email: string; resend_email_id: string | null; event_type: string }[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const messages = batch.map((r) => {
      const text = buildText(r.email);
      return {
        from: `${from_name} <${from_email}>`,
        to: r.email,
        subject,
        html: buildHtml(r.email),
        headers: listUnsubscribeHeaders(baseUrl, r.email),
        ...(text ? { text } : {}),
      };
    });

    try {
      // バッチごとに冪等キーを付与（リトライ時の二重送信を防止）
      const { data: batchResult, error: sendError } = await resend.batch.send(messages, {
        idempotencyKey: `campaign-${campaign.id}-batch-${i}`,
      });
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

  // 実際の送信結果に応じてキャンペーン状態を更新（全失敗を'sent'と誤記録しない）
  const finalStatus = totalSent === 0 ? 'failed' : totalSent < recipients.length ? 'partial' : 'sent';
  await supabase
    .from('email_campaigns')
    .update({ status: finalStatus, total_sent: totalSent, sent_at: new Date().toISOString() })
    .eq('id', campaign.id);

  // 外部にraw errorを露出しない。詳細はログに残し、UIには失敗有無のみ返す。
  if (lastError) console.error('send partial failure:', lastError);
  const httpStatus = totalSent === 0 ? 502 : 200;
  return NextResponse.json(
    {
      campaign_id: campaign.id,
      total_sent: totalSent,
      total_recipients: recipients.length,
      status: finalStatus,
      ...(lastError ? { error_detail: '一部またはすべての送信に失敗しました（詳細はサーバーログを参照）' } : {}),
    },
    { status: httpStatus },
  );
}
