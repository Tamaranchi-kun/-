import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// 認証は middleware.ts の Basic 認証で行う

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IN_CHUNK = 200;

type Contact = { email: string; name: string | null; company_name: string | null };

// 受信者一覧取得（list_idでフィルタ可能）
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listId = searchParams.get('list_id');
  const supabase = getSupabaseAdmin();

  const DISPLAY_LIMIT = 100;

  if (listId) {
    const { count: total } = await supabase
      .from('email_list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId);

    const { data: members, error: mErr } = await supabase
      .from('email_list_members')
      .select('email')
      .eq('list_id', listId)
      .limit(DISPLAY_LIMIT);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    const emails = (members ?? []).map((m) => m.email);
    if (emails.length === 0) return NextResponse.json({ recipients: [], total: total ?? 0 });

    const { data, error } = await supabase
      .from('email_lists')
      .select('email, name, company_name, created_at')
      .in('email', emails)
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recipients: data ?? [], total: total ?? 0 });
  }

  const { count: total } = await supabase
    .from('email_lists')
    .select('*', { count: 'exact', head: true })
    .is('unsubscribed_at', null);

  const { data, error } = await supabase
    .from('email_lists')
    .select('email, name, company_name, created_at')
    .is('unsubscribed_at', null)
    .order('created_at', { ascending: false })
    .limit(DISPLAY_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recipients: data ?? [], total: total ?? 0 });
}

// 受信者を追加（company_name・list_id対応）
export async function POST(req: Request) {
  const { recipients, list_id } = await req.json();
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients must be a non-empty array' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();

  // 正規化（trim + 小文字化）と形式検証。重複・不正アドレスを除去し件数を報告する。
  const seen = new Set<string>();
  let skipped = 0;
  const incoming: Contact[] = [];
  for (const r of recipients as Array<{ email?: string; name?: string; company_name?: string }>) {
    const email = (r.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) {
      skipped++;
      continue;
    }
    seen.add(email);
    incoming.push({
      email,
      name: r.name?.trim() || null,
      company_name: r.company_name?.trim() || null,
    });
  }
  if (incoming.length === 0) {
    return NextResponse.json({ error: '有効なメールアドレスがありませんでした', skipped }, { status: 400 });
  }

  // 既存の name/company_name を空値で上書きしないようマージ（再インポートでのデータ損失防止）
  const emails = incoming.map((c) => c.email);
  const existingMap = new Map<string, { name: string | null; company_name: string | null }>();
  for (let i = 0; i < emails.length; i += IN_CHUNK) {
    const chunk = emails.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('email_lists')
      .select('email, name, company_name')
      .in('email', chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data ?? []) existingMap.set(row.email, { name: row.name, company_name: row.company_name });
  }
  const contacts: Contact[] = incoming.map((c) => {
    const prev = existingMap.get(c.email);
    return {
      email: c.email,
      name: c.name ?? prev?.name ?? null,
      company_name: c.company_name ?? prev?.company_name ?? null,
    };
  });

  const { error } = await supabase
    .from('email_lists')
    .upsert(contacts, { onConflict: 'email' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // リスト指定があればジャンクションテーブルにも追加（500件ずつ並列insert）
  if (list_id) {
    const members = contacts.map((c) => ({ list_id, email: c.email }));
    const BATCH = 500;
    const chunks: typeof members[] = [];
    for (let i = 0; i < members.length; i += BATCH) {
      chunks.push(members.slice(i, i + BATCH));
    }
    const results = await Promise.all(
      chunks.map((chunk) =>
        supabase.from('email_list_members').upsert(chunk, { onConflict: 'list_id,email', ignoreDuplicates: true }),
      ),
    );
    const memberError = results.find((r) => r.error)?.error;
    if (memberError) {
      console.error('email_list_members insert error:', memberError);
      return NextResponse.json({ error: `リスト紐付け失敗: ${memberError.message}` }, { status: 500 });
    }
    const { count } = await supabase
      .from('email_list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', list_id);
    return NextResponse.json({ inserted: contacts.length, skipped, members_in_list: count });
  }

  return NextResponse.json({ inserted: contacts.length, skipped });
}

// 受信者を削除（list_id指定時はリストから外すのみ、なければ完全削除）
export async function DELETE(req: Request) {
  const { email, list_id } = await req.json();
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  const normalized = String(email).trim().toLowerCase();
  const supabase = getSupabaseAdmin();

  if (list_id) {
    const { error } = await supabase
      .from('email_list_members')
      .delete()
      .eq('list_id', list_id)
      .ilike('email', normalized);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // 完全削除（メンバーシップ→連絡先の順）。いずれかが失敗したら500を返す。
    const { error: mErr } = await supabase.from('email_list_members').delete().ilike('email', normalized);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    const { error: cErr } = await supabase.from('email_lists').delete().ilike('email', normalized);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
