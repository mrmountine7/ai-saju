# AI 사주 서비스 인프라 설계서
## 1만 사용자 기준 Production 환경

---

## 1. 서비스 개요

### 1.1 서비스 구성요소
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AI 사주 서비스 아키텍처                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐   │
│  │   사용자     │────▶│   CDN       │────▶│   Frontend (React)         │   │
│  │  (10,000)   │     │  CloudFlare │     │   Vercel / Cloudflare Pages │   │
│  └─────────────┘     └─────────────┘     └─────────────────────────────┘   │
│         │                                              │                    │
│         │                                              ▼                    │
│         │            ┌─────────────────────────────────────────────────┐   │
│         │            │              API Gateway                         │   │
│         │            │         (Kong / AWS API Gateway)                │   │
│         │            │    - Rate Limiting, Auth, Caching               │   │
│         │            └─────────────────────────────────────────────────┘   │
│         │                              │                                    │
│         │                              ▼                                    │
│         │            ┌─────────────────────────────────────────────────┐   │
│         └───────────▶│           Backend API (FastAPI)                  │   │
│                      │         Kubernetes (3 Pods, Auto-scaling)        │   │
│                      │    - 사주 계산, 벡터 검색, LLM 호출               │   │
│                      └─────────────────────────────────────────────────┘   │
│                                        │                                    │
│              ┌─────────────────────────┼─────────────────────────┐         │
│              ▼                         ▼                         ▼         │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐    │
│  │   Supabase      │    │      Neo4j          │    │   DeepSeek      │    │
│  │   (PostgreSQL   │    │    AuraDB Pro       │    │     API         │    │
│  │    + pgvector)  │    │   (Graph DB)        │    │   (LLM)         │    │
│  │                 │    │                     │    │                 │    │
│  │ - 프로필 저장   │    │ - 오행 관계 그래프  │    │ - 종합 해석     │    │
│  │ - 벡터 검색     │    │ - 천간/지지 관계    │    │ - 쉬운 설명     │    │
│  │ - 청크 저장     │    │ - 격국/용신 규칙    │    │                 │    │
│  └─────────────────┘    └─────────────────────┘    └─────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        External APIs                                 │   │
│  │  OpenAI (Embedding) │ Redis (Cache) │ Sentry (Monitoring)           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 사용자 트래픽 예측 (1만 사용자)

| 지표 | 예상 값 | 비고 |
|------|---------|------|
| MAU (월간 활성 사용자) | 10,000명 | 목표 |
| DAU (일간 활성 사용자) | 2,000~3,000명 | MAU의 20~30% |
| 피크 시간대 동시접속 | 500~800명 | 저녁 8~10시 |
| 일일 API 호출 | 15,000~20,000회 | 사용자당 5~7회 |
| 월간 LLM 토큰 | 50M~100M 토큰 | 분석당 1,000~2,000 토큰 |

---

## 2. 리소스 요구사항

### 2.1 컴퓨팅 리소스

#### Backend API Server (FastAPI)
| 구성 | 스펙 | 수량 | 월 비용 (예상) |
|------|------|------|----------------|
| **Production** | 2 vCPU, 4GB RAM | 3개 (K8s Pod) | $150~200 |
| **Staging** | 1 vCPU, 2GB RAM | 1개 | $30~50 |
| **Auto-scaling** | 최대 8 Pods | 피크 시 | 추가 $100~150 |

**권장 클라우드**: AWS EKS / GCP GKE / Railway / Render

#### Frontend Hosting
| 서비스 | 용도 | 월 비용 |
|--------|------|---------|
| Vercel Pro | React 앱 호스팅 | $20 |
| Cloudflare Pages | 대안 (무료 플랜 가능) | $0~20 |

### 2.2 데이터베이스 리소스

#### Supabase (PostgreSQL + pgvector)
| 플랜 | 스펙 | 용도 | 월 비용 |
|------|------|------|---------|
| **Pro** | 8GB RAM, 100GB Storage | 벡터DB + 프로필 | $25 |
| **Team** | 16GB RAM, 200GB Storage | 확장 시 | $599 |

**현재 데이터 규모**:
- 고전문헌 청크: 3,238개
- 벡터 차원: 1536 (text-embedding-3-small)
- 예상 벡터 저장: ~50MB
- 프로필 저장: 1만 사용자 × 5KB = ~50MB

#### Neo4j AuraDB (Graph DB)
| 플랜 | 스펙 | 용도 | 월 비용 |
|------|------|------|---------|
| **AuraDB Free** | 200K nodes | 개발/테스트 | $0 |
| **AuraDB Professional** | 1M nodes, 3GB RAM | Production | $65 |

**그래프 데이터 규모**:
- 천간 노드: 10개
- 지지 노드: 12개  
- 오행 노드: 5개
- 관계 엣지: ~500개
- 격국/용신 규칙: ~200개

#### Redis (캐싱)
| 서비스 | 스펙 | 용도 | 월 비용 |
|--------|------|------|---------|
| **Upstash Redis** | 10K commands/day free | 캐싱 | $0~10 |
| **Redis Cloud** | 30MB | 확장 시 | $5~15 |

**캐싱 전략**:
- 사주 계산 결과: 24시간 캐싱 (key: birth_datetime)
- 벡터 검색 결과: 1시간 캐싱 (key: query_hash)
- LLM 응답: 12시간 캐싱 (key: saju_hash)

### 2.3 AI/LLM 리소스

#### DeepSeek API (LLM 분석)
| 항목 | 단가 | 월간 예상 사용량 | 월 비용 |
|------|------|------------------|---------|
| Input tokens | $0.14/1M | 30M tokens | $4.2 |
| Output tokens | $0.28/1M | 20M tokens | $5.6 |
| **합계** | - | 50M tokens | **~$10** |

**토큰 계산 근거**:
- 분석당 입력: ~1,500 토큰 (프롬프트 + 컨텍스트)
- 분석당 출력: ~800 토큰 (종합해석 + 쉬운설명)
- 일일 분석: 15,000회
- 월간: 15,000 × 30 = 450,000회
- 월간 토큰: 450K × 2,300 = ~1B 토큰 (캐싱 적용 시 50M)

#### OpenAI API (Embedding)
| 모델 | 단가 | 월간 예상 사용량 | 월 비용 |
|------|------|------------------|---------|
| text-embedding-3-small | $0.02/1M tokens | 5M tokens | **~$0.1** |

**참고**: Embedding은 주로 벡터DB 구축 시 사용, 실시간 검색은 pgvector에서 처리

---

## 3. API 키 보안 설계

### 3.1 시크릿 관리 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Secret Management Architecture               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │  AWS Secrets    │◀──────── API 서버에서 런타임 조회          │
│  │    Manager      │         (환경변수 주입 X)                  │
│  │                 │                                           │
│  │  또는           │                                           │
│  │                 │                                           │
│  │  HashiCorp      │                                           │
│  │    Vault        │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Stored Secrets                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  DEEPSEEK_API_KEY      = sk-xxxx...                     │   │
│  │  OPENAI_API_KEY        = sk-proj-xxxx...                │   │
│  │  SUPABASE_SERVICE_KEY  = eyJxxxx...                     │   │
│  │  NEO4J_PASSWORD        = xxxx...                        │   │
│  │  REDIS_PASSWORD        = xxxx...                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 환경별 설정 분리

```yaml
# config/settings.py (Python Pydantic)

from pydantic_settings import BaseSettings
from functools import lru_cache

class DeepSeekSettings(BaseSettings):
    api_key: str
    base_url: str = "https://api.deepseek.com/v1"
    model: str = "deepseek-chat"
    max_tokens: int = 1000
    temperature: float = 0.4
    
    class Config:
        env_prefix = "DEEPSEEK_"

class OpenAISettings(BaseSettings):
    api_key: str
    embedding_model: str = "text-embedding-3-small"
    
    class Config:
        env_prefix = "OPENAI_"

class SupabaseSettings(BaseSettings):
    url: str
    anon_key: str  # Frontend용 (RLS 적용)
    service_key: str  # Backend용 (관리자 권한)
    
    class Config:
        env_prefix = "SUPABASE_"

class Neo4jSettings(BaseSettings):
    uri: str
    user: str = "neo4j"
    password: str
    
    class Config:
        env_prefix = "NEO4J_"

class Settings(BaseSettings):
    environment: str = "development"  # development | staging | production
    debug: bool = False
    
    deepseek: DeepSeekSettings = DeepSeekSettings()
    openai: OpenAISettings = OpenAISettings()
    supabase: SupabaseSettings = SupabaseSettings()
    neo4j: Neo4jSettings = Neo4jSettings()
    
    # Rate limiting
    rate_limit_per_minute: int = 60
    rate_limit_per_day: int = 1000

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### 3.3 Frontend API 키 보안

```typescript
// src/lib/supabase.ts
// Frontend에서는 anon_key만 사용 (RLS로 보호)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 서비스 키는 절대 Frontend에 노출 금지!
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

```bash
# .env.production (Frontend)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...  # RLS 적용된 공개키만
VITE_API_BASE_URL=https://api.your-domain.com

# 절대 포함하지 않음:
# - SUPABASE_SERVICE_KEY
# - DEEPSEEK_API_KEY
# - OPENAI_API_KEY
```

### 3.4 API 키 순환 정책

| 키 종류 | 순환 주기 | 자동화 |
|---------|-----------|--------|
| DeepSeek API Key | 90일 | AWS Secrets Manager 자동 순환 |
| OpenAI API Key | 90일 | 수동 (사용량 모니터링) |
| Supabase Service Key | 180일 | 수동 |
| Neo4j Password | 180일 | 수동 |

---

## 4. 서비스 구성 상세

### 4.1 Frontend 구성

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   React 19 + Vite                    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ LandingPage │ │ ResultPage  │ │ StoragePage │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │   AddPage   │ │CompatPage  │ │ClassicsInfo │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   State Management                   │   │
│  │  ProfileContext (Zustand 권장으로 마이그레이션)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│              ┌────────────┼────────────┐                   │
│              ▼            ▼            ▼                   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │
│  │ Supabase SDK  │ │ saju-api-     │ │ Local Storage │    │
│  │ (프로필 CRUD) │ │ client.ts     │ │ (캐싱)        │    │
│  └───────────────┘ └───────────────┘ └───────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**배포 구성 (Vercel)**:
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "regions": ["icn1"],  // 서울 리전
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=60, stale-while-revalidate" }
      ]
    }
  ]
}
```

### 4.2 Backend 구성

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FastAPI Application                     │   │
│  │                                                      │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │              API Endpoints                     │  │   │
│  │  │  POST /api/saju/analyze    - 사주 분석        │  │   │
│  │  │  GET  /api/saju/history    - 분석 이력        │  │   │
│  │  │  POST /api/compatibility   - 궁합 분석        │  │   │
│  │  │  GET  /health              - 헬스체크         │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                        │                             │   │
│  │  ┌─────────────────────┼─────────────────────────┐  │   │
│  │  │                 Services                       │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │   │
│  │  │  │ SajuCalc │ │ Search   │ │ LLMService   │   │  │   │
│  │  │  │ ulator   │ │ Service  │ │ (DeepSeek)   │   │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘   │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                        │                             │   │
│  │  ┌─────────────────────┼─────────────────────────┐  │   │
│  │  │              Data Access Layer                 │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │   │
│  │  │  │ Supabase │ │  Neo4j   │ │   Redis      │   │  │   │
│  │  │  │  Client  │ │  Driver  │ │   Client     │   │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘   │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Kubernetes 배포 구성**:
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: saju-api
  labels:
    app: saju-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: saju-api
  template:
    metadata:
      labels:
        app: saju-api
    spec:
      containers:
      - name: saju-api
        image: your-registry/saju-api:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: ENVIRONMENT
          value: "production"
        envFrom:
        - secretRef:
            name: saju-api-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: saju-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: saju-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 4.3 데이터베이스 구성

#### Supabase 스키마
```sql
-- profiles 테이블 (사용자 프로필)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  birth_year INT NOT NULL,
  birth_month INT NOT NULL,
  birth_day INT NOT NULL,
  birth_hour VARCHAR(10),
  calendar_type VARCHAR(20) DEFAULT 'solar',
  is_primary BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles" ON profiles
  FOR DELETE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_is_primary ON profiles(user_id, is_primary);

-- 고전문헌 청크 테이블 (벡터 검색)
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title VARCHAR(100) NOT NULL,
  title VARCHAR(500),
  content TEXT NOT NULL,
  embedding vector(1536),  -- text-embedding-3-small
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 인덱스 (IVFFlat - 빠른 검색)
CREATE INDEX idx_chunks_embedding ON chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 분석 이력 테이블
CREATE TABLE analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) DEFAULT 'saju',
  result JSONB NOT NULL,
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_profile ON analysis_history(profile_id);
CREATE INDEX idx_analysis_created ON analysis_history(created_at DESC);
```

#### Neo4j 그래프 스키마
```cypher
// 천간 노드
CREATE (:Tiangan {
  name: '갑',
  hanja: '甲',
  wuxing: '목',
  yin_yang: '양',
  description: '큰 나무, 시작, 리더십'
})

// 지지 노드  
CREATE (:Dizhi {
  name: '자',
  hanja: '子',
  wuxing: '수',
  hidden_stems: ['계'],
  month: 11,
  hour_range: '23:00-01:00'
})

// 오행 노드
CREATE (:Wuxing {
  name: '목',
  hanja: '木',
  color: 'green',
  season: '봄',
  direction: '동'
})

// 관계 정의
// 상생 관계
MATCH (a:Wuxing {name: '목'}), (b:Wuxing {name: '화'})
CREATE (a)-[:SHENG {type: '상생', description: '목생화'}]->(b)

// 상극 관계
MATCH (a:Wuxing {name: '목'}), (b:Wuxing {name: '토'})
CREATE (a)-[:KE {type: '상극', description: '목극토'}]->(b)

// 합 관계 (천간합)
MATCH (a:Tiangan {name: '갑'}), (b:Tiangan {name: '기'})
CREATE (a)-[:HE {type: '천간합', result: '토', description: '갑기합토'}]->(b)

// 충 관계 (지지충)
MATCH (a:Dizhi {name: '자'}), (b:Dizhi {name: '오'})
CREATE (a)-[:CHONG {type: '지지충', description: '자오충'}]->(b)

// 인덱스
CREATE INDEX FOR (t:Tiangan) ON (t.name);
CREATE INDEX FOR (d:Dizhi) ON (d.name);
CREATE INDEX FOR (w:Wuxing) ON (w.name);
```

---

## 5. LLM 구성 상세

### 5.1 DeepSeek API 통합

```python
# services/llm_service.py

import httpx
import asyncio
from typing import Optional, Tuple
from tenacity import retry, stop_after_attempt, wait_exponential
from config.settings import settings

class DeepSeekLLMService:
    """DeepSeek LLM 서비스 (비용 효율적인 분석용)"""
    
    def __init__(self):
        self.base_url = settings.deepseek.base_url
        self.api_key = settings.deepseek.api_key
        self.model = settings.deepseek.model
        self.client = httpx.AsyncClient(timeout=60.0)
        
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.4,
    ) -> str:
        """LLM 응답 생성"""
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    
    async def generate_parallel(
        self,
        prompts: list[str],
        max_tokens: int = 1000,
    ) -> list[str]:
        """병렬 LLM 호출"""
        tasks = [
            self.generate(prompt, max_tokens)
            for prompt in prompts
        ]
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    async def analyze_saju(
        self,
        saju_info: dict,
        search_context: str,
    ) -> Tuple[str, str]:
        """사주 분석 (종합해석 + 쉬운설명)"""
        
        synthesis_prompt = self._build_synthesis_prompt(saju_info, search_context)
        easy_prompt = self._build_easy_prompt(saju_info)
        
        results = await self.generate_parallel([synthesis_prompt, easy_prompt])
        
        synthesis = results[0] if not isinstance(results[0], Exception) else ""
        easy_explanation = results[1] if not isinstance(results[1], Exception) else ""
        
        return synthesis, easy_explanation
    
    def _build_synthesis_prompt(self, saju_info: dict, context: str) -> str:
        return f"""당신은 명리학 전문가입니다. 
아래 사주 정보와 고전 문헌을 바탕으로 종합 해석하세요.

## 사주 정보
{saju_info}

## 고전 문헌 참조
{context}

## 작성 요청
1. 일간 특성 (2줄)
2. 격국 분석 (2줄)  
3. 용신 판단 (2줄)
4. 종합 조언 (2줄)

한국어로 작성하고, 총 8~10줄로 작성하세요."""

    def _build_easy_prompt(self, saju_info: dict) -> str:
        return f"""사주를 쉽게 설명해주세요.

## 사주 정보
{saju_info}

## 요청사항
- 전문 용어를 쉬운 말로 풀어서
- 비유를 사용
- 친근한 어투 (~이에요)
- 5~7줄로 작성"""


# 싱글톤 인스턴스
_llm_service: Optional[DeepSeekLLMService] = None

def get_llm_service() -> DeepSeekLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = DeepSeekLLMService()
    return _llm_service
```

### 5.2 LLM 비용 최적화 전략

```python
# services/cache_service.py

import hashlib
import json
from typing import Optional
from redis import asyncio as aioredis
from config.settings import settings

class LLMCacheService:
    """LLM 응답 캐싱으로 비용 절감"""
    
    def __init__(self):
        self.redis = aioredis.from_url(settings.redis.url)
        self.ttl = 43200  # 12시간
    
    def _make_key(self, saju_info: dict) -> str:
        """사주 정보 기반 캐시 키 생성"""
        # 동일한 사주는 동일한 분석 결과
        key_data = {
            "year_gan": saju_info["pillars"]["year"]["gan"],
            "year_zhi": saju_info["pillars"]["year"]["zhi"],
            "month_gan": saju_info["pillars"]["month"]["gan"],
            "month_zhi": saju_info["pillars"]["month"]["zhi"],
            "day_gan": saju_info["pillars"]["day"]["gan"],
            "day_zhi": saju_info["pillars"]["day"]["zhi"],
            "hour_gan": saju_info["pillars"]["hour"]["gan"],
            "hour_zhi": saju_info["pillars"]["hour"]["zhi"],
        }
        hash_str = hashlib.md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()
        return f"llm:saju:{hash_str}"
    
    async def get(self, saju_info: dict) -> Optional[dict]:
        """캐시된 LLM 응답 조회"""
        key = self._make_key(saju_info)
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None
    
    async def set(self, saju_info: dict, response: dict) -> None:
        """LLM 응답 캐싱"""
        key = self._make_key(saju_info)
        await self.redis.setex(key, self.ttl, json.dumps(response))
    
    async def get_stats(self) -> dict:
        """캐시 통계"""
        info = await self.redis.info("stats")
        return {
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": info.get("keyspace_hits", 0) / 
                       max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1)
        }
```

### 5.3 Rate Limiting & 사용량 모니터링

```python
# middleware/rate_limiter.py

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import time
from collections import defaultdict
import asyncio

class RateLimiter:
    """API Rate Limiting"""
    
    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_day: int = 1000,
    ):
        self.rpm = requests_per_minute
        self.rpd = requests_per_day
        self.minute_counts = defaultdict(list)  # user_id -> [timestamps]
        self.day_counts = defaultdict(int)       # user_id -> count
        self.day_reset = time.time()
    
    async def check_limit(self, user_id: str) -> bool:
        """Rate limit 체크"""
        now = time.time()
        
        # 일일 리셋
        if now - self.day_reset > 86400:
            self.day_counts.clear()
            self.day_reset = now
        
        # 분당 체크
        minute_ago = now - 60
        self.minute_counts[user_id] = [
            t for t in self.minute_counts[user_id] if t > minute_ago
        ]
        
        if len(self.minute_counts[user_id]) >= self.rpm:
            return False
        
        # 일일 체크
        if self.day_counts[user_id] >= self.rpd:
            return False
        
        # 카운트 증가
        self.minute_counts[user_id].append(now)
        self.day_counts[user_id] += 1
        
        return True


# FastAPI 미들웨어
async def rate_limit_middleware(request: Request, call_next):
    # 인증된 사용자 ID 또는 IP 기반
    user_id = request.headers.get("X-User-ID") or request.client.host
    
    limiter = request.app.state.rate_limiter
    if not await limiter.check_limit(user_id):
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded. Please try again later."}
        )
    
    return await call_next(request)
```

---

## 6. 모니터링 & 로깅

### 6.1 모니터링 스택

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Sentry    │    │ Prometheus  │    │   Grafana   │    │
│  │  (Errors)   │    │  (Metrics)  │    │ (Dashboard) │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Alerting Rules                      │   │
│  │  - Error rate > 1%                                  │   │
│  │  - Response time > 5s                               │   │
│  │  - LLM API failures                                 │   │
│  │  - Database connection errors                       │   │
│  │  - Memory usage > 80%                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 핵심 메트릭

```python
# metrics/prometheus_metrics.py

from prometheus_client import Counter, Histogram, Gauge

# API 메트릭
api_requests_total = Counter(
    'saju_api_requests_total',
    'Total API requests',
    ['endpoint', 'method', 'status']
)

api_request_duration = Histogram(
    'saju_api_request_duration_seconds',
    'API request duration',
    ['endpoint'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

# LLM 메트릭
llm_requests_total = Counter(
    'saju_llm_requests_total',
    'Total LLM API calls',
    ['model', 'status']
)

llm_tokens_total = Counter(
    'saju_llm_tokens_total',
    'Total LLM tokens used',
    ['model', 'type']  # type: input/output
)

llm_cost_total = Counter(
    'saju_llm_cost_dollars',
    'Total LLM cost in dollars',
    ['model']
)

llm_cache_hits = Counter(
    'saju_llm_cache_hits_total',
    'LLM cache hits'
)

llm_cache_misses = Counter(
    'saju_llm_cache_misses_total',
    'LLM cache misses'
)

# 벡터 검색 메트릭
vector_search_duration = Histogram(
    'saju_vector_search_duration_seconds',
    'Vector search duration',
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.0]
)

# 활성 사용자
active_users = Gauge(
    'saju_active_users',
    'Current active users'
)
```

---

## 7. 월간 비용 요약

### 7.1 예상 월간 비용 (1만 사용자)

| 항목 | 서비스 | 플랜 | 월 비용 |
|------|--------|------|---------|
| **Frontend** | Vercel | Pro | $20 |
| **Backend** | Railway / Render | Pro | $150~200 |
| **Vector DB** | Supabase | Pro | $25 |
| **Graph DB** | Neo4j AuraDB | Professional | $65 |
| **Cache** | Upstash Redis | Pay-as-you-go | $10 |
| **LLM** | DeepSeek API | Pay-as-you-go | $10~20 |
| **Embedding** | OpenAI API | Pay-as-you-go | $1 |
| **Monitoring** | Sentry | Team | $26 |
| **CDN** | Cloudflare | Free | $0 |
| **Domain** | - | 연간 | ~$2/월 |
| **기타** | 예비비 | - | $50 |
| | | **합계** | **$360~400/월** |

### 7.2 스케일업 시 비용 예측

| 사용자 규모 | 월 비용 | 비고 |
|------------|---------|------|
| 1,000명 | $150~200 | 최소 구성 |
| 10,000명 | $350~400 | 현재 목표 |
| 50,000명 | $800~1,000 | Supabase Team 업그레이드 |
| 100,000명 | $1,500~2,000 | K8s 확장, 전용 DB |

---

## 8. 체크리스트

### 8.1 Production 배포 전 체크리스트

- [ ] 모든 API 키 Secrets Manager로 이전
- [ ] CORS 설정 Production 도메인만 허용
- [ ] Rate Limiting 설정 완료
- [ ] RLS 정책 테스트 완료
- [ ] SSL/TLS 인증서 설정
- [ ] 헬스체크 엔드포인트 설정
- [ ] 로깅 및 모니터링 설정
- [ ] 백업 정책 설정
- [ ] 장애 대응 플레이북 작성
- [ ] 부하 테스트 완료 (Artillery / k6)

### 8.2 보안 체크리스트

- [ ] API 키 환경변수로만 관리 (코드에 하드코딩 X)
- [ ] Frontend에 민감한 키 노출 없음
- [ ] SQL Injection 방지 (Parameterized Query)
- [ ] XSS 방지 (입력값 Sanitization)
- [ ] HTTPS 강제
- [ ] API Rate Limiting
- [ ] 로그에 민감정보 마스킹

---

## 9. 참고 자료

- [Supabase 문서](https://supabase.com/docs)
- [Neo4j AuraDB 문서](https://neo4j.com/docs/aura/)
- [DeepSeek API 문서](https://platform.deepseek.com/docs)
- [FastAPI 문서](https://fastapi.tiangolo.com/)
- [Kubernetes 문서](https://kubernetes.io/docs/)
