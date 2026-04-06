import { createClient } from '@supabase/supabase-js';

// サーバーサイド専用（APIルートでのみ使用）
// SUPABASE_SERVICE_ROLE_KEY は .env.local に設定すること
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin credentials are not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
