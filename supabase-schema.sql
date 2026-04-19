-- ============================================================
-- PARADOX STORE — SUPABASE SCHEMA
-- Copy-paste this entire file into the Supabase SQL Editor
-- and click "Run" to create all required tables.
-- ============================================================

-- 1. conversations: full chat history per phone number
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations (phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at);

-- 2. processed_messages: for webhook deduplication
CREATE TABLE IF NOT EXISTS processed_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_message_id ON processed_messages (message_id);

-- 3. booking_sessions: tracks multi-step booking state
CREATE TABLE IF NOT EXISTS booking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  step INT NOT NULL DEFAULT 1,
  name TEXT,
  service TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_sessions_phone ON booking_sessions (phone);

-- 4. bookings: confirmed completed bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  notified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (phone);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for server-side operations)
-- These allow the service_role key to perform all operations

CREATE POLICY "service_role_conversations_all"
  ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_processed_messages_all"
  ON processed_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_booking_sessions_all"
  ON booking_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bookings_all"
  ON bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- CLEANUP FUNCTION (optional — run periodically to prune old data)
-- ============================================================

-- Remove processed message IDs older than 24 hours to save space
CREATE OR REPLACE FUNCTION cleanup_old_processed_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_messages WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
