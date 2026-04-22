-- ============================================================
-- AUTOCIAL DIGITALS — ADMIN DASHBOARD MIGRATION
-- Copy-paste this entire file into the Supabase SQL Editor
-- and click "Run" to create the new tables and columns.
-- ============================================================

-- 1. Add sender column to existing conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS sender TEXT DEFAULT 'user' CHECK (sender IN ('user', 'ai', 'admin'));

-- 2. Backfill existing data
UPDATE conversations SET sender = 'user' WHERE role = 'user';
UPDATE conversations SET sender = 'ai' WHERE role = 'assistant';

-- 3. Create agent_mode table
CREATE TABLE IF NOT EXISTS agent_mode (
  phone_number TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'human')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS and add policies
ALTER TABLE agent_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_agent_mode_all"
  ON agent_mode
  FOR ALL
  USING (true)
  WITH CHECK (true);
