-- 2026-07-26: AI auto-reply per-conversation.
-- BẬT → worker tự gọi AI draft + gửi sau 30s không có reply từ nick.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_auto_reply_last_at TIMESTAMPTZ;

-- Index cho worker quét: lọc conv bật auto-reply + sort lastMessageAt desc
CREATE INDEX IF NOT EXISTS conversations_ai_auto_reply_idx
  ON conversations (ai_auto_reply_enabled, last_message_at DESC)
  WHERE ai_auto_reply_enabled = TRUE;