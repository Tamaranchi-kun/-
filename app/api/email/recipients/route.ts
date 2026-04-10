import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function authCheck(req: Request) {
  return req.headers.get('x-admin-key') === process.env.ADMIN_API_KEY;
}

// 受信者一覧取得（list_idでフィルタ可能）
export async function GET(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const listId = searchParams.get('list_id');
  const supabase = getSupabaseAdmin();

  if (listId) {
    // リスト指定：ジャンクションテーブル経由で取得
    const { data: members } = await supabase
      .from('email_list_members')
      .select('email')
      .eq('list_id', listId);
    const emails = (members ?? []).map((m) => m.email);
    if (emails.length === 0) return NextResponse.json([]);
    const { data } = await supabase
      .from('email_lists')
      .select('email, name, company_name, created_at')
      .in('email', emails)
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: false });
    return NextResponse.json(data ?? []);
  }

  // 全件取得
  const { data, error } = await supabase
    .from('email_lists')
    .select('email, name, company_name, created_at')
    .is('unsubscribed_at', null)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// 受信者を追加（company_name・list_id対応）
export async function POST(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { recipients, list_id } = await req.json();
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients must be a non-empty array' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();

  // コンタクトをupsert（既存なら name/company_name を更新）
  const contacts = recipients.map(({ email, name, company_name }: { email: string; name?: string; company_name?: string }) => ({
    email,
    name: name || null,
    company_name: company_name || null,
  }));

  const { error } = await supabase
    .from('email_lists')
    .upsert(contacts, { onConflict: 'email' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // リスト指定があればジャンクションテーブルにも追加（upsertの戻り値に依存せず元のリストを使う）
  if (list_id) {
    const members = contacts.map((c) => ({ list_id, email: c.email }));
    await supabase.from('email_list_members').upsert(members, { onConflict: 'list_id,email', ignoreDuplicates: true });
  }

  return NextResponse.json({ inserted: contacts.length });
}

// 受信者を削除（list_id指定時はリストから外すのみ、なければ完全削除）
export async function DELETE(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { email, list_id } = await req.json();
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  const supabase = getSupabaseAdmin();

  if (list_id) {
    // リストから外すだけ（他のリストや受信者データには影響なし）
    await supabase.from('email_list_members').delete().eq('list_id', list_id).eq('email', email);
  } else {
    // 完全削除
    await supabase.from('email_list_members').delete().eq('email', email);
    await supabase.from('email_lists').delete().eq('email', email);
  }

  return NextResponse.json({ ok: true });
}
