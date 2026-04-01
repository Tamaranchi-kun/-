import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === 'your_supabase_url_here') {
    return null;
  }
  return createClient(url, key);
}

export async function saveScore(nickname: string, category: string, score: number, total: number) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping score save');
    return;
  }
  const { error } = await supabase.from('scores').insert({ nickname, category, score, total });
  if (error) console.error('Score save error:', error);
}

export async function getTopScores(category: string, limit = 10) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('scores')
    .select('nickname, score, total, created_at')
    .eq('category', category)
    .order('score', { ascending: false })
    .limit(limit);
  return data || [];
}
