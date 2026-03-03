# 💑 궁합 유료서비스 완벽 설계서

> **작성 목적**: AI 자동 구현을 위한 상세 기술 명세서
> **작성일**: 2026-02-03
> **버전**: 2.0 (전문가 검토 보완판)

---

## 📋 목차

1. [전문가 검토 의견](#1-전문가-검토-의견)
2. [고전문헌 활용 전략](#2-고전문헌-활용-전략)
3. [궁합 RAG 프로세스 (확장판)](#3-궁합-rag-프로세스-확장판)
4. [백엔드 API 구현 명세](#4-백엔드-api-구현-명세)
5. [프론트엔드 구현 명세](#5-프론트엔드-구현-명세)
6. [벡터DB 검색 쿼리 명세](#6-벡터db-검색-쿼리-명세)
7. [LLM 프롬프트 설계](#7-llm-프롬프트-설계)
8. [상품 구성 및 과금 로직](#8-상품-구성-및-과금-로직)

---

## 1. 전문가 검토 의견

### 1.1 원안의 강점 ✅

1. **관계의 동역학 분석** 접근법은 정확함 - 단순 점수 산출이 아닌 상호작용 분석이 핵심
2. **일간합/일지합충 분석**은 궁합의 기본 중 기본으로 적절히 포함됨
3. **십신 관계 분석**의 비대칭성 강조는 매우 중요한 포인트
4. **RAG 기반 고전문헌 검색**은 차별화 요소로 훌륭함

### 1.2 보완이 필요한 영역 ⚠️

#### A. 누락된 핵심 분석 항목

| 항목 | 중요도 | 설명 |
|------|--------|------|
| **한난조습(寒暖燥濕)** | ★★★★★ | 두 사주의 기후/계절 조화 - 궁합의 근본 |
| **조후용신(調候用神) 상호작용** | ★★★★★ | 서로가 상대의 조후를 해결해주는가 |
| **신강신약 균형** | ★★★★☆ | 둘 다 신강이면 충돌, 하나가 신약이면 보완 |
| **지장간(支藏干) 합** | ★★★★☆ | 숨은 인연 - 겉으로 안 맞아도 속으로 통함 |
| **도화살/홍란성/천희성** | ★★★☆☆ | 연애/매력/인연의 신살 분석 |
| **역마살 교차** | ★★★☆☆ | 함께 이동/여행 운, 별거 가능성 |
| **백호대살/양인살** | ★★★☆☆ | 사고/폭력성 위험 신살 |
| **공망(空亡) 교차** | ★★★☆☆ | 공허한 인연, 헛된 관계 가능성 |

#### B. 분석 깊이 부족 항목

1. **일지 분석**: 합/충만 보지 말고 **형(刑)/파(破)/해(害)**도 분석 필요
   - 자묘형(子卯刑): 무례지형 - 예의 없는 관계
   - 인신사해형(寅申巳亥刑): 무은지형 - 은혜를 모름
   - 축술미형(丑戌未刑): 무자지형 - 자비가 없음
   - 자유파(子酉破), 묘진해(卯辰害) 등

2. **년주/월주/시주 교차 분석**: 원안은 일주만 집중
   - 년주 충: 집안 간 갈등
   - 월주 충: 부모/형제 관계 갈등
   - 시주 충: 자녀/노년 갈등

3. **납음오행(納音五行)**: 고급 궁합 분석에서 중요
   - 甲子乙丑 海中金, 丙寅丁卯 爐中火 등
   - 두 사람의 납음 상생/상극 관계

#### C. 현대적 관점 보완

| 관점 | 설명 |
|------|------|
| **연애 vs 결혼 구분** | 원안에 언급되었으나 구체적 기준 부족 |
| **동거/LAT 관계** | 현대 관계 유형에 맞는 해석 필요 |
| **재혼/다혼 상황** | 기존 배우자 정보 고려 분석 |
| **동성 커플** | 전통 명리의 남녀 이분법 재해석 |

### 1.3 수집된 고전문헌 활용도 점검

현재 `삼명통회 혼인문` 청크 8개가 수집됨:

| 청크 | 활용 가능 영역 |
|------|----------------|
| 육친론 - 음양배합과 부부 | 천간합 분석, 음양 조화 |
| 육친론 - 십신과 처자 판단 | 십신 관계 분석 |
| 육친론 - 사주 위치와 육친 | 주별 영향 분석 |
| 여명론 - 여자 사주 부부 판단 | 여명 특수 분석 |
| 궁합 핵심 구결 | 충형파해, 비겁/상관 분석 |
| 배우자궁과 재성 판단 | 일지 분석, 재성 분석 |
| 음양배합과 부부화합 | 천간합, 음양 조화 |
| 비겁과 혼인운 | 비겁 분석, 이혼수 |

**⚠️ 추가 수집이 필요한 고전문헌 영역:**

1. **적천수(滴天髓)**: 한난조습, 조후론
2. **자평진전(子平眞詮)**: 용신/격국 상호작용
3. **연해자평(淵海子平)**: 합혼가(合婚歌), 궁합 구결
4. **신봉통고(神峰通考)**: 배우자 판단, 혼인 시기
5. **궁통보감(窮通寶鑑)**: 조후용신 상세

---

## 2. 고전문헌 활용 전략

### 2.1 기존 청크 매핑

```
[궁합 분석 항목] → [검색할 청크/키워드]
─────────────────────────────────────────
천간합 분석      → "天干合", "甲己合", "음양배합", "부부화합"
일지 합충 분석   → "地支合", "六合", "三合", "沖", "刑", "배우자궁"
십신 관계       → "十神", "正財", "偏財", "正官", "七煞", "처자 판단"
한난조습        → "寒暖燥濕", "調候", "火土燥", "水金寒"
비겁/상관 위험  → "比劫", "傷官", "克夫", "克妻", "혼인운"
여명 특수 분석  → "女命", "旺子傷夫", "官星", "夫星"
```

### 2.2 추가 수집 필요 청크 (SQL Migration)

```sql
-- 추가 수집 대상: 궁합 전용 고전문헌 청크
-- 파일: supabase/migrations/20260203_add_compatibility_chunks.sql

-- 1. 연해자평 합혼가(合婚歌)
INSERT INTO public.chunks (book_id, title, content, ...) VALUES
(
  (SELECT id FROM books WHERE title LIKE '%연해자평%'),
  '연해자평 합혼가 - 남녀 배합 원리',
  '男女配合：
   木命人宜金命人，金命人宜火命人，
   火命人宜水命人，水命人宜土命人，
   土命人宜木命人...
   [해설] 납음오행 기준 배합법...',
  ...
);

-- 2. 적천수 한난조습
INSERT INTO public.chunks (book_id, title, content, ...) VALUES
(
  (SELECT id FROM books WHERE title LIKE '%적천수%'),
  '적천수 한난조습론 - 궁합 적용',
  '天道有寒暖，地道有燥濕。
   寒甚則冰，暖甚則火，燥甚則枯，濕甚則爛。
   [궁합 적용] 
   - 한(寒) 사주와 조(燥) 사주는 상호 보완
   - 한(寒) 사주끼리 만나면 음기 과다
   - 열(熱) 사주끼리 만나면 양기 과다...',
  ...
);

-- 3. 도화살/홍란성/천희성 신살 데이터
INSERT INTO public.chunks (book_id, title, content, ...) VALUES
(
  (SELECT id FROM books WHERE title LIKE '%신봉통고%'),
  '신봉통고 도화살과 혼인',
  '桃花煞者，子午卯酉是也。
   申子辰見酉，寅午戌見卯，
   巳酉丑見午，亥卯未見子。
   [궁합 적용]
   - 양인 모두 도화살이면 바람기 주의
   - 한쪽만 도화살이면 매력적 관계
   - 천희성(天喜星)과 홍란성(紅鸞星) 동시 출현 시 결혼운...',
  ...
);
```

### 2.3 벡터 검색 쿼리 최적화

```python
# 궁합 분석 시 벡터 검색 쿼리 패턴
COMPATIBILITY_SEARCH_QUERIES = {
    "천간합": [
        "{gan1}과 {gan2} 천간합 부부",
        "甲己合 乙庚合 丙辛合 丁壬合 戊癸合 궁합",
    ],
    "일지합충": [
        "{zhi1}과 {zhi2} 육합 삼합 충",
        "日支 배우자궁 합충형파해",
    ],
    "한난조습": [
        "{season1} {season2} 한난조습 궁합",
        "寒暖燥濕 調候 부부 배합",
    ],
    "십신관계": [
        "{sipsin1}과 {sipsin2} 부부 관계",
        "正財 正官 偏官 처 남편 궁합",
    ],
    "신살": [
        "도화살 홍란성 천희성 궁합 연애",
        "桃花 紅鸞 天喜 배우자 인연",
    ],
    "여명특수": [
        "여명 관성 식상 남편운",
        "旺子傷夫 旺夫傷子 여자 궁합",
    ],
}
```

---

## 3. 궁합 RAG 프로세스 (확장판)

```
[입력] 두 사람의 사주 정보 + 분석 유형 선택
         │
         ▼
┌─ Step 1: 개별 원국 분석 ──────────────────────────────────────┐
│ ✅ 각자의 일간, 격국, 용신, 신강신약 계산                      │
│ ✅ 캐시 재활용 (개인 사주풀이 결과가 있으면)                  │
│ ✅ 한난조습(寒暖燥濕) 판정 - 각 사주의 기후 특성              │
│ ⭐ NEW: 납음오행(納音五行) 계산                               │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 2: 천간(天干) 상호작용 분석 ─────────────────────────────┐
│ ✅ 일간합 분석: 갑기합(토), 을경합(금), 병신합(수),           │
│    정임합(목), 무계합(화)                                      │
│ ⭐ NEW: 연간/월간/시간 합충 교차 분석                         │
│ ⭐ NEW: 천간 상극 관계 분석 (갑경충, 을신충 등)               │
│                                                                │
│ [벡터DB 검색 #1]                                              │
│   쿼리: "{일간1} {일간2} 천간합 부부 궁합"                    │
│   쿼리: "음양배합 부부화합 天干合"                            │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 3: 지지(地支) 상호작용 분석 ─────────────────────────────┐
│ ✅ 일지 육합: 子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未              │
│ ✅ 일지 삼합: 申子辰(수), 寅午戌(화), 巳酉丑(금), 亥卯未(목) │
│ ✅ 일지 충: 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥               │
│ ⭐ NEW: 일지 형(刑) 분석                                      │
│   - 子卯刑 (무례지형), 寅申巳刑 (무은지형)                    │
│   - 丑戌未刑 (무자지형), 辰辰/午午/酉酉/亥亥 (자형)          │
│ ⭐ NEW: 일지 파(破)/해(害) 분석                               │
│   - 子酉破, 丑辰破, 寅亥破, 卯午破, 辰丑破, 巳申破           │
│   - 子未害, 丑午害, 寅巳害, 卯辰害, 申亥害, 酉戌害           │
│ ⭐ NEW: 년주/월주/시주 교차 합충형파 분석                     │
│                                                                │
│ [벡터DB 검색 #2]                                              │
│   쿼리: "{일지1} {일지2} 六合 三合 배우자궁"                  │
│   쿼리: "日支 沖刑破害 부부 갈등"                             │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 4: 지장간(支藏干) 합 분석 ⭐ NEW ────────────────────────┐
│ 지지 안에 숨은 천간들의 합을 분석                             │
│                                                                │
│ 예시: A일지=寅(甲丙戊), B일지=亥(壬甲)                        │
│       → 寅 안의 甲과 亥 안의 甲이 비견 관계                   │
│       → 寅 안의 戊와 亥 안의 壬이 무계합                      │
│       → "겉으로는 안 맞아 보여도 속으로 통하는 인연"          │
│                                                                │
│ [벡터DB 검색 #3]                                              │
│   쿼리: "지장간 합 숨은 인연 궁합"                            │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 5: 십신(十神) 상호 관계 분석 ────────────────────────────┐
│ ✅ A의 일간 → B에게 어떤 십신?                                │
│ ✅ B의 일간 → A에게 어떤 십신?                                │
│ ⭐ NEW: 비대칭 관계 심층 분석                                  │
│                                                                │
│ [십신 상호작용 해석표]                                        │
│ ┌──────────────┬──────────────┬───────────────────────────┐  │
│ │ A→B 십신    │ B→A 십신    │ 관계 해석                  │  │
│ ├──────────────┼──────────────┼───────────────────────────┤  │
│ │ 정재(正財)  │ 정관(正官)  │ 이상적 부부 - 남극여, 여복남│  │
│ │ 편재(偏財)  │ 편관(七殺)  │ 열정적이나 불안정          │  │
│ │ 식신(食神)  │ 정인(正印)  │ 보살핌 관계 - 편안함        │  │
│ │ 상관(傷官)  │ 편인(偏印)  │ 창의적이나 갈등 가능       │  │
│ │ 비견(比肩)  │ 비견(比肩)  │ 친구 같은 관계 - 경쟁 가능 │  │
│ │ 겁재(劫財)  │ 겁재(劫財)  │ 강한 끌림이나 재물 갈등     │  │
│ └──────────────┴──────────────┴───────────────────────────┘  │
│                                                                │
│ [벡터DB 검색 #4]                                              │
│   쿼리: "{십신A} {십신B} 부부 관계 상호작용"                  │
│   쿼리: "正財 正官 夫妻 배합"                                 │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 6: 한난조습(寒暖燥濕) 궁합 분석 ⭐ CRITICAL ──────────────┐
│ 궁합의 근본 - 두 사주의 기후 조화                             │
│                                                                │
│ [한난조습 판정 기준]                                          │
│ - 寒(한): 亥子丑월생 + 水金 과다                              │
│ - 暖(난): 巳午未월생 + 火土 과다                              │
│ - 燥(조): 寅卯辰월생 木旺 or 申酉戌월생 金旺 + 火가 있음     │
│ - 濕(습): 水가 많고 火가 없음                                 │
│                                                                │
│ [조합별 궁합]                                                  │
│ ┌─────────┬─────────┬──────────────────────────────┐         │
│ │ A 특성  │ B 특성  │ 궁합 해석                     │         │
│ ├─────────┼─────────┼──────────────────────────────┤         │
│ │ 寒(한)  │ 暖(난)  │ ★★★★★ 최상 - 완벽한 보완    │         │
│ │ 燥(조)  │ 濕(습)  │ ★★★★★ 최상 - 완벽한 보완    │         │
│ │ 寒(한)  │ 寒(한)  │ ★★☆☆☆ 음기 과다 - 우울, 냉랭│         │
│ │ 暖(난)  │ 暖(난)  │ ★★☆☆☆ 양기 과다 - 충돌, 다툼│         │
│ │ 燥(조)  │ 燥(조)  │ ★★☆☆☆ 건조 과다 - 메마름    │         │
│ │ 濕(습)  │ 濕(습)  │ ★★☆☆☆ 습기 과다 - 침체      │         │
│ └─────────┴─────────┴──────────────────────────────┘         │
│                                                                │
│ [벡터DB 검색 #5]                                              │
│   쿼리: "寒暖燥濕 調候 부부 배합 궁합"                        │
│   쿼리: "{A기후특성} {B기후특성} 조후 상보"                   │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 7: 오행 균형 및 용신 보완 분석 ──────────────────────────┐
│ ✅ 두 사주의 오행 분포 합산 → 균형도 계산                     │
│ ✅ A 부족 오행을 B가 보완하는가?                              │
│ ✅ 과다 오행 충돌 여부                                        │
│ ⭐ NEW: 조후용신(調候用神) 상호 보완 분석                     │
│                                                                │
│ 예시: A는 여름생 丙火 → 용신 水                               │
│       B의 사주에 水가 있으면 A에게 도움                       │
│       → "B가 A에게 시원함(청량함)을 줌"                       │
│                                                                │
│ [벡터DB 검색 #6]                                              │
│   쿼리: "용신 상생 부부 보완 궁합"                            │
│   쿼리: "五行 균형 조화 夫妻"                                 │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 8: 신살(神煞) 분석 ⭐ NEW ────────────────────────────────┐
│ 연애/결혼 관련 신살 분석                                       │
│                                                                │
│ [긍정적 신살]                                                  │
│ - 천희성(天喜星): 기쁨의 인연, 결혼 암시                      │
│ - 홍란성(紅鸞星): 연애운, 결혼운 상승                         │
│ - 천덕귀인(天德貴人): 배우자가 도와줌                         │
│ - 월덕귀인(月德貴人): 가정의 복                               │
│                                                                │
│ [주의 신살]                                                    │
│ - 도화살(桃花殺): 이성 인연 과다, 바람기                      │
│ - 역마살(驛馬殺): 별거, 원거리 연애                           │
│ - 양인살(羊刃殺): 배우자 극함                                 │
│ - 백호대살(白虎大殺): 사고/폭력 위험                          │
│ - 고신살/과숙살: 고독, 이별                                   │
│                                                                │
│ [교차 분석]                                                    │
│ - 둘 다 도화살: 바람기 주의                                   │
│ - 한쪽 역마살: 별거 가능성                                    │
│ - 서로의 공망(空亡)이 상대 일지와 겹침: 헛된 인연             │
│                                                                │
│ [벡터DB 검색 #7]                                              │
│   쿼리: "도화살 홍란성 천희성 연애 궁합"                      │
│   쿼리: "桃花 紅鸞 天喜 배우자 인연"                          │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 9: 대운/세운 교차 분석 ──────────────────────────────────┐
│ ✅ 현재 대운 동조 여부 (같은 방향으로 흐르는가)               │
│ ✅ 향후 5년 세운에서 합/충 발생 시점                          │
│ ⭐ NEW: 결혼 위기 시기 예측                                   │
│   - 배우자궁(일지)에 충/형이 오는 해                          │
│   - 비겁운에서의 재물/배우자 갈등                             │
│   - 상관운에서의 관성(남편) 극함                              │
│ ⭐ NEW: 함께 좋은 시기 / 함께 어려운 시기 분석                │
│                                                                │
│ [벡터DB 검색 #8]                                              │
│   쿼리: "대운 세운 부부 동조 위기"                            │
│   쿼리: "배우자궁 沖刑 이혼 이별"                             │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 10: 합혼 길일 분석 (결혼 상품 전용) ──────────────────────┐
│ ⭐ NEW: 결혼에 좋은 연도/월 분석                               │
│                                                                │
│ [길일 선정 기준]                                               │
│ 1. 양인 모두의 일지에 합이 오는 해                            │
│ 2. 양인 모두의 용신이 강해지는 해                             │
│ 3. 양인의 관살/재성이 좋은 상태인 해                          │
│ 4. 충/형/파/해가 없는 월                                      │
│ 5. 천덕합/월덕합이 있는 날                                    │
│                                                                │
│ [결과]                                                         │
│ - 추천 연도: 2027년 (이유: ...)                               │
│ - 추천 월: 3월, 9월 (이유: ...)                               │
│ - 길일 3개: 양력 2027-03-15, 2027-09-22, ... (각 이유 설명)  │
│                                                                │
│ [벡터DB 검색 #9]                                              │
│   쿼리: "合婚 길일 택일 결혼"                                 │
│   쿼리: "天德合 月德合 婚姻 吉日"                             │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 11: 자녀운 교차 분석 (결혼 상품 전용) ⭐ NEW ──────────────┐
│ 두 사람의 시주(子息宮) 분석                                   │
│                                                                │
│ [분석 항목]                                                    │
│ - 자녀 숫자 예측 (시주 오행, 식상 개수)                       │
│ - 자녀 성별 경향 (양일간/음일간 조합)                         │
│ - 자녀로 인한 복/고(苦) 예측                                  │
│ - 자녀 양육 스타일 차이                                       │
│                                                                │
│ [벡터DB 검색 #10]                                             │
│   쿼리: "자녀운 시주 식상 부부"                               │
│   쿼리: "子息 食神 傷官 子女"                                 │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Step 12: LLM 종합 해석 (DeepSeek-V3) ─────────────────────────┐
│                                                                │
│ [프롬프트 구조] - 8개 카테고리 필수 포함                      │
│                                                                │
│ 1. 💫 첫 만남의 인상과 끌림                                   │
│    - 천간 관계, 음양 조화, 첫인상                             │
│                                                                │
│ 2. 🏠 함께 살면 어떤가 (가정생활)                             │
│    - 일지 합충형파, 생활 패턴                                 │
│                                                                │
│ 3. 🌡️ 기질/성격 조화 (한난조습)                              │
│    - 기후 보완 여부, 정서적 조화                              │
│                                                                │
│ 4. ⚡ 갈등 패턴과 극복법                                      │
│    - 충/형 관계, 갈등 트리거, 해결책                          │
│                                                                │
│ 5. 💰 돈과 생활 스타일 궁합                                   │
│    - 재성/관성 교차, 경제관념                                 │
│                                                                │
│ 6. 💕 연애 vs 결혼 궁합 차이                                  │
│    - 도화살/홍란 영향, 장기적 안정성                          │
│                                                                │
│ 7. 🚀 두 사람이 함께할 때 시너지 영역                         │
│    - 오행 보완, 사업/육아 등 협력 분야                        │
│                                                                │
│ 8. ⚠️ 주의해야 할 위기 시기                                   │
│    - 대운/세운 교차, 충/형이 오는 시점                        │
│                                                                │
│ 9. 📝 종합 궁합 조언                                          │
│    - 전체 요약, 핵심 조언                                     │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
[출력] 궁합 리포트 
       - 웹 뷰 (마크다운 렌더링)
       - PDF 다운로드
       - SNS 공유 카드
```

---

## 4. 백엔드 API 구현 명세

### 4.1 파일 위치

```
ai_saju/
├── api/
│   └── saju_api.py          # 기존 파일 확장
├── src/lib/
│   └── saju-api-client.ts   # 프론트엔드 API 클라이언트
└── supabase/migrations/
    └── 20260203_add_compatibility_chunks.sql  # 추가 청크
```

### 4.2 API 엔드포인트 확장

```python
# api/saju_api.py에 추가할 엔드포인트

# ========================================
# 1. 기본 궁합 분석 (기존 개선)
# ========================================
@app.post("/api/saju/compatibility")
async def analyze_compatibility(request: CompatibilityRequest):
    """
    기본 궁합 분석 - 100점 만점
    
    점수 배분 (확장):
    - 천간 궁합: 15점
    - 지지 궁합 (합충형파해): 20점
    - 지장간 합: 10점
    - 한난조습 조화: 15점
    - 용신 상호 보완: 15점
    - 오행 균형: 10점
    - 대운 동조: 10점
    - 신살 조합: 5점
    """
    pass

# ========================================
# 2. 상세 궁합 분석 (LLM 동적 생성)
# ========================================
@app.post("/api/saju/compatibility/detailed")
async def analyze_compatibility_detailed(request: DetailedCompatibilityRequest):
    """
    상세 궁합 분석 - 8개 카테고리 LLM 해석
    저장된 사주풀이 결과 재활용
    """
    pass

# ========================================
# 3. 합혼 길일 분석 (NEW)
# ========================================
@app.post("/api/saju/compatibility/wedding-dates")
async def analyze_wedding_dates(request: WeddingDateRequest):
    """
    결혼 길일 추천 API
    
    입력: 두 사람 사주 + 희망 연도 범위
    출력: 추천 길일 3개 + 각 이유
    """
    pass

# ========================================
# 4. 비교 궁합 분석 (NEW)
# ========================================
@app.post("/api/saju/compatibility/compare")
async def analyze_compatibility_compare(request: CompareCompatibilityRequest):
    """
    비교 궁합 - 나와 두 명의 후보 비교
    
    입력: 본인 사주 + 후보1 사주 + 후보2 사주
    출력: 각 궁합 점수 + 비교 분석 + 추천
    """
    pass

# ========================================
# 5. 전생 인연 스토리 (NEW)
# ========================================
@app.post("/api/saju/compatibility/story")
async def generate_compatibility_story(request: CompatibilityStoryRequest):
    """
    전생 인연 스토리텔링
    
    천간지지 관계를 전생의 인연으로 풀어쓰기
    젊은 여성층 타깃 감성 콘텐츠
    """
    pass

# ========================================
# 6. 이상형 오행 프로필 (무료 - 유입용)
# ========================================
@app.post("/api/saju/ideal-type")
async def generate_ideal_type_profile(request: IdealTypeRequest):
    """
    이상형 오행 프로필 생성 (무료)
    
    입력: 본인 사주
    출력: 부족 오행 보완 이상형, 조후 상보 이상형
    
    예시: "火 과다 보완을 위해 土나 水 오행이 강한 분이 잘 맞습니다"
    """
    pass
```

### 4.3 데이터 모델 (Pydantic)

```python
# api/saju_api.py에 추가할 Pydantic 모델

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum

class CompatibilityType(str, Enum):
    BASIC = "basic"           # 기본 궁합
    MARRIAGE = "marriage"      # 결혼 궁합
    COMPARE = "compare"        # 비교 궁합
    STORY = "story"           # 전생 인연

# ========================================
# 요청 모델
# ========================================
class CompatibilityRequest(BaseModel):
    """기본 궁합 요청"""
    # Person 1
    person1_name: str
    person1_gender: str  # "male" | "female"
    person1_year: int
    person1_month: int
    person1_day: int
    person1_hour: int
    person1_minute: int = 0
    person1_is_lunar: bool = False
    
    # Person 2
    person2_name: str
    person2_gender: str
    person2_year: int
    person2_month: int
    person2_day: int
    person2_hour: int
    person2_minute: int = 0
    person2_is_lunar: bool = False
    
    # Options
    include_wedding_dates: bool = False  # 결혼 길일 포함 여부
    target_wedding_year: Optional[int] = None

class WeddingDateRequest(BaseModel):
    """합혼 길일 요청"""
    person1_profile_id: str
    person2_profile_id: str
    start_year: int
    end_year: int
    preferred_months: Optional[List[int]] = None  # 선호 월

class CompareCompatibilityRequest(BaseModel):
    """비교 궁합 요청"""
    my_profile_id: str
    candidate1_profile_id: str
    candidate2_profile_id: str

class IdealTypeRequest(BaseModel):
    """이상형 프로필 요청 (무료)"""
    profile_id: str

# ========================================
# 응답 모델
# ========================================
class HannanJoseupResult(BaseModel):
    """한난조습 분석 결과"""
    person1_type: str  # "한(寒)" | "난(暖)" | "조(燥)" | "습(濕)"
    person2_type: str
    harmony_score: int  # 0-20
    description: str
    classical_ref: Optional[str] = None

class JijiInteractionResult(BaseModel):
    """지지 상호작용 결과"""
    interaction_type: str  # "육합" | "삼합" | "충" | "형" | "파" | "해" | "없음"
    pillar_pair: str  # "일지-일지" | "년주-월주" 등
    score_impact: int  # -10 ~ +10
    description: str

class JijangganResult(BaseModel):
    """지장간 합 결과"""
    has_hidden_합: bool
    합_pairs: List[Dict[str, str]]  # [{"gan1": "甲", "gan2": "己", "result": "토"}]
    description: str

class SinsalResult(BaseModel):
    """신살 분석 결과"""
    person1_sinsals: List[Dict[str, Any]]
    person2_sinsals: List[Dict[str, Any]]
    cross_analysis: str  # 교차 분석 결과
    risk_factors: List[str]
    positive_factors: List[str]

class WeddingDateRecommendation(BaseModel):
    """결혼 길일 추천"""
    date: str  # "2027-03-15"
    day_pillar: str  # "甲子"
    score: int  # 0-100
    reasons: List[str]
    warnings: Optional[List[str]] = None

class CompatibilitySection(BaseModel):
    """궁합 섹션"""
    id: str
    title: str
    score: int
    max_score: int
    summary: str
    details: List[str]
    classical_refs: Optional[List[Dict[str, str]]] = None
    easy_explanation: Optional[str] = None  # 쉬운 설명

class CompatibilityResponse(BaseModel):
    """궁합 분석 응답 (확장)"""
    success: bool
    processing_time_ms: int
    
    # 기본 정보
    total_score: int  # 0-100
    grade: str  # "천생연분" | "좋은 인연" | "보통" | "노력 필요" | "주의 필요"
    emoji: str
    summary: str
    
    # 상세 분석 (확장)
    sections: List[CompatibilitySection]
    
    # NEW: 한난조습
    hannan_joseup: Optional[HannanJoseupResult] = None
    
    # NEW: 지지 상호작용 (형/파/해 포함)
    jiji_interactions: Optional[List[JijiInteractionResult]] = None
    
    # NEW: 지장간 합
    jijanggan: Optional[JijangganResult] = None
    
    # NEW: 신살 분석
    sinsals: Optional[SinsalResult] = None
    
    # 고전 문헌 참조
    classical_references: List[Dict[str, Any]]
    
    # AI 종합 해석
    ai_synthesis: Optional[str] = None
    
    # 조언
    advice: str
    strengths: List[str]
    weaknesses: List[str]
    
    # 위기 시기 (대운/세운 분석)
    crisis_periods: Optional[List[Dict[str, Any]]] = None
    
    # 결혼 길일 (옵션)
    wedding_dates: Optional[List[WeddingDateRecommendation]] = None
    
    error: Optional[str] = None

class IdealTypeResponse(BaseModel):
    """이상형 프로필 응답 (무료)"""
    success: bool
    
    # 부족 오행 분석
    lacking_elements: List[str]
    excessive_elements: List[str]
    
    # 이상형 오행
    ideal_elements: List[str]
    ideal_element_description: str
    
    # 조후 기반 이상형
    hannan_joseup_type: str  # "한(寒)" | "난(暖)" 등
    ideal_hannan_type: str
    ideal_hannan_description: str
    
    # 십신 기반 이상형
    ideal_sipsin_relationship: str
    
    # CTA
    cta_message: str  # "지금 상대방의 사주를 입력해서 실제 궁합을 확인해보세요"
```

### 4.4 핵심 분석 함수 구현

```python
# api/saju_api.py에 추가할 분석 함수

# ========================================
# 한난조습(寒暖燥濕) 분석
# ========================================
def analyze_hannan_joseup(info) -> str:
    """
    개인 사주의 한난조습 판정
    
    판정 기준:
    - 寒(한): 亥子丑월생 + 水金 과다 + 火 부족
    - 暖(난): 巳午未월생 + 火土 과다 + 水 부족
    - 燥(조): 寅卯辰/申酉戌월생 + 火가 있고 水 부족
    - 濕(습): 水가 많고 火가 없거나 약함
    """
    month_zhi = info.pillars['month']['zhi']
    wuxing = calculate_wuxing_balance(info)
    
    # 월지 기반 계절 판정
    cold_months = ['亥', '子', '丑']  # 겨울
    hot_months = ['巳', '午', '未']   # 여름
    spring_months = ['寅', '卯', '辰']
    autumn_months = ['申', '酉', '戌']
    
    water = wuxing.get('수', 0)
    fire = wuxing.get('화', 0)
    metal = wuxing.get('금', 0)
    wood = wuxing.get('목', 0)
    earth = wuxing.get('토', 0)
    
    # 한(寒) 판정
    if month_zhi in cold_months and (water + metal) > (fire + earth) and fire < 2:
        return "한(寒)"
    
    # 난(暖) 판정
    if month_zhi in hot_months and (fire + earth) > (water + metal) and water < 2:
        return "난(暖)"
    
    # 조(燥) 판정
    if fire >= 2 and water <= 1:
        return "조(燥)"
    
    # 습(濕) 판정
    if water >= 3 and fire <= 1:
        return "습(濕)"
    
    # 중화(中和) - 균형 잡힌 경우
    return "중화(中和)"

def analyze_hannan_joseup_compatibility(info1, info2, name1: str, name2: str) -> HannanJoseupResult:
    """
    두 사주의 한난조습 궁합 분석
    """
    type1 = analyze_hannan_joseup(info1)
    type2 = analyze_hannan_joseup(info2)
    
    # 조합별 점수 및 해석
    compatibility_matrix = {
        ("한(寒)", "난(暖)"): (20, "최상의 조합! 서로의 부족함을 완벽하게 채워줍니다."),
        ("난(暖)", "한(寒)"): (20, "최상의 조합! 서로의 부족함을 완벽하게 채워줍니다."),
        ("조(燥)", "습(濕)"): (20, "최상의 조합! 메마름과 촉촉함이 조화를 이룹니다."),
        ("습(濕)", "조(燥)"): (20, "최상의 조합! 메마름과 촉촉함이 조화를 이룹니다."),
        ("한(寒)", "한(寒)"): (8, "둘 다 차가운 기운이 강해 냉랭한 관계가 될 수 있습니다."),
        ("난(暖)", "난(暖)"): (8, "둘 다 뜨거운 기운이 강해 충돌이 잦을 수 있습니다."),
        ("조(燥)", "조(燥)"): (10, "둘 다 건조한 기운이 강해 메마른 관계가 될 수 있습니다."),
        ("습(濕)", "습(濕)"): (10, "둘 다 습한 기운이 강해 침체될 수 있습니다."),
        ("중화(中和)", _): (15, "한쪽이 균형 잡혀 있어 안정적입니다."),
    }
    
    # 기본값
    score = 12
    description = f"{name1}님은 {type1}, {name2}님은 {type2}입니다. 서로 보완하며 조화를 이룰 수 있습니다."
    
    # 조합 찾기
    for (t1, t2), (s, d) in compatibility_matrix.items():
        if (type1 == t1 and type2 == t2) or (t2 == "_"):
            score = s
            description = d.replace("{name1}", name1).replace("{name2}", name2)
            break
    
    return HannanJoseupResult(
        person1_type=type1,
        person2_type=type2,
        harmony_score=score,
        description=description,
        classical_ref="適天髓: '天道有寒暖，地道有燥濕'"
    )

# ========================================
# 지지 형(刑)/파(破)/해(害) 분석
# ========================================
ZHI_XING = {
    # 무례지형 (子卯刑)
    '子': '卯', '卯': '子',
    # 무은지형 (寅巳申刑 - 순환)
    '寅': '巳', '巳': '申', '申': '寅',
    # 무자지형 (丑戌未刑 - 순환)
    '丑': '戌', '戌': '未', '未': '丑',
    # 자형 (辰辰, 午午, 酉酉, 亥亥)
}

ZHI_PO = {
    '子': '酉', '酉': '子',
    '丑': '辰', '辰': '丑',
    '寅': '亥', '亥': '寅',
    '卯': '午', '午': '卯',
    '巳': '申', '申': '巳',
    '未': '戌', '戌': '未',
}

ZHI_HAI = {
    '子': '未', '未': '子',
    '丑': '午', '午': '丑',
    '寅': '巳', '巳': '寅',
    '卯': '辰', '辰': '卯',
    '申': '亥', '亥': '申',
    '酉': '戌', '戌': '酉',
}

def analyze_all_jiji_interactions(info1, info2, name1: str, name2: str) -> List[JijiInteractionResult]:
    """
    두 사주의 모든 지지 상호작용 분석 (합/충/형/파/해)
    """
    results = []
    
    pillars_pairs = [
        ('year', 'year', '년주-년주'),
        ('year', 'month', '년주-월주'),
        ('month', 'month', '월주-월주'),
        ('day', 'day', '일지-일지'),
        ('day', 'hour', '일주-시주'),
        ('hour', 'hour', '시주-시주'),
    ]
    
    for p1_key, p2_key, pair_name in pillars_pairs:
        zhi1 = info1.pillars[p1_key]['zhi']
        zhi2 = info2.pillars[p2_key]['zhi']
        
        # 육합 체크
        if ZHI_LIUHE.get(zhi1) == zhi2:
            results.append(JijiInteractionResult(
                interaction_type="육합",
                pillar_pair=pair_name,
                score_impact=5,
                description=f"{zhi1}과 {zhi2}의 육합 - 자연스러운 결합"
            ))
        
        # 삼합 체크 (생략 - 기존 로직 유지)
        
        # 충 체크
        if ZHI_CHONG.get(zhi1) == zhi2:
            impact = -5 if pair_name == '일지-일지' else -3
            results.append(JijiInteractionResult(
                interaction_type="충",
                pillar_pair=pair_name,
                score_impact=impact,
                description=f"{zhi1}과 {zhi2}의 충 - {'배우자궁 충돌로 갈등 주의' if pair_name == '일지-일지' else '갈등 요소'}"
            ))
        
        # 형 체크
        if ZHI_XING.get(zhi1) == zhi2 or ZHI_XING.get(zhi2) == zhi1:
            xing_type = ""
            if (zhi1 == '子' and zhi2 == '卯') or (zhi1 == '卯' and zhi2 == '子'):
                xing_type = "무례지형(無禮之刑) - 예의 없는 관계"
            elif zhi1 in ['寅', '巳', '申'] and zhi2 in ['寅', '巳', '申']:
                xing_type = "무은지형(無恩之刑) - 은혜를 모르는 관계"
            elif zhi1 in ['丑', '戌', '未'] and zhi2 in ['丑', '戌', '未']:
                xing_type = "무자지형(無自之刑) - 자비 없는 관계"
            
            results.append(JijiInteractionResult(
                interaction_type="형",
                pillar_pair=pair_name,
                score_impact=-4,
                description=f"{zhi1}과 {zhi2}의 형 - {xing_type}"
            ))
        
        # 파 체크
        if ZHI_PO.get(zhi1) == zhi2:
            results.append(JijiInteractionResult(
                interaction_type="파",
                pillar_pair=pair_name,
                score_impact=-2,
                description=f"{zhi1}과 {zhi2}의 파(破) - 깨지는 인연, 약속 불이행"
            ))
        
        # 해 체크
        if ZHI_HAI.get(zhi1) == zhi2:
            results.append(JijiInteractionResult(
                interaction_type="해",
                pillar_pair=pair_name,
                score_impact=-3,
                description=f"{zhi1}과 {zhi2}의 해(害) - 서로 해치는 관계, 뒷담화"
            ))
    
    return results

# ========================================
# 지장간(支藏干) 합 분석
# ========================================
JIJANGGAN = {
    '子': ['癸'],
    '丑': ['癸', '辛', '己'],
    '寅': ['甲', '丙', '戊'],
    '卯': ['乙'],
    '辰': ['乙', '癸', '戊'],
    '巳': ['丙', '庚', '戊'],
    '午': ['丁', '己'],
    '未': ['丁', '乙', '己'],
    '申': ['庚', '壬', '戊'],
    '酉': ['辛'],
    '戌': ['辛', '丁', '戊'],
    '亥': ['壬', '甲'],
}

def analyze_jijanggan_compatibility(info1, info2, name1: str, name2: str) -> JijangganResult:
    """
    지장간 합 분석 - 숨은 인연 찾기
    """
    zhi1 = info1.pillars['day']['zhi']
    zhi2 = info2.pillars['day']['zhi']
    
    gans1 = JIJANGGAN.get(zhi1, [])
    gans2 = JIJANGGAN.get(zhi2, [])
    
    합_pairs = []
    
    # 천간합 조합
    gan_he_pairs = [
        ('甲', '己', '토'),
        ('乙', '庚', '금'),
        ('丙', '辛', '수'),
        ('丁', '壬', '목'),
        ('戊', '癸', '화'),
    ]
    
    for g1 in gans1:
        for g2 in gans2:
            for (h1, h2, result) in gan_he_pairs:
                if (g1 == h1 and g2 == h2) or (g1 == h2 and g2 == h1):
                    합_pairs.append({
                        "gan1": g1,
                        "gan2": g2,
                        "result": result
                    })
    
    has_hidden_합 = len(합_pairs) > 0
    
    if has_hidden_합:
        description = f"{name1}님의 일지 {zhi1} 안의 {', '.join(gans1)}과 {name2}님의 일지 {zhi2} 안의 {', '.join(gans2)} 중에서 천간합이 발견되었습니다. 겉으로는 잘 안 맞아 보여도 속으로 통하는 숨은 인연이 있습니다."
    else:
        description = f"지장간에서 특별한 합이 발견되지 않았습니다."
    
    return JijangganResult(
        has_hidden_합=has_hidden_합,
        합_pairs=합_pairs,
        description=description
    )

# ========================================
# 신살(神煞) 분석
# ========================================
def calculate_dohua(year_zhi: str) -> str:
    """도화살 계산"""
    dohua_map = {
        '申': '酉', '子': '酉', '辰': '酉',  # 申子辰 → 酉
        '寅': '卯', '午': '卯', '戌': '卯',  # 寅午戌 → 卯
        '巳': '午', '酉': '午', '丑': '午',  # 巳酉丑 → 午
        '亥': '子', '卯': '子', '未': '子',  # 亥卯未 → 子
    }
    return dohua_map.get(year_zhi, '')

def calculate_hongran(year_zhi: str) -> str:
    """홍란성 계산 (결혼/연애운)"""
    hongran_map = {
        '子': '卯', '丑': '寅', '寅': '丑', '卯': '子',
        '辰': '亥', '巳': '戌', '午': '酉', '未': '申',
        '申': '未', '酉': '午', '戌': '巳', '亥': '辰',
    }
    return hongran_map.get(year_zhi, '')

def calculate_tianxi(year_zhi: str) -> str:
    """천희성 계산 (기쁨/경사)"""
    tianxi_map = {
        '子': '酉', '丑': '申', '寅': '未', '卯': '午',
        '辰': '巳', '巳': '辰', '午': '卯', '未': '寅',
        '申': '丑', '酉': '子', '戌': '亥', '亥': '戌',
    }
    return tianxi_map.get(year_zhi, '')

def analyze_sinsals_compatibility(info1, info2, name1: str, name2: str) -> SinsalResult:
    """
    신살 궁합 분석
    """
    year_zhi1 = info1.pillars['year']['zhi']
    year_zhi2 = info2.pillars['year']['zhi']
    
    sinsals1 = []
    sinsals2 = []
    
    # Person 1 신살
    dohua1 = calculate_dohua(year_zhi1)
    if dohua1:
        sinsals1.append({"name": "도화살", "zhi": dohua1, "type": "caution"})
    
    hongran1 = calculate_hongran(year_zhi1)
    if hongran1:
        sinsals1.append({"name": "홍란성", "zhi": hongran1, "type": "positive"})
    
    tianxi1 = calculate_tianxi(year_zhi1)
    if tianxi1:
        sinsals1.append({"name": "천희성", "zhi": tianxi1, "type": "positive"})
    
    # Person 2 신살 (동일 로직)
    dohua2 = calculate_dohua(year_zhi2)
    if dohua2:
        sinsals2.append({"name": "도화살", "zhi": dohua2, "type": "caution"})
    
    hongran2 = calculate_hongran(year_zhi2)
    if hongran2:
        sinsals2.append({"name": "홍란성", "zhi": hongran2, "type": "positive"})
    
    tianxi2 = calculate_tianxi(year_zhi2)
    if tianxi2:
        sinsals2.append({"name": "천희성", "zhi": tianxi2, "type": "positive"})
    
    # 교차 분석
    risk_factors = []
    positive_factors = []
    
    # 둘 다 도화살이면 바람기 주의
    if dohua1 and dohua2:
        risk_factors.append("양쪽 모두 도화살이 있어 외부 유혹에 주의가 필요합니다.")
    
    # 홍란성이 상대방 일지와 합이면 결혼운 상승
    if hongran1 == info2.pillars['day']['zhi'] or hongran2 == info1.pillars['day']['zhi']:
        positive_factors.append("홍란성과 배우자궁이 연결되어 결혼 인연이 강합니다.")
    
    cross_analysis = ""
    if positive_factors:
        cross_analysis = " ".join(positive_factors)
    elif risk_factors:
        cross_analysis = " ".join(risk_factors)
    else:
        cross_analysis = "신살 측면에서 특별히 두드러지는 요소가 없습니다."
    
    return SinsalResult(
        person1_sinsals=sinsals1,
        person2_sinsals=sinsals2,
        cross_analysis=cross_analysis,
        risk_factors=risk_factors,
        positive_factors=positive_factors
    )
```

---

## 5. 프론트엔드 구현 명세

### 5.1 컴포넌트 구조

```
src/app/components/
├── CompatibilityPage.tsx       # 메인 궁합 페이지 (기존 확장)
├── CompatibilityInputForm.tsx  # 두 사람 정보 입력 폼
├── CompatibilityResult.tsx     # 결과 표시 컴포넌트
├── CompatibilitySection.tsx    # 개별 섹션 (접힘/펼침)
├── CompatibilityChart.tsx      # 오행 비교 차트
├── WeddingDatePicker.tsx       # 결혼 길일 선택 (유료)
├── IdealTypeCard.tsx           # 이상형 프로필 카드 (무료)
└── CompatibilityShareCard.tsx  # SNS 공유 카드
```

### 5.2 주요 UI 개선

```tsx
// src/app/components/CompatibilityResult.tsx

interface CompatibilitySectionProps {
  section: CompatibilitySection;
  isExpanded: boolean;
  onToggle: () => void;
  theme: ModeTheme;
}

const sections = [
  { id: 'overall', title: '종합 궁합', icon: '💫', maxScore: 100 },
  { id: 'hannan', title: '한난조습(寒暖燥濕)', icon: '🌡️', maxScore: 20 },
  { id: 'chungHap', title: '합충형파(合沖刑破)', icon: '🔗', maxScore: 20 },
  { id: 'jijanggan', title: '지장간 합', icon: '🔮', maxScore: 10 },
  { id: 'sipsin', title: '십신 관계', icon: '🎭', maxScore: 15 },
  { id: 'yongshen', title: '용신 보완', icon: '⚖️', maxScore: 15 },
  { id: 'wuxing', title: '오행 균형', icon: '🌀', maxScore: 10 },
  { id: 'daeun', title: '대운 동조', icon: '📅', maxScore: 10 },
  { id: 'sinsal', title: '신살 분석', icon: '⭐', maxScore: 5 },
];
```

---

## 6. 벡터DB 검색 쿼리 명세

### 6.1 궁합 전용 검색 쿼리 패턴

```python
# api/saju_api.py 내 검색 함수

def get_compatibility_search_queries(info1, info2) -> List[str]:
    """궁합 분석용 벡터 검색 쿼리 생성"""
    
    queries = []
    
    # 1. 천간합 관련
    gan1_ko = GAN_TO_KO.get(info1.day_gan, info1.day_gan)
    gan2_ko = GAN_TO_KO.get(info2.day_gan, info2.day_gan)
    queries.append(f"궁합 {gan1_ko}일간 {gan2_ko}일간 천간합 부부")
    queries.append(f"天干合 {info1.day_gan}{info2.day_gan} 夫婦")
    
    # 2. 일지 합충 관련
    zhi1 = info1.pillars['day']['zhi']
    zhi2 = info2.pillars['day']['zhi']
    zhi1_ko = ZHI_KO_MAP.get(zhi1, zhi1)
    zhi2_ko = ZHI_KO_MAP.get(zhi2, zhi2)
    queries.append(f"일지 {zhi1_ko} {zhi2_ko} 육합 삼합 충 배우자궁")
    queries.append(f"日支 {zhi1}{zhi2} 合沖 配偶")
    
    # 3. 한난조습 관련
    hannan1 = analyze_hannan_joseup(info1)
    hannan2 = analyze_hannan_joseup(info2)
    queries.append(f"한난조습 {hannan1} {hannan2} 부부 궁합 조후")
    queries.append(f"寒暖燥濕 調候 夫婦 配合")
    
    # 4. 십신 관계 관련
    sipsin_a_to_b = calculate_sipsin(info1.day_gan, info2.day_gan)
    sipsin_b_to_a = calculate_sipsin(info2.day_gan, info1.day_gan)
    queries.append(f"{sipsin_a_to_b} {sipsin_b_to_a} 부부 관계 상호작용")
    
    # 5. 여명 특수 (여성이 있는 경우)
    queries.append(f"여명 관성 식상 남편운 궁합")
    queries.append(f"女命 官星 食傷 夫星")
    
    # 6. 신살 관련
    queries.append(f"도화살 홍란성 천희성 연애 궁합 배우자")
    queries.append(f"桃花 紅鸞 天喜 婚姻 姻緣")
    
    # 7. 비겁/상관 위험 신호
    queries.append(f"비겁 상관 극처 극부 혼인운")
    queries.append(f"比劫 傷官 克妻 克夫 婚姻")
    
    return queries

async def search_compatibility_references(info1, info2, searcher) -> List[Dict]:
    """궁합 관련 고전문헌 검색"""
    queries = get_compatibility_search_queries(info1, info2)
    
    all_results = []
    seen_titles = set()
    
    for query in queries:
        try:
            results = searcher.search(query, top_k=3, min_score=0.35, mode="D")
            for r in results:
                if r.title not in seen_titles:
                    seen_titles.add(r.title)
                    all_results.append({
                        "book_title": r.book_title,
                        "title": r.title,
                        "content": r.content[:500],
                        "score": r.score,
                        "matched_patterns": list(r.matched_patterns) if r.matched_patterns else [],
                    })
        except Exception as e:
            print(f"검색 오류: {query} - {e}")
    
    # 점수순 정렬 후 상위 10개
    all_results.sort(key=lambda x: x['score'], reverse=True)
    return all_results[:10]
```

---

## 7. LLM 프롬프트 설계

### 7.1 종합 궁합 해석 프롬프트

```python
# api/saju_api.py 내 LLM 프롬프트

COMPATIBILITY_SYSTEM_PROMPT = """당신은 중국 최고 명문 사주명리학 대가 20년차 입니다.
두 사람의 궁합을 깊이 있게 분석하되, 다음 원칙을 지켜주세요:

1. 고전 명리학 이론에 기반하여 분석하세요 (적천수, 자평진전, 삼명통회 등)
2. 한난조습(寒暖燥濕)을 궁합의 근본으로 중시하세요
3. 단순한 점수 산출이 아닌 "관계의 동역학"을 분석하세요
4. 긍정적인 면과 주의할 점을 균형 있게 제시하세요
5. 쉬운 설명과 전문적 설명을 모두 포함하세요
6. 하드코딩된 해석 없이, 실제 사주 데이터에 기반한 맞춤 분석을 하세요
"""

def generate_compatibility_llm_prompt(
    info1, info2, 
    name1: str, name2: str,
    hannan_result: HannanJoseupResult,
    jiji_interactions: List[JijiInteractionResult],
    jijanggan_result: JijangganResult,
    sinsal_result: SinsalResult,
    classical_refs: List[Dict]
) -> str:
    
    # 사주 정보 요약
    saju1_summary = f"""
【{name1}님 사주】
- 연주: {info1.pillars['year']['gan']}{info1.pillars['year']['zhi']}
- 월주: {info1.pillars['month']['gan']}{info1.pillars['month']['zhi']}
- 일주: {info1.pillars['day']['gan']}{info1.pillars['day']['zhi']} (일간: {info1.day_gan_ko})
- 시주: {info1.pillars['hour']['gan']}{info1.pillars['hour']['zhi']}
- 한난조습: {hannan_result.person1_type}
- 용신: {info1.yongshen if hasattr(info1, 'yongshen') else '미정'}
"""
    
    saju2_summary = f"""
【{name2}님 사주】
- 연주: {info2.pillars['year']['gan']}{info2.pillars['year']['zhi']}
- 월주: {info2.pillars['month']['gan']}{info2.pillars['month']['zhi']}
- 일주: {info2.pillars['day']['gan']}{info2.pillars['day']['zhi']} (일간: {info2.day_gan_ko})
- 시주: {info2.pillars['hour']['gan']}{info2.pillars['hour']['zhi']}
- 한난조습: {hannan_result.person2_type}
- 용신: {info2.yongshen if hasattr(info2, 'yongshen') else '미정'}
"""
    
    # 분석 데이터 요약
    analysis_data = f"""
【한난조습 분석】
{hannan_result.description}

【지지 상호작용】
{chr(10).join([f"- {j.pillar_pair}: {j.interaction_type} ({j.description})" for j in jiji_interactions]) if jiji_interactions else "특별한 상호작용 없음"}

【지장간 합】
{jijanggan_result.description}

【신살 분석】
{sinsal_result.cross_analysis}

【관련 고전 문헌】
{chr(10).join([f"- {r['title']}: {r['content'][:200]}..." for r in classical_refs[:5]]) if classical_refs else "검색된 문헌 없음"}
"""
    
    user_prompt = f"""{saju1_summary}
{saju2_summary}
{analysis_data}

위 두 사람의 궁합을 다음 8개 카테고리로 상세 분석해주세요.
반드시 JSON 형식으로 응답하세요.

{{
  "totalScore": 0-100 사이 점수,
  "grade": "천생연분/좋은 인연/보통/노력 필요/주의 필요" 중 하나,
  "summary": "전체 궁합 요약 (100자 이내)",
  "sections": {{
    "firstImpression": {{
      "title": "💫 첫 만남의 인상과 끌림",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "livingTogether": {{
      "title": "🏠 함께 살면 어떤가",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "temperament": {{
      "title": "🌡️ 기질/성격 조화 (한난조습)",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "conflict": {{
      "title": "⚡ 갈등 패턴과 극복법",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "finance": {{
      "title": "💰 돈과 생활 스타일",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "datingVsMarriage": {{
      "title": "💕 연애 vs 결혼 궁합 차이",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "synergy": {{
      "title": "🚀 시너지 영역",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "crisis": {{
      "title": "⚠️ 주의 시기",
      "score": 0-100,
      "summary": "한 줄 요약",
      "details": ["상세 설명 1", "상세 설명 2"],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }}
  }},
  "advice": "종합 조언 (300자 이상)"
}}
"""
    
    return user_prompt
```

---

## 8. 상품 구성 및 과금 로직

### 8.1 상품 구성

| 상품명 | 가격 | 포함 기능 | 타깃 |
|--------|------|-----------|------|
| **기본 궁합** | ₩4,900 | 8개 카테고리 분석 + 고전문헌 인용 | 연인 |
| **결혼 궁합 심층** | ₩9,900 | 기본 + 길일 3개 + 위기 시기 + 자녀운 | 결혼 준비 |
| **비교 궁합** | ₩6,900 | 나와 두 명 후보 비교 분석 | 선택 고민 |
| **전생 인연 궁합** | ₩3,900 | 스토리텔링 형식 해석 | 20대 여성 |

### 8.2 무료 유입 전략

```typescript
// 이상형 오행 프로필 (무료)
// src/app/components/IdealTypeCard.tsx

const IdealTypeCard = ({ profile, result }) => {
  return (
    <div className="ideal-type-card">
      <h3>🎯 {profile.name}님의 이상형 오행 프로필</h3>
      
      <div className="lacking-elements">
        <span>부족 오행:</span>
        {result.lacking_elements.map(e => <Badge key={e}>{e}</Badge>)}
      </div>
      
      <div className="ideal-elements">
        <span>이상형 오행:</span>
        {result.ideal_elements.map(e => <Badge key={e} variant="primary">{e}</Badge>)}
      </div>
      
      <p className="description">
        {result.ideal_element_description}
      </p>
      
      <p className="hannan-type">
        당신은 <strong>{result.hannan_joseup_type}</strong> 타입이므로,
        <strong>{result.ideal_hannan_type}</strong> 타입의 상대가 잘 맞습니다.
      </p>
      
      {/* CTA */}
      <Button onClick={navigateToCompatibility}>
        💑 지금 상대방 사주 입력하고 실제 궁합 확인하기
      </Button>
    </div>
  );
};
```

### 8.3 SNS 공유 카드

```typescript
// src/app/components/CompatibilityShareCard.tsx

const generateShareCard = (result: CompatibilityResponse) => {
  return {
    title: `${result.grade} 궁합 💕`,
    description: `총점 ${result.total_score}점 | ${result.summary}`,
    image: generateOGImage({
      score: result.total_score,
      grade: result.grade,
      emoji: result.emoji,
      highlights: result.strengths.slice(0, 2),
    }),
    url: `https://aisaju.com/compatibility/share/${result.id}`,
  };
};
```

---

## 📌 구현 우선순위

### Phase 1 (즉시)
1. ✅ 한난조습 분석 함수 추가
2. ✅ 지지 형/파/해 분석 추가
3. ✅ 지장간 합 분석 추가
4. ✅ 벡터 검색 쿼리 최적화

### Phase 2 (1주 내)
1. ⬜ 신살 분석 함수 추가
2. ⬜ LLM 프롬프트 개선
3. ⬜ 프론트엔드 UI 개선
4. ⬜ 추가 고전문헌 청크 수집

### Phase 3 (2주 내)
1. ⬜ 합혼 길일 API
2. ⬜ 비교 궁합 API
3. ⬜ 이상형 프로필 API (무료)
4. ⬜ SNS 공유 기능

### Phase 4 (1개월 내)
1. ⬜ 전생 인연 스토리 API
2. ⬜ PDF 리포트 생성
3. ⬜ 결제 연동
4. ⬜ A/B 테스트

---

## 🔗 관련 문서

- [INFRASTRUCTURE_DESIGN.md](./INFRASTRUCTURE_DESIGN.md) - 전체 인프라 설계
- [LLM_COMPARISON.md](./LLM_COMPARISON.md) - LLM 모델 비교
- [DEEPSEEK_SETUP_GUIDE.md](./DEEPSEEK_SETUP_GUIDE.md) - DeepSeek 설정 가이드

---

**작성자**: AI Saju Development Team  
**최종 검토**: 2026-02-03
