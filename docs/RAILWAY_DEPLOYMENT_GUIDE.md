# 🚀 Railway 백엔드 배포 가이드

> **목표**: FastAPI 백엔드를 Railway에 배포하고 Upstash Redis 캐싱 연결
> **예상 소요**: 15~20분
> **작성일**: 2026-02-03

---

## 📋 사전 준비 완료 항목

```
✅ 백엔드 코드 수정 (로컬 경로 의존성 제거)
✅ Railway 배포 파일 생성 (Procfile, railway.toml)
✅ requirements.txt 업데이트
```

---

## 🎯 1단계: Upstash Redis 생성 (5분)

### 1.1 Upstash 계정 생성

```
1. https://upstash.com 접속
2. "Get Started Free" 클릭
3. GitHub 또는 이메일로 가입
4. 이메일 인증 완료
```

### 1.2 Redis 데이터베이스 생성

```
1. 대시보드에서 "Create Database" 클릭
2. 설정:
   ┌─────────────────────────────────────────────────────┐
   │ Name: chuneulguiin-cache                            │
   │ Type: Regional                                      │
   │ Region: ap-northeast-1 (Tokyo) ⭐                   │
   │ TLS: Enabled ✅                                     │
   └─────────────────────────────────────────────────────┘
3. "Create" 클릭
```

### 1.3 연결 정보 복사

```
생성 후 "Details" 탭에서:

┌─────────────────────────────────────────────────────────────────┐
│ UPSTASH_REDIS_REST_URL                                          │
│ https://xxx.upstash.io                                          │
│                                                                 │
│ UPSTASH_REDIS_REST_TOKEN                                        │
│ AYxxxxxxxxxxxx                                                  │
│                                                                 │
│ ⭐ Redis URL (이것을 사용)                                       │
│ rediss://default:xxxxx@xxx.upstash.io:6379                      │
└─────────────────────────────────────────────────────────────────┘

"Redis URL" 값을 복사해두세요!
```

---

## 🎯 2단계: Railway 프로젝트 생성 (5분)

### 2.1 Railway 가입

```
1. https://railway.app 접속
2. "Start a New Project" 클릭
3. GitHub로 로그인 (권장)
4. GitHub 연동 승인
```

### 2.2 프로젝트 생성

```
1. 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. 저장소 선택: ai_saju (또는 해당 레포)
4. 브랜치: main

⚠️ 만약 GitHub 연동 안 할 경우:
   "Empty Project" 선택 후 수동 배포
```

### 2.3 서비스 설정

```
프로젝트 생성 후:

1. 서비스 클릭 (생성된 앱)
2. "Settings" 탭
3. "Root Directory" 설정:
   
   ┌─────────────────────────────────────────────────────┐
   │ Root Directory: api                                 │
   └─────────────────────────────────────────────────────┘

4. "Save" 클릭
```

---

## 🎯 3단계: 환경변수 설정 (3분)

### 3.1 Railway 환경변수 추가

```
1. 서비스 클릭
2. "Variables" 탭
3. "New Variable" 클릭하여 아래 변수들 추가:
```

**필수 환경변수:**

```bash
# DeepSeek LLM
DEEPSEEK_API_KEY=sk-2371f6ea4ad84abeb276c174ad22f83f
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Supabase
SUPABASE_URL=https://lszgmmdvpldazzstlewf.supabase.co
SUPABASE_KEY=sb_publishable_fdHDfEdNiJI9phaY4GDH1w_gbyz1ixR

# Upstash Redis (1단계에서 복사한 URL)
REDIS_URL=rediss://default:xxxxx@xxx.upstash.io:6379
CACHE_TTL=3600

# 토스페이먼츠
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R

# 서버 설정
PORT=8000
RATE_LIMIT=100/minute
```

### 3.2 환경변수 입력 화면

```
┌─────────────────────────────────────────────────────────────────┐
│ Variables                                            [Raw Edit] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ DEEPSEEK_API_KEY     │ sk-2371f6ea4ad84abeb276c174ad22f83f     │
│ DEEPSEEK_BASE_URL    │ https://api.deepseek.com                │
│ SUPABASE_URL         │ https://lszgmmdvpldazzstlewf.supabase.co│
│ SUPABASE_KEY         │ sb_publishable_fdHDfEdNiJI9phaY...      │
│ REDIS_URL            │ rediss://default:xxx@xxx.upstash.io:6379│
│ CACHE_TTL            │ 3600                                     │
│ TOSS_SECRET_KEY      │ test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R    │
│ PORT                 │ 8000                                     │
│ RATE_LIMIT           │ 100/minute                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 4단계: 배포 (3분)

### 4.1 자동 배포

```
환경변수 설정 완료 후:
1. "Deployments" 탭 클릭
2. 자동으로 배포가 시작됨
3. 빌드 로그 확인
4. 배포 완료까지 대기 (2~3분)
```

### 4.2 배포 성공 확인

```
배포 성공 시:
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Deployment successful                                        │
│                                                                 │
│ Your app is live at:                                            │
│ https://chuneulguiin-api-production.up.railway.app             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 도메인 확인

```
1. "Settings" 탭
2. "Networking" 섹션
3. "Generate Domain" 클릭 (없으면)
4. 생성된 도메인 복사:
   
   예: https://xxx-production.up.railway.app
```

---

## 🎯 5단계: 테스트 (2분)

### 5.1 Health Check

```bash
# 브라우저에서 접속하거나 curl로 테스트
curl https://xxx-production.up.railway.app/health

# 예상 응답:
{
  "status": "healthy",
  "timestamp": "2026-02-03T12:00:00",
  "redis": "connected"
}
```

### 5.2 API 문서 확인

```
브라우저에서:
https://xxx-production.up.railway.app/docs

→ FastAPI Swagger UI가 보이면 성공!
```

---

## 🎯 6단계: 프론트엔드 연결 (5분)

### 6.1 API URL 변경

**Vercel 환경변수 업데이트:**

```
1. https://vercel.com 로그인
2. 프로젝트 선택 (ai-saju)
3. Settings → Environment Variables
4. VITE_API_BASE_URL 수정:

   ┌─────────────────────────────────────────────────────┐
   │ VITE_API_BASE_URL = https://xxx.up.railway.app     │
   └─────────────────────────────────────────────────────┘

5. "Save" 클릭
```

### 6.2 프론트엔드 재배포

```
1. Vercel 대시보드
2. "Deployments" 탭
3. 최신 배포 옆 "..." 클릭
4. "Redeploy" 선택
5. 배포 완료 대기
```

### 6.3 로컬 코드도 업데이트 (선택)

```typescript
// src/lib/saju-api-client.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://xxx.up.railway.app';
```

---

## ✅ 완료 체크리스트

```
□ Upstash Redis 생성 완료
□ Railway 프로젝트 생성 완료
□ 환경변수 설정 완료
□ 배포 성공
□ Health Check 통과
□ Vercel API URL 업데이트
□ 모바일에서 사주풀이 테스트
```

---

## 🔧 트러블슈팅

### 배포 실패 시

```
1. "Deployments" → 실패한 배포 클릭
2. "Build Logs" 확인
3. 일반적인 오류:
   - requirements.txt 패키지 버전 문제
   - 환경변수 누락
   - Root Directory 설정 오류
```

### Redis 연결 실패 시

```
1. REDIS_URL이 "rediss://" (TLS)로 시작하는지 확인
2. Upstash 대시보드에서 URL 재확인
3. Railway 환경변수에 올바르게 입력되었는지 확인
```

### API 응답 없음

```
1. Railway 대시보드 → Logs 확인
2. 서버 시작 오류 확인
3. PORT 환경변수 확인 (Railway가 자동 할당)
```

---

## 📊 비용 예상

```
┌─────────────────────────────────────────────────────────────────┐
│                    월간 예상 비용                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Railway (Backend)                                              │
│  • Starter Plan: $5/월 + 사용량                                │
│  • 예상: $5~20/월                                               │
│                                                                 │
│  Upstash Redis (Cache)                                          │
│  • Free Tier: 10,000 commands/day                              │
│  • 예상: $0~10/월                                               │
│                                                                 │
│  합계: $5~30/월                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 다음 단계

1. **도메인 연결** (오후 예정)
   - 도메인 구매 후 Railway에 커스텀 도메인 연결
   - Vercel에도 동일 도메인 연결

2. **모니터링 설정**
   - Railway 로그 모니터링
   - Upstash Redis 사용량 모니터링

---

**문서 작성**: AI Saju Development Team
**최종 수정**: 2026-02-03
