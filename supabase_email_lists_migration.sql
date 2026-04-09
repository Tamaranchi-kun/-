-- リストグループテーブルを追加
CREATE TABLE IF NOT EXISTS email_list_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- email_listsにlist_idカラムを追加
ALTER TABLE email_lists
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES email_list_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_lists_list_id ON email_lists(list_id);
