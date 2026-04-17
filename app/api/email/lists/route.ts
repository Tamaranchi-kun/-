import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 認証は middleware.ts の Basic 認証で行う

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_list_groups')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 各リストのメンバー数をジャンクションテーブルから取得
  const lists = await Promise.all(
    (data ?? []).map(async (list) => {
      const { count } = await supabase
        .from('email_list_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list.id);
      return { ...list, member_count: count ?? 0 };
    })
  );
  return NextResponse.json(lists);
}

export async function POST(req: Request) {
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
