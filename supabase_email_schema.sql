-- ============================================================
-- メール配信システム用 Supabaseテーブル
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 受信者リスト
CREATE TABLE IF NOT EXISTS email_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- キャンペーン（送信単位）
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  from_name TEXT NOT NULL DEFAULT 'Your Name',
  from_email TEXT NOT NULL DEFAULT 'noreply@yourdomain.com',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sending | sent | failed
  total_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- 送信・イベントログ（開封・バウンスなど）
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  resend_email_id TEXT,
  event_type TEXT NOT NULL, -- sent | delivered | opened | clicked | bounced | complained
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス（集計クエリの高速化）
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_lists_email ON email_lists(email);
