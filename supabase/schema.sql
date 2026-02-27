-- ================================================
-- AI 사주 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- 1. users 테이블 (사용자 정보)
-- ================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  name TEXT,
  mode TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'expert')),
  language TEXT NOT NULL DEFAULT 'ko',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 데이터만 접근 가능
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ================================================
-- 2. profiles 테이블 (사주 명식 - 생년월일시)
-- ================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  nationality TEXT NOT NULL DEFAULT 'domestic' CHECK (nationality IN ('domestic', 'foreign')),
  birth_year INTEGER NOT NULL,
  birth_month INTEGER NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_day INTEGER NOT NULL CHECK (birth_day BETWEEN 1 AND 31),
  birth_hour TEXT NOT NULL,
  calendar_type TEXT NOT NULL DEFAULT 'solar' CHECK (calendar_type IN ('solar', 'lunar')),
  country TEXT DEFAULT '한국',
  city TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_is_favorite ON public.profiles(is_favorite);

-- RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ================================================
-- 3. saju_results 테이블 (사주풀이 결과)
-- ================================================
CREATE TABLE IF NOT EXISTS public.saju_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pillars JSONB NOT NULL, -- 사주 원국 (시주, 일주, 월주, 연주)
  interpretation JSONB, -- 풀이 해설
  daeun JSONB, -- 대운
  seun JSONB, -- 세운
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_saju_results_profile_id ON public.saju_results(profile_id);

-- RLS 활성화
ALTER TABLE public.saju_results ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own saju results" ON public.saju_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = saju_results.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own saju results" ON public.saju_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- ================================================
-- 4. compatibility_results 테이블 (궁합 결과)
-- ================================================
CREATE TABLE IF NOT EXISTS public.compatibility_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result JSONB, -- 궁합 결과
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_compatibility_profile1 ON public.compatibility_results(profile1_id);
CREATE INDEX idx_compatibility_profile2 ON public.compatibility_results(profile2_id);

-- RLS 활성화
ALTER TABLE public.compatibility_results ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own compatibility results" ON public.compatibility_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (profiles.id = compatibility_results.profile1_id OR profiles.id = compatibility_results.profile2_id)
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own compatibility results" ON public.compatibility_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile1_id
      AND profiles.user_id = auth.uid()
    )
  );

-- ================================================
-- 5. qa_history 테이블 (질문/답변 기록)
-- ================================================
CREATE TABLE IF NOT EXISTS public.qa_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  compatibility_id UUID REFERENCES public.compatibility_results(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- profile_id 또는 compatibility_id 중 하나는 반드시 있어야 함
  CONSTRAINT qa_reference_check CHECK (
    (profile_id IS NOT NULL AND compatibility_id IS NULL) OR
    (profile_id IS NULL AND compatibility_id IS NOT NULL)
  )
);

-- 인덱스
CREATE INDEX idx_qa_profile_id ON public.qa_history(profile_id);
CREATE INDEX idx_qa_compatibility_id ON public.qa_history(compatibility_id);

-- RLS 활성화
ALTER TABLE public.qa_history ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own qa history" ON public.qa_history
  FOR SELECT USING (
    (profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = qa_history.profile_id
      AND profiles.user_id = auth.uid()
    ))
    OR
    (compatibility_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.compatibility_results cr
      JOIN public.profiles p ON p.id = cr.profile1_id
      WHERE cr.id = qa_history.compatibility_id
      AND p.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert own qa history" ON public.qa_history
  FOR INSERT WITH CHECK (
    (profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
      AND profiles.user_id = auth.uid()
    ))
    OR
    (compatibility_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.compatibility_results cr
      JOIN public.profiles p ON p.id = cr.profile1_id
      WHERE cr.id = compatibility_id
      AND p.user_id = auth.uid()
    ))
  );

-- ================================================
-- 6. payments 테이블 (결제 내역)
-- ================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('saju_detail', 'compatibility_detail')),
  reference_id UUID NOT NULL, -- saju_results.id 또는 compatibility_results.id
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_reference_id ON public.payments(reference_id);

-- RLS 활성화
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================
-- 7. subscriptions 테이블 (구독 정보)
-- ================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('expert_monthly', 'expert_yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- RLS 활성화
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- ================================================
-- 8. clients 테이블 (전문가용 고객 관리)
-- ================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  phone TEXT,
  email TEXT,
  memo TEXT,
  analysis_count INTEGER NOT NULL DEFAULT 0,
  last_analysis_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_clients_expert_user_id ON public.clients(expert_user_id);
CREATE INDEX idx_clients_name ON public.clients(name);

-- RLS 활성화
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "Experts can view own clients" ON public.clients
  FOR SELECT USING (auth.uid() = expert_user_id);

CREATE POLICY "Experts can insert own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = expert_user_id);

CREATE POLICY "Experts can update own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = expert_user_id);

CREATE POLICY "Experts can delete own clients" ON public.clients
  FOR DELETE USING (auth.uid() = expert_user_id);

-- ================================================
-- saju_results 테이블 확장 (유료 분석 필드 추가)
-- ================================================
-- 기존 테이블에 컬럼 추가 (IF NOT EXISTS는 PostgreSQL 9.6+에서만 지원)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'analysis_type') THEN
    ALTER TABLE public.saju_results ADD COLUMN analysis_type TEXT DEFAULT 'free' CHECK (analysis_type IN ('free', 'premium', 'expert'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'user_id') THEN
    ALTER TABLE public.saju_results ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'daewoon_detail') THEN
    ALTER TABLE public.saju_results ADD COLUMN daewoon_detail JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'sewoon_detail') THEN
    ALTER TABLE public.saju_results ADD COLUMN sewoon_detail JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'wolwoon_detail') THEN
    ALTER TABLE public.saju_results ADD COLUMN wolwoon_detail JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'gaewoon_advice') THEN
    ALTER TABLE public.saju_results ADD COLUMN gaewoon_advice JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saju_results' AND column_name = 'result') THEN
    ALTER TABLE public.saju_results ADD COLUMN result JSONB;
  END IF;
END $$;

-- payments 테이블에 product_id 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'product_id') THEN
    ALTER TABLE public.payments ADD COLUMN product_id TEXT;
  END IF;
END $$;

-- ================================================
-- 트리거: updated_at 자동 업데이트
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 완료 메시지
-- ================================================
DO $$
BEGIN
  RAISE NOTICE 'AI 사주 데이터베이스 스키마가 성공적으로 생성되었습니다!';
END $$;
