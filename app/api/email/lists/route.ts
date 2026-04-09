import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function authCheck(req: Request) {
  return req.headers.get('x-admin-key') === process.env.ADMIN_API_KEY;
}

// リスト一覧取得（メンバー数付き）
export async function GET(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_list_groups')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 各リストのメンバー数を取得
  const lists = await Promise.all(
    (data ?? []).map(async (list) => {
      const { count } = await supabase
        .from('email_lists')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list.id)
        .is('unsubscribed_at', null);
      return { ...list, member_count: count ?? 0 };
    })
  );
  return NextResponse.json(lists);
}

// リスト作成
export async function POST(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_list_groups')
    .insert({ name })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, name: data.name });
}
