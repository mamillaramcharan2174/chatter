-- ==============================================================================
-- X CHATTER - Supabase Initial Database Schema & Storage Setup
-- Paste this script directly into Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ONLINE', 'AWAY', 'OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE friendship_status AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE streak_state AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'FROZEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'VOICE_NOTE', 'STICKER', 'GIF', 'STREAK_SNAP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE story_privacy AS ENUM ('EVERYONE', 'FRIENDS_ONLY', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username CITEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT UNIQUE,
  password_hash TEXT,
  bio TEXT DEFAULT 'Cyber vibes only. ⚡',
  avatar_url TEXT,
  status user_status DEFAULT 'OFFLINE',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  
  -- Security & 2FA
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  
  -- Signal Protocol E2EE
  identity_key TEXT,
  registration_id INT,
  signed_pre_key TEXT,
  signed_pre_key_sig TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. REFRESH TOKENS (Session Management)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_revoked BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 5. SIGNAL PROTOCOL PRE-KEYS
CREATE TABLE IF NOT EXISTS pre_keys (
  id SERIAL PRIMARY KEY,
  key_id INT NOT NULL,
  public_key TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, key_id)
);

-- 6. FRIENDSHIPS
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- 7. STREAKS (Daily Photo Sharing Engine)
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  state streak_state DEFAULT 'ACTIVE',
  user1_last_snap_at TIMESTAMPTZ,
  user2_last_snap_at TIMESTAMPTZ,
  cycle_expires_at TIMESTAMPTZ NOT NULL,
  last_incremented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);
CREATE INDEX IF NOT EXISTS idx_streaks_expiry ON streaks(cycle_expires_at, state);

-- 8. MESSAGE ENVELOPES (End-to-End Encrypted)
-- Note: Messages persist securely for multi-device history; no auto-delete.
CREATE TABLE IF NOT EXISTS message_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_id INT,
  message_type message_type DEFAULT 'TEXT',
  media_url TEXT,
  media_mime_type TEXT,
  is_delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON message_envelopes(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_undelivered ON message_envelopes(recipient_id, is_delivered);

-- 9. STORIES (24-Hour Ephemeral)
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  caption TEXT,
  filter_name TEXT,
  privacy story_privacy DEFAULT 'FRIENDS_ONLY',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stories_user_expiry ON stories(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_expiry ON stories(expires_at);

-- 10. STORY VIEWS (Viewer Analytics)
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- 11. SUPABASE STORAGE BUCKETS SETUP
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('streak-snaps', 'streak-snaps', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('stories-24h', 'stories-24h', false)
ON CONFLICT (id) DO NOTHING;
