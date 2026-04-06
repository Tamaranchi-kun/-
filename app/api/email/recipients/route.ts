import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function authCheck(req: Request) {
  return req.headers.get('x-admin-key') === process.env.ADMIN_API_KEY;
}

// 受信者一覧取得
export async function GET(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_lists')
    .select('email, name, created_at')
    .is('unsubscribed_at', null)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// 受信者を追加（一括インポート）
export async function POST(req: Request) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { recipients } = await req.json();
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients must be a non-empty array' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_lists')
    .upsert(recipients, { onConflict: 'email', ignoreDuplicates: true })
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data?.length ?? 0 });
}
