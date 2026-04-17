import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // 認証は middleware.ts の Basic 認証で行う
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  // リストを削除（受信者のlist_idはNULLになる）
  const { error } = await supabase.from('email_list_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
