# 🚀 DeepSeek 기업용 전환 실행 가이드

> **목표**: DeepSeek 개인용 API → DeepSeek Enterprise 전환
> **예상 소요**: 1~2주
> **작성일**: 2026-02-03

---

## 📋 현재 구조 및 전환 범위

### 천을귀인 LLM 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         천을귀인 LLM 아키텍처                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  사용자 입력 (생년월일)                                                     │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────┐                                                   │
│  │ Supabase pgvector   │ ◄── 고전문헌 벡터 검색 (이미 구축 완료)           │
│  │ (벡터DB)            │     OpenAI 호출 없음!                             │
│  └─────────────────────┘                                                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────┐                                                   │
│  │ DeepSeek-V3 ⭐      │ ◄── 유일하게 실시간 호출하는 LLM                  │
│  │ (사주풀이 생성)     │     ✅ 이것만 기업용 전환하면 됨!                 │
│  └─────────────────────┘                                                   │
│         │                                                                   │
│         ▼                                                                   │
│     결과 출력                                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 전환 범위

| 서비스 | 현재 | 전환 필요 | 비고 |
|--------|------|-----------|------|
| **DeepSeek-V3** | 개인용 API | ✅ **Enterprise 전환** | 핵심 작업 |
| Supabase pgvector | 운영중 | ❌ 변경 없음 | 벡터 이미 저장됨 |
| OpenAI Embedding | 개인용 | ❌ 불필요 | 새 문헌 추가 시에만 사용 |

---

## 📋 전체 절차 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DeepSeek Enterprise 전환 로드맵                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1단계] 사전 준비 (Day 1)                                                  │
│  └── 사업자등록증, 서비스 설명서 준비                                       │
│                                                                             │
│  [2단계] DeepSeek Enterprise 신청 (Day 1)                                   │
│  └── 기업 계정 신청                                                         │
│                                                                             │
│  [3단계] 승인 대기 (Day 2~14)                                               │
│  └── 심사 진행 (보통 1~2주)                                                 │
│                                                                             │
│  [4단계] API Key 발급 및 테스트 (승인 후 Day 1)                             │
│  └── 새 Enterprise API Key 발급, 테스트                                     │
│                                                                             │
│  [5단계] 운영 환경 전환 (승인 후 Day 1~2)                                   │
│  └── 환경변수 교체, 배포                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📌 1단계: 사전 준비 (Day 1)

### 1.1 필요 서류 준비

```
필수 서류:
├── 📄 사업자등록증 (스캔본/PDF)
└── 📄 서비스 설명서 (아래 템플릿 참고)
```

### 1.2 서비스 설명서 작성

아래 내용을 워드/PDF로 작성하세요:

```markdown
# 천을귀인 (天乙貴人) - 서비스 설명서

## 1. 서비스 개요
- 서비스명: 천을귀인 1.0
- 서비스 유형: AI 사주명리 분석 웹 애플리케이션
- 타겟 사용자: 20~30대 일반인
- 서비스 URL: [도메인 입력 예정]

## 2. DeepSeek 사용 목적
- 한문 고전문헌(적천수, 자평진전, 삼명통회) 해석
- 사주팔자 분석 및 해설 문장 생성
- 사용자 맞춤형 운세 리포트 작성
- 궁합 분석 문장 생성

## 3. 예상 사용량
- 초기 MAU: 1,000~10,000명
- 일 평균 분석 요청: 1,000~5,000건
- 분석당 평균 토큰: 2,300 토큰 (input 1,500 + output 800)
- 월간 예상 토큰: 50M~100M 토큰 (캐싱 적용)

## 4. 데이터 처리
- 개인정보: 생년월일, 성별만 수집 (최소화)
- 데이터 보안: 분석 결과 캐싱 후 개인정보 분리 저장
- GDPR/개인정보보호법 준수

## 5. 기술 스택
- Frontend: React + Vite (Vercel 배포)
- Backend: FastAPI (Railway 배포 예정)
- Database: Supabase (PostgreSQL + pgvector)
- LLM: DeepSeek-V3 (사주 분석 - 유일한 LLM)

## 6. 연락처
- 회사명: [회사명]
- 담당자: [이름]
- 이메일: [이메일]
- 전화번호: [전화번호]
```

### ✅ 1단계 체크리스트

- [ ] 사업자등록증 스캔/PDF 준비
- [ ] 서비스 설명서 작성 완료

---

## 📌 2단계: DeepSeek Enterprise 신청 (Day 1)

### 2.1 DeepSeek 계정 생성 (없는 경우)

```
1. https://platform.deepseek.com 접속
2. 우측 상단 "Sign Up" 클릭
3. 이메일로 계정 생성
4. 이메일 인증 완료
```

### 2.2 Enterprise 신청

```
1. https://platform.deepseek.com 로그인
2. 좌측 메뉴 "Settings" → "Organization" 클릭
3. "Upgrade to Enterprise" 또는 "Contact Sales" 클릭
4. 아래 정보 입력:
   
   ┌─────────────────────────────────────────────────────┐
   │ Company Name     : [회사명]                         │
   │ Business Email   : [업무용 이메일]                  │
   │ Country          : South Korea                      │
   │ Expected Usage   : $100~500/month                   │
   │ Use Case         : AI fortune telling service       │
   └─────────────────────────────────────────────────────┘

5. 사업자등록증 첨부 (PDF)
6. 서비스 설명서 첨부 (선택)
7. "Submit" 클릭
```

### 2.3 신청 시 영문 설명 (참고용)

```
Subject: Enterprise Account Request - AI Saju Service

Company: [회사명]
Contact: [담당자명]
Email: [이메일]

Service Description:
We are developing an AI-powered Saju (Four Pillars of Destiny) analysis 
service called "Chuneulguiin (天乙貴人)". Our service interprets classical 
Chinese texts on destiny studies (적천수, 자평진전, 삼명통회) and provides 
personalized fortune readings to users.

Why DeepSeek:
DeepSeek-V3 demonstrates superior performance in interpreting classical 
Chinese texts and understanding Saju terminology compared to other LLMs.
We tested multiple LLMs and DeepSeek showed the highest accuracy in:
- Classical Chinese (漢文) interpretation
- Saju terminology understanding (格局, 用神, 十神)
- Consistent analysis results

Expected Usage:
- Monthly Active Users: 1,000 ~ 10,000
- Daily API Calls: 1,000 ~ 5,000
- Monthly Tokens: 50M ~ 100M (with caching)

Required Features:
- Enterprise SLA (99.5%+)
- Data privacy guarantee (no training on our data)
- Volume discount for scaling
- Higher rate limits

Attached: Business Registration Certificate
```

### 2.4 개인용 API 먼저 사용 (선택)

기업 계약 승인 전에도 DeepSeek API는 **즉시 사용 가능**합니다:

```
1. https://platform.deepseek.com 로그인
2. 좌측 메뉴 "API Keys" 클릭
3. "Create new API key" 클릭
4. API Key 복사 (sk-xxx...)
5. 결제 수단 등록 (Settings → Billing)
   - 신용카드 등록
   - 또는 크레딧 충전 ($10~100)

⚠️ 개인용 API vs 기업용 차이:
┌─────────────────────────────────────────────────────┐
│ 항목          │ 개인용        │ 기업용 Enterprise   │
├───────────────┼───────────────┼─────────────────────┤
│ 기능          │ 동일          │ 동일                │
│ 가격          │ 동일          │ 20% 할인 (볼륨)     │
│ Rate Limit    │ 분당 60~500   │ 분당 10,000+        │
│ SLA           │ 없음          │ 99.5% 보장          │
│ 데이터 보안   │ 학습 가능     │ 학습 제외 보장      │
│ 세금계산서    │ 불가          │ 발행 가능           │
└───────────────┴───────────────┴─────────────────────┘
```

### ✅ 2단계 체크리스트

- [ ] DeepSeek 계정 생성/로그인
- [ ] Enterprise 신청 제출
- [ ] (선택) 개인용 API Key 발급하여 테스트

---

## 📌 3단계: 승인 대기 (Day 2~14)

### 3.1 예상 일정

```
┌────────────────────────────────────────────────────────────────┐
│                    승인 예상 타임라인                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Day 1: 신청서 제출 ✓                                          │
│  ───────────────────                                           │
│                                                                │
│  Day 2-5: 1차 검토                                             │
│  ─────────────────                                             │
│  • 보통 3~5일 내 응답                                          │
│  • 추가 정보 요청이 올 수 있음                                 │
│                                                                │
│  Day 5-14: 최종 승인                                           │
│  ──────────────────                                            │
│  • Enterprise 계약 확정                                        │
│  • 전용 엔드포인트 또는 높은 Rate Limit 제공                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 대기 중 할 일

승인 대기 중에도 진행할 수 있는 작업:

```
1. 프롬프트 최적화 (현재 DeepSeek 개인용 API로 테스트 가능)
   - 한국어 자연스러움 개선
   - 톤앤매너 조정
   - 모드별(일반/고급/전문가) 프롬프트 튜닝

2. 캐싱 시스템 점검
   - 동일 사주 캐싱 확인
   - 캐시 적중률 모니터링 (목표 60%+)

3. 환경변수 구조 준비
   - .env 파일 구조 정리
   - Vercel/Railway 환경변수 목록 정리

4. 다른 작업 진행
   - T001: 궁합 프로세스 개선
   - T002: 인프라 전환 (Railway 배포)
   - T004: 도메인 신청
```

### ✅ 3단계 체크리스트

- [ ] DeepSeek 승인 이메일 확인
- [ ] 대기 중 다른 작업 진행

---

## 📌 4단계: API Key 발급 및 테스트 (승인 후 Day 1)

### 4.1 Enterprise API Key 발급

```
1. https://platform.deepseek.com 로그인
2. 좌측 메뉴 "API Keys" 클릭
3. "Create new API key" 클릭
4. 이름: "chuneulguiin-production"
5. API Key 복사 (sk-xxx...)
6. 안전한 곳에 저장 (1Password, Bitwarden 등)

⚠️ API Key는 한 번만 표시됩니다. 반드시 복사하세요!
```

### 4.2 Enterprise 전용 혜택 확인

승인 후 확인할 사항:

```
┌─────────────────────────────────────────────────────┐
│ Enterprise 혜택 체크리스트                          │
├─────────────────────────────────────────────────────┤
│ □ Rate Limit 증가 확인 (분당 10,000+)              │
│ □ 볼륨 할인 적용 확인 (20% 할인)                   │
│ □ 전용 엔드포인트 제공 여부 확인                   │
│ □ 세금계산서 발행 방법 확인                        │
│ □ 기술 지원 채널 확인                              │
└─────────────────────────────────────────────────────┘
```

### 4.3 로컬 테스트

```python
# test_deepseek_enterprise.py

from openai import OpenAI

# DeepSeek Enterprise 테스트
print("=== DeepSeek Enterprise 테스트 ===")

client = OpenAI(
    api_key="sk-xxx...",  # 새로 발급받은 Enterprise API Key
    base_url="https://api.deepseek.com"
)

# 테스트 1: 기본 응답 테스트
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "당신은 사주명리학 전문가입니다. 친근하고 따뜻한 어조로 설명해주세요."},
        {"role": "user", "content": "병화 일간이 사월에 태어났을 때 특징을 설명해주세요."}
    ],
    temperature=0.4,
    max_tokens=1000
)

print("응답:")
print(response.choices[0].message.content)
print(f"\n토큰 사용: {response.usage}")
print(f"- Input: {response.usage.prompt_tokens}")
print(f"- Output: {response.usage.completion_tokens}")

# 테스트 2: 한문 해석 테스트
response2 = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "당신은 사주명리학 고전 전문가입니다."},
        {"role": "user", "content": """
다음 적천수 원문을 해석하고 현대적으로 설명해주세요:

"炎上之勢，木從火勢，用神取金水。木旺火相，運行西北方最吉。"
"""}
    ],
    temperature=0.3
)

print("\n=== 한문 해석 테스트 ===")
print(response2.choices[0].message.content)
print("\n테스트 완료!")
```

### 4.4 테스트 실행

```bash
# 테스트 스크립트 실행
python test_deepseek_enterprise.py

# 예상 출력:
# === DeepSeek Enterprise 테스트 ===
# 응답:
# 병화 일간이 사월(巳月)에 태어나셨군요! 이 분은 정말 특별한 에너지를...
# 
# 토큰 사용: CompletionUsage(...)
# - Input: 45
# - Output: 320
#
# === 한문 해석 테스트 ===
# 염상격의 형세는 목이 화의 기세를 따르니...
#
# 테스트 완료!
```

### ✅ 4단계 체크리스트

- [ ] DeepSeek Enterprise API Key 발급
- [ ] 로컬 테스트 성공
- [ ] 응답 품질 확인

---

## 📌 5단계: 운영 환경 전환 (승인 후 Day 1~2)

### 5.1 환경변수 업데이트

현재 환경변수를 Enterprise Key로 교체:

```bash
# .env 또는 .env.production

# === DeepSeek Enterprise ===
DEEPSEEK_API_KEY=sk-xxx...  # 새 Enterprise API Key로 교체
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# === 기존 설정 (변경 없음) ===
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx...
# ... 나머지 동일
```

### 5.2 Vercel 환경변수 설정

```
1. https://vercel.com 로그인
2. 프로젝트 선택 (ai-saju)
3. Settings → Environment Variables
4. DEEPSEEK_API_KEY 값 업데이트:

┌─────────────────────────────────────┬─────────────────────────────┐
│ Name                                │ Value                       │
├─────────────────────────────────────┼─────────────────────────────┤
│ DEEPSEEK_API_KEY                    │ sk-xxx... (새 Enterprise)   │
└─────────────────────────────────────┴─────────────────────────────┘

5. "Save" 클릭
6. 재배포 트리거 (또는 자동 배포)
```

### 5.3 Railway 환경변수 설정 (백엔드)

```
1. https://railway.app 로그인
2. 프로젝트 선택
3. Variables 탭 클릭
4. DEEPSEEK_API_KEY 값 업데이트:

┌─────────────────────────────────────┬─────────────────────────────┐
│ Name                                │ Value                       │
├─────────────────────────────────────┼─────────────────────────────┤
│ DEEPSEEK_API_KEY                    │ sk-xxx... (새 Enterprise)   │
└─────────────────────────────────────┴─────────────────────────────┘

5. 자동 재배포 대기
```

### 5.4 배포 및 검증

```bash
# 검증 체크리스트
- [ ] 사주 분석 API 정상 응답
- [ ] 응답 시간 정상 (5초 이내)
- [ ] 에러 로그 없음
- [ ] Rate Limit 여유 확인
```

### ✅ 5단계 체크리스트

- [ ] 환경변수 업데이트 (DEEPSEEK_API_KEY)
- [ ] Vercel 환경변수 설정
- [ ] Railway 환경변수 설정 (백엔드 배포 후)
- [ ] 배포 완료
- [ ] 운영 검증 완료

---

## 📊 비용 모니터링 설정

### DeepSeek 사용량 확인

```
1. https://platform.deepseek.com 로그인
2. 좌측 "Usage" 클릭
3. 확인 항목:
   - 일별/월별 토큰 사용량
   - 비용 추이
   - Rate Limit 사용률

4. 예산 알림 설정:
   - Settings → Billing → Budget Alert
   - 월 $50, $100 등 임계값 설정
   - 알림 이메일 등록
```

### 예상 비용 (1만 MAU 기준)

```
┌─────────────────────────────────────────────────────────────────┐
│                    월간 예상 비용                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DeepSeek-V3 Enterprise                                         │
│  ─────────────────────────                                      │
│  • Input: 30M tokens × $0.11/1M = $3.3                         │
│  • Output: 20M tokens × $0.22/1M = $4.4                        │
│  • 소계: $7.7 (캐싱 미적용)                                     │
│  • 캐싱 60% 적용 시: ~$3                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  실제 예상 비용 (캐싱 + 버퍼 포함)                              │
│  ────────────────────────────────                               │
│  • 보수적 추정: $30~50/월                                       │
│  • 피크 시즌: $50~80/월                                         │
│                                                                 │
│  ⭐ GPT-4o 대비 95% 절감!                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 전체 일정 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              전체 타임라인                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 1 (오늘)                                                               │
│  ─────────────                                                              │
│  □ 사업자등록증 준비                                                        │
│  □ 서비스 설명서 작성 (10분)                                                │
│  □ DeepSeek Enterprise 신청 (5분)                                           │
│                                                                             │
│  Day 2-14 (승인 대기)                                                       │
│  ──────────────────                                                         │
│  □ 프롬프트 최적화 작업                                                     │
│  □ 캐싱 시스템 점검                                                         │
│  □ 다른 작업 진행 (T001, T002, T004)                                        │
│                                                                             │
│  승인 후 Day 1                                                              │
│  ────────────────                                                           │
│  □ Enterprise API Key 발급                                                  │
│  □ 로컬 테스트                                                              │
│                                                                             │
│  승인 후 Day 1-2                                                            │
│  ────────────────                                                           │
│  □ 환경변수 교체                                                            │
│  □ 배포 및 검증                                                             │
│  □ 비용 모니터링 설정                                                       │
│                                                                             │
│  완료! 🎉                                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ❓ FAQ

### Q1: 승인 전에 서비스 운영이 가능한가요?
> **A**: 네, 가능합니다. DeepSeek 개인용 API는 즉시 사용 가능합니다. 
> 기업 계약 승인 후 API Key만 교체하면 됩니다. 기능은 동일합니다.

### Q2: OpenAI는 더 이상 필요 없나요?
> **A**: 현재 구조에서는 필요 없습니다.
> - 고전문헌 벡터는 이미 Supabase pgvector에 저장되어 있음
> - 실시간 검색은 pgvector에서 처리
> - 새 고전문헌을 추가할 때만 OpenAI Embedding 필요 (거의 없음)

### Q3: DeepSeek이 장애나면?
> **A**: Fallback LLM 구성을 권장합니다.
> - 1차: DeepSeek-V3 (기본)
> - 2차: GPT-4o-mini (백업)
> - 코드에 자동 전환 로직 구현

### Q4: 비용이 예상보다 많이 나오면?
> **A**: 캐싱 적중률을 높이세요 (목표 60%+).
> - 동일 사주 분석은 캐시에서 응답
> - Redis/Supabase에 결과 캐싱
> - 캐시 TTL: 24시간 권장

### Q5: 세금계산서는 어떻게 받나요?
> **A**: Enterprise 계약 후 DeepSeek 측에 요청하세요.
> - 월별 또는 분기별 발행 가능
> - 영문 인보이스로 발행됨

---

## 📋 오늘 할 일 체크리스트

```
┌─────────────────────────────────────────────────────────────────┐
│                    오늘 (Day 1) 할 일                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  □ 1. 사업자등록증 준비 (PDF 스캔)                              │
│                                                                 │
│  □ 2. 서비스 설명서 작성 (10분)                                 │
│      - 회사명, 서비스명, 사용 목적                              │
│      - 예상 사용량 (1,000~10,000 MAU)                           │
│      - 연락처                                                   │
│                                                                 │
│  □ 3. DeepSeek Enterprise 신청 (5분)                            │
│      - https://platform.deepseek.com                            │
│      - Settings → Organization → Enterprise                     │
│      - 정보 입력 + 사업자등록증 첨부                            │
│                                                                 │
│  예상 소요: 15~20분                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**문서 작성**: AI Development Team  
**최종 수정**: 2026-02-03
