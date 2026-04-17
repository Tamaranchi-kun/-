-- 会社名カラムを追加
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS company_name TEXT;

-- 1つのメールを複数リストに所属させるためのジャンクションテーブル
CREATE TABLE IF NOT EXISTS email_list_members (
  list_id UUID NOT NULL REFERENCES email_list_groups(id) ON DELETE CASCADE,
  email   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_list_members_email ON email_list_members(email);
