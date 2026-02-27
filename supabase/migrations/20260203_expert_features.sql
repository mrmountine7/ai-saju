-- 전문가 모드 기능을 위한 테이블 생성

-- 1. 저장된 원문 (즐겨찾기)
CREATE TABLE IF NOT EXISTS expert_saved_classics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL,
  book_title TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hanja TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expert_saved_classics_user ON expert_saved_classics(user_id);
CREATE INDEX idx_expert_saved_classics_chunk ON expert_saved_classics(chunk_id);
CREATE UNIQUE INDEX idx_expert_saved_classics_unique ON expert_saved_classics(user_id, chunk_id);

-- 2. AI Q&A 대화 기록
CREATE TABLE IF NOT EXISTS expert_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN DEFAULT FALSE,
  client_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expert_ai_conversations_user ON expert_ai_conversations(user_id);
CREATE INDEX idx_expert_ai_conversations_favorite ON expert_ai_conversations(user_id, is_favorite);

-- 3. 고객 그룹 테이블
CREATE TABLE IF NOT EXISTS expert_client_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'bg-purple-500',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expert_client_groups_user ON expert_client_groups(user_id);

-- 4. 고객 관리 테이블
CREATE TABLE IF NOT EXISTS expert_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')) NOT NULL,
  phone TEXT,
  email TEXT,
  memo TEXT,
  group_ids TEXT[] DEFAULT '{}',
  analysis_count INTEGER DEFAULT 0,
  last_analysis_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expert_clients_user ON expert_clients(user_id);
CREATE INDEX idx_expert_clients_name ON expert_clients(user_id, name);

-- RLS 정책 설정
ALTER TABLE expert_saved_classics ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_client_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_clients ENABLE ROW LEVEL SECURITY;

-- 저장된 원문 RLS
CREATE POLICY "Users can read own saved classics" ON expert_saved_classics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved classics" ON expert_saved_classics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved classics" ON expert_saved_classics
  FOR DELETE USING (auth.uid() = user_id);

-- AI 대화 RLS
CREATE POLICY "Users can read own conversations" ON expert_ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON expert_ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON expert_ai_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON expert_ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- 고객 그룹 RLS
CREATE POLICY "Users can read own groups" ON expert_client_groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own groups" ON expert_client_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own groups" ON expert_client_groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own groups" ON expert_client_groups
  FOR DELETE USING (auth.uid() = user_id);

-- 고객 관리 RLS
CREATE POLICY "Users can read own clients" ON expert_clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" ON expert_clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON expert_clients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON expert_clients
  FOR DELETE USING (auth.uid() = user_id);
