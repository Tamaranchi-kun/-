-- ============================================================================
-- SUPABASE SCHEMA PROVISIONING (single source of truth)
-- ----------------------------------------------------------------------------
-- 目的:
--   本番DBは「手動でSQLを叩いて構築」されてきたため、バージョン管理から
--   再現できない状態だった。このファイルは全スキーマを冪等(idempotent)に
--   記述し、リポジトリだけでDBを再構築できるようにする。
--
-- 安全性:
--   - 一部のオブジェクト(テーブル/カラム/インデックス/Storageバケット)は
--     すでに本番に存在する。全文を IF NOT EXISTS / ON CONFLICT /
--     DO $$ ... $$ ガードで書いているため、本番に対して再実行しても安全。
--   - データは一切変更・削除しない(破壊的操作なし)。
--
-- 実行方法:
--   Supabase Dashboard > SQL Editor にこのファイル全文を貼り付けて実行。
--   既存の以下3ファイルの内容を統合・追補したもの:
--     - supabase_email_schema.sql
--     - supabase_email_lists_migration.sql
--     - supabase_email_v2_migration.sql
--   ※ PII ロックダウン(RLS有効化)は supabase_rls_emergency.sql を別途適用すること。
-- ============================================================================


-- ============================================================================
-- 1. メール配信システム: ベーステーブル
--    (supabase_email_schema.sql 相当 / 既存環境では NO-OP)
-- ============================================================================

-- 受信者リスト(顧客PII)
CREATE TABLE IF NOT EXISTS email_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- キャンペーン(送信単位)
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  from_name TEXT NOT NULL DEFAULT 'Your Name',
  from_email TEXT NOT NULL DEFAULT 'noreply@yourdomain.com',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | sending | sent | failed
  total_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- 送信・イベントログ(開封・バウンスなど)
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  resend_email_id TEXT,
  event_type TEXT NOT NULL, -- sent | delivered | opened | clicked | bounced | complained
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type     ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_lists_email     ON email_lists(email);


-- ============================================================================
-- 2. リストグループ + ジャンクションテーブル
--    (supabase_email_lists_migration.sql / supabase_email_v2_migration.sql 相当)
-- ============================================================================

-- リストグループ(1メールを複数グループに所属させるための親)
CREATE TABLE IF NOT EXISTS email_list_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- email_lists に list_id / company_name を追補
ALTER TABLE email_lists
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES email_list_groups(id) ON DELETE SET NULL;
ALTER TABLE email_lists
  ADD COLUMN IF NOT EXISTS company_name TEXT;

CREATE INDEX IF NOT EXISTS idx_email_lists_list_id ON email_lists(list_id);

-- ジャンクション: 1メールが複数グループに所属できる
CREATE TABLE IF NOT EXISTS email_list_members (
  list_id    UUID NOT NULL REFERENCES email_list_groups(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_list_members_email ON email_list_members(email);


-- ============================================================================
-- 3. (A) email_campaigns: 予約送信(scheduled_at) + list_id
--    ※ これらは既に本番に存在。冪等ALTERで「ドキュメント兼保証」として記述。
-- ============================================================================

-- 予約送信日時。NULL=即時送信、未来日時=cronが拾って送信(status='scheduled')。
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- キャンペーンの配信対象グループ(NULL=全受信者)。
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES email_list_groups(id) ON DELETE SET NULL;

-- cron(app/api/email/cron)が status='scheduled' AND scheduled_at <= now() を
-- 走査するためのインデックス。
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status_scheduled
  ON email_campaigns(status, scheduled_at);


-- ============================================================================
-- 4. (B) 同意管理カラム(特定電子メール法 / オプトイン記録の法令順守用)
--    email_lists に同意ステータス・取得経路・取得日時を保持する。
-- ============================================================================

ALTER TABLE email_lists
  ADD COLUMN IF NOT EXISTS consent_status TEXT;   -- 例: opt_in | opt_out | unknown
ALTER TABLE email_lists
  ADD COLUMN IF NOT EXISTS consent_source TEXT;   -- 同意取得の経路(フォーム名/イベント等)
ALTER TABLE email_lists
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ; -- 同意取得日時


-- ============================================================================
-- 5. (C) ジャンクションの孤児行防止 FK
--    email_list_members.email -> email_lists.email (ON DELETE CASCADE)
--    前提: email_lists.email が UNIQUE であること
--      (supabase_email_schema.sql で email TEXT NOT NULL UNIQUE で確認済み)。
--    既に同等の制約があればスキップする(冪等)。
-- ============================================================================

DO $$
BEGIN
  -- email_lists.email に UNIQUE 制約が存在するか確認(FKの前提条件)
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t        ON t.oid = c.conrelid
    JOIN pg_namespace n    ON n.oid = t.relnamespace
    JOIN pg_attribute a    ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'email_lists'
      AND c.contype IN ('u', 'p')   -- UNIQUE or PRIMARY KEY
      AND a.attname = 'email'
      AND array_length(c.conkey, 1) = 1  -- email 単独カラムの一意制約
  ) THEN
    -- FK がまだ無ければ追加する
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_email_list_members_email'
        AND conrelid = 'public.email_list_members'::regclass
    ) THEN
      ALTER TABLE public.email_list_members
        ADD CONSTRAINT fk_email_list_members_email
        FOREIGN KEY (email)
        REFERENCES public.email_lists(email)
        ON DELETE CASCADE;
    END IF;
  ELSE
    -- 前提(email の UNIQUE)が満たされない場合は FK を張れない。
    RAISE NOTICE 'SKIP fk_email_list_members_email: public.email_lists.email に単独UNIQUE/PK制約が無いため FK を追加できません。先に UNIQUE 制約を付与してください。';
  END IF;
END
$$;


-- ============================================================================
-- 6. (D) 格付けチェック クイズ: scores テーブル
--    lib/supabase.ts:
--      saveScore -> insert({ nickname, category, score, total })
--      getTopScores -> select('nickname, score, total, created_at')
--    から推定したスキーマ。
--    anon(公開キー)からの INSERT / SELECT のみを許可し、UPDATE/DELETE は不可。
-- ============================================================================

CREATE TABLE IF NOT EXISTS scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname   TEXT NOT NULL,
  category   TEXT NOT NULL,
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_category_score
  ON scores(category, score DESC);

-- RLS 有効化(明示的に許可したアクセスのみ通す)
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- anon の INSERT: 不正値ガード付き(0<=score<=total, ニックネーム最大50文字)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scores'
      AND policyname = 'scores_anon_insert'
  ) THEN
    CREATE POLICY scores_anon_insert
      ON public.scores
      FOR INSERT
      TO anon
      WITH CHECK (
        score >= 0
        AND score <= total
        AND total > 0
        AND char_length(nickname) > 0
        AND char_length(nickname) <= 50
      );
  END IF;
END
$$;

-- anon の SELECT: ランキング表示用(全件読み取り可)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scores'
      AND policyname = 'scores_anon_select'
  ) THEN
    CREATE POLICY scores_anon_select
      ON public.scores
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END
$$;

-- anon に必要な権限を付与(RLSポリシーと併せて初めて有効)。
-- UPDATE / DELETE は付与しない(=anonは更新・削除不可)。
GRANT SELECT, INSERT ON public.scores TO anon;


-- ============================================================================
-- 7. (E) Storage バケット: 'email-images' (メール本文の画像挿入用)
--    app/api/email/upload-image/route.ts が public URL を発行して使う。
--    ※ 本番では既に存在し public=true。この文で内容を記述・強制する。
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-images',
  'email-images',
  true,
  5242880,  -- 5 MiB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================================
-- 8. 確認クエリ(任意・実行後の点検用)
-- ----------------------------------------------------------------------------
--   -- scores の RLS とポリシー
--   SELECT relname, relrowsecurity FROM pg_class
--     WHERE relname = 'scores' AND relnamespace = 'public'::regnamespace;
--   SELECT policyname, cmd, roles FROM pg_policies
--     WHERE schemaname = 'public' AND tablename = 'scores';
--
--   -- ジャンクション FK
--   SELECT conname FROM pg_constraint
--     WHERE conname = 'fk_email_list_members_email';
--
--   -- Storage バケット
--   SELECT id, public, file_size_limit, allowed_mime_types
--     FROM storage.buckets WHERE id = 'email-images';
-- ============================================================================
