-- ============================================================================
-- EMERGENCY RLS LOCKDOWN  (2026-06-08)
-- ----------------------------------------------------------------------------
-- 背景: 公開 anon キーだけで email_* テーブル（顧客PII 約16,976件）が
--       PostgREST 経由で誰でも read/write/delete できる状態だった。
--
-- 方針: 全 email_* テーブルで Row Level Security を有効化する。
--   - service_role は BYPASSRLS 権限を持つため、管理API(lib/supabase-admin.ts)は
--     これまで通り全アクセス可能（＝管理画面・送信・cron は影響なし）。
--   - anon / authenticated は「ポリシーが無い＝0行」になり、PII漏洩が即座に止まる。
--   - REVOKE は多層防御（RLS有効化だけでも遮断されるが、念のため権限も剥奪）。
--
-- 非破壊・可逆: データは一切変更しない。元に戻す場合は各テーブルで
--   ALTER TABLE ... DISABLE ROW LEVEL SECURITY;
-- ============================================================================

ALTER TABLE public.email_lists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_list_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_list_members  ENABLE ROW LEVEL SECURITY;

-- 多層防御: 公開ロールから直接権限を剥奪（RLSが主防御、これは保険）
REVOKE ALL ON public.email_lists        FROM anon, authenticated;
REVOKE ALL ON public.email_campaigns    FROM anon, authenticated;
REVOKE ALL ON public.email_events       FROM anon, authenticated;
REVOKE ALL ON public.email_list_groups  FROM anon, authenticated;
REVOKE ALL ON public.email_list_members FROM anon, authenticated;

-- 確認用: 有効化後、以下が全て true になること
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname LIKE 'email\_%' AND relnamespace = 'public'::regnamespace;
