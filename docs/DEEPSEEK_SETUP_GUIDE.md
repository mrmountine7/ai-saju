# DeepSeek API 상용 서비스 이용 가이드
## 1만 사용자 사주풀이 서비스 구축용

---

## 1. DeepSeek 서비스 개요

### 1.1 사용 모델

| 모델명 | API 호출명 | 용도 | 특징 |
|--------|------------|------|------|
| **DeepSeek-V3.2** | `deepseek-chat` | 사주 분석, 해석 생성 | Non-thinking 모드, 빠른 응답 |
| **DeepSeek-V3.2** | `deepseek-reasoner` | 복잡한 추론 (선택) | Thinking 모드, 깊은 분석 |

### 1.2 가격 정책 (2026년 2월 기준)

| 항목 | 가격 (1M 토큰) | 비고 |
|------|----------------|------|
| **Input (캐시 히트)** | $0.028 | 90% 할인! |
| **Input (캐시 미스)** | $0.28 | 기본 가격 |
| **Output** | $0.42 | 생성 텍스트 |

### 1.3 비용 예측 (1만 사용자)

```
일일 분석: 15,000회
분석당 토큰: Input 1,500 + Output 800 = 2,300 토큰

[캐시 미적용 시]
- Input: 15,000 × 1,500 × 30일 = 675M 토큰 → $189
- Output: 15,000 × 800 × 30일 = 360M 토큰 → $151
- 월 합계: ~$340

[캐시 적용 시 (90% 히트율)]
- Input (캐시 히트): 607.5M × $0.028 = $17
- Input (캐시 미스): 67.5M × $0.28 = $19
- Output: 360M × $0.42 = $151
- 월 합계: ~$187

[Redis 캐싱 추가 적용 시 (동일 사주 재사용)]
- API 호출 감소: 90% → 실제 호출 1,500회/일
- 월 예상 비용: $20~40
```

---

## 2. 계정 생성 및 API 키 발급

### 2.1 회원가입

#### Step 1: 플랫폼 접속
```
https://platform.deepseek.com
```

#### Step 2: 회원가입
1. **Sign Up** 클릭
2. 이메일 주소 입력
3. 비밀번호 설정 (8자 이상, 영문+숫자)
4. 이메일 인증 코드 입력
5. 가입 완료

> ⚠️ **주의**: 중국 외 지역에서는 이메일 가입만 가능 (Google, 전화번호 불가)

#### Step 3: 로그인
```
https://platform.deepseek.com/sign_in
```

### 2.2 API 키 생성

#### Step 1: API Keys 페이지 이동
```
https://platform.deepseek.com/api_keys
```

#### Step 2: 새 API 키 생성
1. **Create new API key** 클릭
2. 키 이름 입력 (예: `saju-service-prod`)
3. **Create** 클릭
4. 생성된 키 복사 및 안전하게 저장

```
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **중요**: API 키는 생성 직후에만 전체 표시됩니다. 반드시 즉시 복사하여 안전한 곳에 저장하세요!

#### Step 3: 키 관리
- 프로덕션/스테이징 환경별로 별도 키 생성 권장
- 키 유출 시 즉시 비활성화 가능

### 2.3 크레딧 충전

#### Step 1: Top Up 페이지 이동
```
https://platform.deepseek.com/top_up
```

#### Step 2: 결제 수단 등록
- **지원 결제 수단**: Visa, MasterCard, American Express
- 한국 카드 사용 가능

#### Step 3: 금액 충전
| 충전 금액 | 권장 대상 |
|-----------|-----------|
| $10 | 개발/테스트 |
| $50 | MVP 운영 |
| $200 | 1만 사용자 1개월 |
| $500 | 3개월 운영 |

> 💡 **팁**: 자동 충전(Auto Top-up) 설정으로 서비스 중단 방지

#### Step 4: 자동 충전 설정 (권장)
1. **Auto Top-up** 활성화
2. 임계값 설정: $20 이하 시 자동 충전
3. 충전 금액: $100

---

## 3. API 연동 구현

### 3.1 기본 API 호출

#### Python (FastAPI 백엔드)

```python
# config/settings.py

from pydantic_settings import BaseSettings
from functools import lru_cache

class DeepSeekSettings(BaseSettings):
    api_key: str
    base_url: str = "https://api.deepseek.com/v1"
    model: str = "deepseek-chat"
    max_tokens: int = 1000
    temperature: float = 0.4
    timeout: int = 60
    
    class Config:
        env_prefix = "DEEPSEEK_"

@lru_cache()
def get_settings():
    return DeepSeekSettings()

settings = get_settings()
```

```python
# services/deepseek_service.py

import httpx
import asyncio
from typing import Optional, Tuple
from tenacity import retry, stop_after_attempt, wait_exponential
from config.settings import settings

class DeepSeekService:
    """DeepSeek API 서비스"""
    
    def __init__(self):
        self.base_url = settings.deepseek.base_url
        self.api_key = settings.deepseek.api_key
        self.model = settings.deepseek.model
        self.client = httpx.AsyncClient(
            timeout=settings.deepseek.timeout,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.4,
    ) -> str:
        """DeepSeek Chat API 호출"""
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
            },
        )
        
        response.raise_for_status()
        data = response.json()
        
        return data["choices"][0]["message"]["content"]
    
    async def chat_with_usage(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.4,
    ) -> Tuple[str, dict]:
        """응답 + 토큰 사용량 반환"""
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        
        response.raise_for_status()
        data = response.json()
        
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        
        return content, {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
            "prompt_cache_hit_tokens": usage.get("prompt_cache_hit_tokens", 0),
        }
    
    async def close(self):
        """클라이언트 종료"""
        await self.client.aclose()


# 싱글톤 인스턴스
_deepseek_service: Optional[DeepSeekService] = None

def get_deepseek_service() -> DeepSeekService:
    global _deepseek_service
    if _deepseek_service is None:
        _deepseek_service = DeepSeekService()
    return _deepseek_service
```

### 3.2 사주 분석 통합

```python
# services/saju_llm_service.py

from services.deepseek_service import get_deepseek_service
from services.cache_service import get_cache_service
from typing import Tuple
import hashlib
import json

class SajuLLMService:
    """사주풀이 LLM 서비스"""
    
    SYSTEM_PROMPT = """당신은 40년 경력의 명리학 전문가입니다.
사주팔자를 분석할 때 다음 원칙을 따릅니다:
1. 삼명통회, 적천수, 자평진전 등 고전의 원리를 기반으로 해석
2. 한국어로 자연스럽고 친근하게 설명
3. 전문 용어는 쉽게 풀어서 설명
4. 긍정적이고 건설적인 조언 제공"""

    def __init__(self):
        self.deepseek = get_deepseek_service()
        self.cache = get_cache_service()
    
    def _make_cache_key(self, pillars: dict) -> str:
        """사주 기반 캐시 키 생성"""
        key_data = json.dumps(pillars, sort_keys=True)
        return f"saju:analysis:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    async def analyze(
        self,
        saju_info: dict,
        search_context: str,
    ) -> Tuple[str, str, dict]:
        """
        사주 분석 (종합해석 + 쉬운설명)
        
        Returns:
            (synthesis, easy_explanation, usage_info)
        """
        
        # 캐시 확인
        cache_key = self._make_cache_key(saju_info.get("pillars", {}))
        cached = await self.cache.get(cache_key)
        if cached:
            return cached["synthesis"], cached["easy_explanation"], {"cached": True}
        
        # 병렬 LLM 호출
        synthesis_prompt = self._build_synthesis_prompt(saju_info, search_context)
        easy_prompt = self._build_easy_prompt(saju_info)
        
        # 병렬 실행
        synthesis_task = self.deepseek.chat_with_usage(
            synthesis_prompt, 
            self.SYSTEM_PROMPT,
            max_tokens=1200
        )
        easy_task = self.deepseek.chat_with_usage(
            easy_prompt,
            self.SYSTEM_PROMPT, 
            max_tokens=800
        )
        
        results = await asyncio.gather(synthesis_task, easy_task)
        
        synthesis, usage1 = results[0]
        easy_explanation, usage2 = results[1]
        
        # 캐시 저장 (12시간)
        await self.cache.set(cache_key, {
            "synthesis": synthesis,
            "easy_explanation": easy_explanation,
        }, ttl=43200)
        
        # 총 사용량
        total_usage = {
            "prompt_tokens": usage1["prompt_tokens"] + usage2["prompt_tokens"],
            "completion_tokens": usage1["completion_tokens"] + usage2["completion_tokens"],
            "total_tokens": usage1["total_tokens"] + usage2["total_tokens"],
            "cache_hit_tokens": usage1.get("prompt_cache_hit_tokens", 0) + usage2.get("prompt_cache_hit_tokens", 0),
            "cached": False,
        }
        
        return synthesis, easy_explanation, total_usage
    
    def _build_synthesis_prompt(self, saju_info: dict, context: str) -> str:
        pillars = saju_info.get("pillars", {})
        day_master = saju_info.get("day_master", {})
        
        return f"""아래 사주 정보와 고전 문헌을 바탕으로 종합 해석을 작성하세요.

## 사주 정보
- 일간: {day_master.get('gan', '')}({day_master.get('element', '')})
- 년주: {pillars.get('year', {}).get('gan', '')}{pillars.get('year', {}).get('zhi', '')}
- 월주: {pillars.get('month', {}).get('gan', '')}{pillars.get('month', {}).get('zhi', '')}
- 일주: {pillars.get('day', {}).get('gan', '')}{pillars.get('day', {}).get('zhi', '')}
- 시주: {pillars.get('hour', {}).get('gan', '')}{pillars.get('hour', {}).get('zhi', '')}

## 고전 문헌 참조
{context}

## 작성 요청
다음 항목을 포함하여 작성하세요:
1. 일간 특성과 성격 (2~3줄)
2. 격국 분석과 의미 (2~3줄)
3. 용신과 희신 판단 (2~3줄)
4. 종합적인 인생 조언 (2~3줄)

총 10~12줄로 작성하고, 한자는 사용하지 마세요."""

    def _build_easy_prompt(self, saju_info: dict) -> str:
        pillars = saju_info.get("pillars", {})
        day_master = saju_info.get("day_master", {})
        
        return f"""위 사주를 초보자도 이해할 수 있도록 쉽게 설명해주세요.

## 사주 정보
- 일간: {day_master.get('gan', '')}({day_master.get('element', '')})
- 일주: {pillars.get('day', {}).get('gan', '')}{pillars.get('day', {}).get('zhi', '')}

## 작성 요청
- 비유와 예시를 사용해서 설명
- 친근한 어투 사용 (~이에요, ~거예요, ~네요)
- 전문 용어는 쉬운 말로 풀어서
- 긍정적이고 희망적인 톤
- 5~7줄로 작성
- 한자는 사용하지 마세요"""
```

### 3.3 환경 변수 설정

```bash
# .env.production

# DeepSeek API
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MAX_TOKENS=1200
DEEPSEEK_TEMPERATURE=0.4
DEEPSEEK_TIMEOUT=60

# Redis (캐싱)
REDIS_URL=redis://default:password@your-redis-host:6379

# 환경
ENVIRONMENT=production
DEBUG=false
```

---

## 4. 모니터링 및 비용 관리

### 4.1 사용량 대시보드

```
https://platform.deepseek.com/usage
```

확인 가능 정보:
- 일별/월별 토큰 사용량
- 비용 현황
- API 호출 횟수
- 캐시 히트율

### 4.2 비용 모니터링 구현

```python
# services/usage_monitor.py

from prometheus_client import Counter, Gauge
import logging

logger = logging.getLogger(__name__)

# Prometheus 메트릭
deepseek_tokens_total = Counter(
    'deepseek_tokens_total',
    'Total DeepSeek tokens used',
    ['type']  # prompt, completion
)

deepseek_cache_hits = Counter(
    'deepseek_cache_hits_total',
    'DeepSeek prompt cache hits'
)

deepseek_cost_dollars = Counter(
    'deepseek_cost_dollars',
    'DeepSeek API cost in dollars'
)

deepseek_api_calls = Counter(
    'deepseek_api_calls_total',
    'Total DeepSeek API calls',
    ['status']  # success, error
)


def track_usage(usage: dict):
    """API 사용량 추적"""
    
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    cache_hit_tokens = usage.get("cache_hit_tokens", 0)
    
    # 토큰 카운트
    deepseek_tokens_total.labels(type='prompt').inc(prompt_tokens)
    deepseek_tokens_total.labels(type='completion').inc(completion_tokens)
    
    # 캐시 히트
    if cache_hit_tokens > 0:
        deepseek_cache_hits.inc(cache_hit_tokens)
    
    # 비용 계산
    cache_miss_tokens = prompt_tokens - cache_hit_tokens
    input_cost = (cache_hit_tokens * 0.028 + cache_miss_tokens * 0.28) / 1_000_000
    output_cost = completion_tokens * 0.42 / 1_000_000
    total_cost = input_cost + output_cost
    
    deepseek_cost_dollars.inc(total_cost)
    
    # 로깅
    logger.info(f"DeepSeek API usage: {prompt_tokens} prompt, {completion_tokens} completion, ${total_cost:.6f}")


def track_api_call(success: bool):
    """API 호출 추적"""
    status = "success" if success else "error"
    deepseek_api_calls.labels(status=status).inc()
```

### 4.3 알림 설정

```python
# services/alert_service.py

import httpx
from config.settings import settings

async def send_cost_alert(current_cost: float, threshold: float):
    """비용 임계값 초과 시 알림"""
    
    if current_cost < threshold:
        return
    
    # Slack 알림
    if settings.slack_webhook_url:
        await httpx.AsyncClient().post(
            settings.slack_webhook_url,
            json={
                "text": f"⚠️ DeepSeek 비용 알림\n"
                       f"현재 비용: ${current_cost:.2f}\n"
                       f"임계값: ${threshold:.2f}"
            }
        )


# 일일 비용 한도 체크
async def check_daily_limit(daily_cost: float, limit: float = 50.0):
    """일일 비용 한도 체크"""
    
    if daily_cost >= limit:
        # API 호출 제한 활성화
        raise CostLimitExceeded(f"Daily cost limit exceeded: ${daily_cost:.2f}")
```

---

## 5. 프로덕션 체크리스트

### 5.1 보안

- [ ] API 키를 환경 변수 또는 Secret Manager에 저장
- [ ] 코드에 API 키 하드코딩 금지
- [ ] API 키 주기적 순환 (90일)
- [ ] 불필요한 API 키 비활성화

### 5.2 안정성

- [ ] 재시도 로직 구현 (exponential backoff)
- [ ] 타임아웃 설정 (60초 권장)
- [ ] 에러 핸들링 및 로깅
- [ ] Fallback 전략 (선택)

### 5.3 비용 최적화

- [ ] Redis 캐싱 구현 (동일 사주 재사용)
- [ ] DeepSeek 자동 캐싱 활용 (프롬프트 prefix)
- [ ] 토큰 사용량 모니터링
- [ ] 일일/월간 비용 알림 설정

### 5.4 성능

- [ ] 비동기 API 호출
- [ ] 커넥션 풀링
- [ ] 병렬 요청 처리
- [ ] 응답 시간 모니터링

---

## 6. 문제 해결

### 6.1 일반적인 오류

| 오류 코드 | 원인 | 해결 방법 |
|-----------|------|-----------|
| 401 | API 키 오류 | 키 확인, 재발급 |
| 402 | 잔액 부족 | 크레딧 충전 |
| 429 | Rate Limit | 요청 간격 조절, 재시도 |
| 500 | 서버 오류 | 재시도, 지원 문의 |
| 503 | 서비스 불가 | 잠시 후 재시도 |

### 6.2 Rate Limit 대응

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    retry=retry_if_exception_type(httpx.HTTPStatusError)
)
async def call_with_retry(client, url, **kwargs):
    response = await client.post(url, **kwargs)
    if response.status_code == 429:
        raise httpx.HTTPStatusError("Rate limited", request=response.request, response=response)
    response.raise_for_status()
    return response
```

### 6.3 지원 채널

- **공식 문서**: https://api-docs.deepseek.com
- **Discord**: https://discord.gg/deepseek
- **이메일**: support@deepseek.com

---

## 7. 요약

### 빠른 시작 (5분)

1. https://platform.deepseek.com 가입
2. API 키 생성
3. $10 충전 (테스트용)
4. 환경 변수 설정
5. API 호출 테스트

### 프로덕션 설정 (1시간)

1. $200 충전 (1개월 운영)
2. 자동 충전 설정 ($20 이하 시 $100 충전)
3. Redis 캐싱 구현
4. 모니터링 대시보드 설정
5. 비용 알림 설정

### 예상 월간 비용

| 항목 | 비용 |
|------|------|
| DeepSeek API (캐싱 적용) | $20~40 |
| Redis (Upstash) | $10 |
| **합계** | **$30~50** |
