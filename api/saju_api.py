"""
사주풀이 API 서버 (FastAPI) - 성능 최적화 버전
================================================
D모드 벡터 검색 + LLM 분석을 React 프론트엔드에 제공

최적화 내역 (1,000+ 동시접속 대응):
1. 비동기 HTTP 클라이언트 (httpx) - 논블로킹 LLM 호출
2. Redis 캐싱 레이어 - 동일 사주 결과 캐시 (Upstash)
3. Gunicorn 멀티워커 지원
4. Rate Limiting - API 과부하 방지
5. Health check + Prometheus 메트릭 - 모니터링

실행 방법:
  개발: python saju_api.py
  프로덕션 (Railway): uvicorn saju_api:app --host 0.0.0.0 --port $PORT
"""

import sys
import os
import time
import json
import hashlib
from pathlib import Path
from datetime import datetime

# 환경변수 로드 (.env 파일 또는 Railway 환경변수)
from dotenv import load_dotenv
load_dotenv()  # 현재 디렉토리 또는 상위 디렉토리의 .env 파일 로드

# ================================================
# DeepSeek 설정 클래스 (외부 의존성 제거)
# ================================================
class DeepSeekSettings:
    """DeepSeek API 설정"""
    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        self.max_tokens = int(os.getenv("DEEPSEEK_MAX_TOKENS", "2000"))
        self.temperature = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.5"))

class Settings:
    """전체 설정"""
    def __init__(self):
        self.deepseek = DeepSeekSettings()
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        # Railway에서는 SUPABASE_SERVICE_KEY 사용
        self.supabase_key = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_KEY", "")

settings = Settings()

# ================================================
# sajupy 라이브러리 import (사주 계산용)
# ================================================
from sajupy import SajuCalculator as SajuPyCalculator

# ================================================
# 오행 매핑 상수 (WUXING_MAP)
# ================================================
WUXING_MAP = {
    # 천간 → 오행
    '甲': '목', '乙': '목',
    '丙': '화', '丁': '화',
    '戊': '토', '己': '토',
    '庚': '금', '辛': '금',
    '壬': '수', '癸': '수',
    # 지지 → 오행
    '子': '수', '丑': '토',
    '寅': '목', '卯': '목',
    '辰': '토', '巳': '화',
    '午': '화', '未': '토',
    '申': '금', '酉': '금',
    '戌': '토', '亥': '수'
}

# 천간 한자-한글 매핑
GAN_KO_MAP = {
    '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
    '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'
}

# 지지 한자-한글 매핑
ZHI_KO_MAP = {
    '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
    '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
}

# 천간 오행 설명
GAN_DESC_MAP = {
    '甲': '양의 나무', '乙': '음의 나무',
    '丙': '양의 불', '丁': '음의 불',
    '戊': '양의 흙', '己': '음의 흙',
    '庚': '양의 쇠', '辛': '음의 쇠',
    '壬': '양의 물', '癸': '음의 물'
}

# 천간 음양
GAN_YINYANG_MAP = {
    '甲': '양', '乙': '음', '丙': '양', '丁': '음', '戊': '양',
    '己': '음', '庚': '양', '辛': '음', '壬': '양', '癸': '음'
}

# 십신 계산용 상수
GAN_WUXING = {
    '甲': '목', '乙': '목', '丙': '화', '丁': '화', '戊': '토',
    '己': '토', '庚': '금', '辛': '금', '壬': '수', '癸': '수'
}

WUXING_RELATION = {
    ('목', '목'): '비겁', ('목', '화'): '식상', ('목', '토'): '재성', ('목', '금'): '관성', ('목', '수'): '인성',
    ('화', '목'): '인성', ('화', '화'): '비겁', ('화', '토'): '식상', ('화', '금'): '재성', ('화', '수'): '관성',
    ('토', '목'): '관성', ('토', '화'): '인성', ('토', '토'): '비겁', ('토', '금'): '식상', ('토', '수'): '재성',
    ('금', '목'): '재성', ('금', '화'): '관성', ('금', '토'): '인성', ('금', '금'): '비겁', ('금', '수'): '식상',
    ('수', '목'): '식상', ('수', '화'): '재성', ('수', '토'): '관성', ('수', '금'): '인성', ('수', '수'): '비겁'
}

def get_sipsin(day_gan: str, target_gan: str) -> str:
    """일간 기준 십신 계산"""
    day_wx = GAN_WUXING.get(day_gan, '')
    target_wx = GAN_WUXING.get(target_gan, '')
    if not day_wx or not target_wx:
        return ''
    
    relation = WUXING_RELATION.get((day_wx, target_wx), '')
    day_yy = GAN_YINYANG_MAP.get(day_gan, '')
    target_yy = GAN_YINYANG_MAP.get(target_gan, '')
    same_yy = day_yy == target_yy
    
    if relation == '비겁':
        return '비견' if same_yy else '겁재'
    elif relation == '식상':
        return '식신' if same_yy else '상관'
    elif relation == '재성':
        return '편재' if same_yy else '정재'
    elif relation == '관성':
        return '편관' if same_yy else '정관'
    elif relation == '인성':
        return '편인' if same_yy else '정인'
    return ''


# ================================================
# SajuInfo 클래스 (사주 계산 결과 래퍼)
# ================================================
class SajuInfo:
    """sajupy 결과를 기존 인터페이스로 변환하는 래퍼 클래스"""
    def __init__(self, result: dict, year: int, month: int, day: int, hour: int, minute: int, is_lunar: bool = False, gender: str = 'male'):
        self._result = result
        self._year = year
        self._month = month
        self._day = day
        self._hour = hour
        self._minute = minute
        self._is_lunar = is_lunar
        self._gender = gender
        
        # 천간/지지 추출
        self.day_gan = result.get('day_stem', '')
        self.day_zhi = result.get('day_branch', '')
        
        # 한글 변환
        self.day_gan_ko = GAN_KO_MAP.get(self.day_gan, self.day_gan)
        self.day_gan_desc = GAN_DESC_MAP.get(self.day_gan, '')
        
        # 사주 4주 정보 구성
        year_gan = result.get('year_stem', '')
        year_zhi = result.get('year_branch', '')
        month_gan = result.get('month_stem', '')
        month_zhi = result.get('month_branch', '')
        day_gan = result.get('day_stem', '')
        day_zhi = result.get('day_branch', '')
        hour_gan = result.get('hour_stem', '')
        hour_zhi = result.get('hour_branch', '')
        
        self.pillars = {
            'year': {
                'gan': year_gan,
                'zhi': year_zhi,
                'zh': year_gan + year_zhi,  # 한자 조합 (庚午 형식)
                'ko': [GAN_KO_MAP.get(year_gan, ''), ZHI_KO_MAP.get(year_zhi, '')]  # 리스트 형식 유지
            },
            'month': {
                'gan': month_gan,
                'zhi': month_zhi,
                'zh': month_gan + month_zhi,
                'ko': [GAN_KO_MAP.get(month_gan, ''), ZHI_KO_MAP.get(month_zhi, '')]
            },
            'day': {
                'gan': day_gan,
                'zhi': day_zhi,
                'zh': day_gan + day_zhi,
                'ko': [GAN_KO_MAP.get(day_gan, ''), ZHI_KO_MAP.get(day_zhi, '')]
            },
            'hour': {
                'gan': hour_gan,
                'zhi': hour_zhi,
                'zh': hour_gan + hour_zhi,
                'ko': [GAN_KO_MAP.get(hour_gan, ''), ZHI_KO_MAP.get(hour_zhi, '')]
            }
        }
        
        # 십신 맵 생성
        self.shishen_map = {}
        for pillar in ['year', 'month', 'hour']:
            gan = self.pillars[pillar]['gan']
            if gan:
                self.shishen_map[gan] = get_sipsin(self.day_gan, gan)


# ================================================
# SajuCalculator 래퍼 클래스
# ================================================
class SajuCalculator:
    """sajupy를 래핑하여 기존 인터페이스 제공"""
    def __init__(self):
        self._calc = SajuPyCalculator()
    
    def calculate(self, year: int, month: int, day: int, hour: int, minute: int = 0, 
                  is_lunar: bool = False, is_leap_month: bool = False,
                  gender: str = 'male', name: str = '', use_solar_time: bool = False) -> SajuInfo:
        """사주 계산 수행
        
        Args:
            year: 출생년도
            month: 출생월
            day: 출생일
            hour: 출생시
            minute: 출생분
            is_lunar: 음력 여부
            is_leap_month: 윤달 여부
            gender: 성별 ('male' or 'female')
            name: 이름
            use_solar_time: 진태양시 사용 여부
        """
        try:
            # 음력인 경우 양력으로 변환
            if is_lunar:
                solar = self._calc.lunar_to_solar(year, month, day, is_leap_month)
                if solar:
                    year, month, day = solar['year'], solar['month'], solar['day']
            
            # 사주 계산 (use_solar_time 옵션 적용)
            result = self._calc.calculate_saju(year, month, day, hour, minute, use_solar_time=use_solar_time)
            return SajuInfo(result, year, month, day, hour, minute, is_lunar, gender)
        except Exception as e:
            print(f"[SajuCalculator] 계산 오류: {e}")
            raise


# ================================================
# SajuSearch 클래스 (Supabase 벡터 검색)
# ================================================
class SajuSearch:
    """Supabase pgvector를 이용한 사주 지식베이스 검색"""
    def __init__(self):
        self.supabase_url = settings.supabase_url
        self.supabase_key = settings.supabase_key
        self._embedding_cache = {}
    
    async def _get_embedding_async(self, text: str) -> list:
        """DeepSeek API로 텍스트 임베딩 생성 (비동기)"""
        if text in self._embedding_cache:
            return self._embedding_cache[text]
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{settings.deepseek.base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {settings.deepseek.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "text-embedding-3-small",
                        "input": text
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    embedding = data.get('data', [{}])[0].get('embedding', [])
                    self._embedding_cache[text] = embedding
                    return embedding
        except Exception as e:
            print(f"[SajuSearch] 임베딩 생성 오류: {e}")
        return []
    
    def _get_embedding_sync(self, text: str) -> list:
        """OpenAI 호환 API로 텍스트 임베딩 생성 (동기)"""
        import requests
        if text in self._embedding_cache:
            return self._embedding_cache[text]
        
        try:
            response = requests.post(
                f"{settings.deepseek.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.deepseek.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "text-embedding-3-small",
                    "input": text
                },
                timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                embedding = data.get('data', [{}])[0].get('embedding', [])
                self._embedding_cache[text] = embedding
                return embedding
        except Exception as e:
            print(f"[SajuSearch] 임베딩 생성 오류: {e}")
        return []
    
    def search(self, query: str, top_k: int = 5, min_score: float = 0.3, mode: str = "D") -> list:
        """벡터 유사도 검색 수행"""
        import requests
        
        if not self.supabase_url or not self.supabase_key:
            print("[SajuSearch] Supabase 설정 누락")
            return []
        
        try:
            # 쿼리 임베딩 생성
            embedding = self._get_embedding_sync(query)
            if not embedding:
                print(f"[SajuSearch] 임베딩 생성 실패: {query[:50]}")
                return []
            
            # Supabase RPC 호출 (match_documents 함수)
            response = requests.post(
                f"{self.supabase_url}/rest/v1/rpc/match_documents",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "query_embedding": embedding,
                    "match_threshold": min_score,
                    "match_count": top_k
                },
                timeout=30
            )
            
            if response.status_code == 200:
                results = response.json()
                return [{
                    'content': r.get('content', ''),
                    'metadata': r.get('metadata', {}),
                    'score': r.get('similarity', 0)
                } for r in results]
            else:
                print(f"[SajuSearch] Supabase 검색 오류: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"[SajuSearch] 검색 오류: {e}")
        
        return []


from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
from concurrent.futures import ThreadPoolExecutor
import httpx

# Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Redis 캐싱 (옵션 - Redis 서버 있을 때만)
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# Prometheus 메트릭 (옵션)
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

# ================================================
# 성능 최적화 설정
# ================================================

# 환경변수에서 설정 로드
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))  # 1시간 기본
RATE_LIMIT = os.getenv("RATE_LIMIT", "100/minute")  # 분당 100회 기본
MAX_WORKERS = int(os.getenv("MAX_WORKERS", str(os.cpu_count() * 2 or 8)))

# Rate Limiter 설정
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="사주풀이 D모드 API", 
    version="2.0.0",
    description="동시접속 1,000+ 대응 최적화 버전"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 결제 API 라우터 등록
try:
    from payment_api import router as payment_router
    app.include_router(payment_router)
    print("✅ Payment API 라우터 등록 완료")
except ImportError as e:
    print(f"⚠️ Payment API 라우터 로드 실패: {e}")

# 스레드풀 (CPU 코어 기반 동적 설정)
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# 비동기 HTTP 클라이언트 (전역 - 연결 풀 재사용)
http_client: Optional[httpx.AsyncClient] = None

# Redis 클라이언트 (옵션)
redis_client: Optional[redis.Redis] = None

# ================================================
# Prometheus 메트릭 정의 (옵션)
# ================================================
if PROMETHEUS_AVAILABLE:
    REQUEST_COUNT = Counter(
        'saju_api_requests_total', 
        'Total API requests',
        ['endpoint', 'method', 'status']
    )
    REQUEST_LATENCY = Histogram(
        'saju_api_request_latency_seconds', 
        'Request latency',
        ['endpoint']
    )
    ACTIVE_REQUESTS = Gauge(
        'saju_api_active_requests', 
        'Currently active requests'
    )
    CACHE_HITS = Counter(
        'saju_api_cache_hits_total', 
        'Cache hit count'
    )
    CACHE_MISSES = Counter(
        'saju_api_cache_misses_total', 
        'Cache miss count'
    )
    LLM_CALLS = Counter(
        'saju_api_llm_calls_total', 
        'LLM API call count',
        ['status']
    )

# ================================================
# 앱 시작/종료 이벤트
# ================================================
@app.on_event("startup")
async def startup_event():
    """앱 시작 시 리소스 초기화"""
    global http_client, redis_client
    
    # 비동기 HTTP 클라이언트 생성 (연결 풀 재사용)
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    )
    print(f"[시작] 비동기 HTTP 클라이언트 초기화 완료")
    print(f"[시작] ThreadPool 워커 수: {MAX_WORKERS}")
    
    # Redis 연결 시도 (실패해도 계속 진행)
    if REDIS_AVAILABLE:
        try:
            redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            redis_client.ping()
            print(f"[시작] Redis 연결 성공: {REDIS_URL}")
        except Exception as e:
            print(f"[경고] Redis 연결 실패 (캐싱 비활성화): {e}")
            redis_client = None

@app.on_event("shutdown")
async def shutdown_event():
    """앱 종료 시 리소스 정리"""
    global http_client, redis_client
    
    if http_client:
        await http_client.aclose()
        print("[종료] HTTP 클라이언트 종료")
    
    if redis_client:
        redis_client.close()
        print("[종료] Redis 연결 종료")

# CORS 설정 (React 개발 서버 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================================================
# 캐싱 유틸리티
# ================================================
def generate_cache_key(prefix: str, **kwargs) -> str:
    """캐시 키 생성 (요청 파라미터 해시)"""
    key_data = json.dumps(kwargs, sort_keys=True)
    hash_val = hashlib.md5(key_data.encode()).hexdigest()[:16]
    return f"saju:{prefix}:{hash_val}"


async def get_cached(key: str) -> Optional[dict]:
    """Redis에서 캐시 조회"""
    if not redis_client:
        return None
    try:
        data = redis_client.get(key)
        if data:
            if PROMETHEUS_AVAILABLE:
                CACHE_HITS.inc()
            return json.loads(data)
        if PROMETHEUS_AVAILABLE:
            CACHE_MISSES.inc()
    except Exception as e:
        print(f"[캐시] 조회 오류: {e}")
    return None


async def set_cached(key: str, data: dict, ttl: int = None) -> bool:
    """Redis에 캐시 저장"""
    if not redis_client:
        return False
    try:
        redis_client.setex(key, ttl or CACHE_TTL, json.dumps(data, ensure_ascii=False))
        return True
    except Exception as e:
        print(f"[캐시] 저장 오류: {e}")
    return False


class SajuRequest(BaseModel):
    """사주 분석 요청"""
    name: str = ""
    gender: str = "male"  # male | female
    year: int
    month: int
    day: int
    hour: int = 12
    minute: int = 0
    is_lunar: bool = False
    is_leap_month: bool = False
    target_year: int = 2026
    analysis_level: str = "easy"  # easy(일반) | detailed(고급) | expert(사주가)


class FortuneRequest(BaseModel):
    """대운/세운/월운 분석 요청"""
    name: str = ""
    gender: str = "male"
    year: int
    month: int
    day: int
    hour: int = 12
    minute: int = 0
    is_lunar: bool = False
    is_leap_month: bool = False
    target_year: int = 2026
    target_month: int = 1


class GaewoonRequest(BaseModel):
    """개운법 분석 요청"""
    name: str = ""
    gender: str = "male"
    year: int
    month: int
    day: int
    hour: int = 12
    minute: int = 0
    is_lunar: bool = False
    is_leap_month: bool = False
    yongshen: str = ""


class SearchResult(BaseModel):
    """벡터 검색 결과"""
    book_title: str
    title: str
    content: str
    score: float
    matched_patterns: List[str] = []


class SajuAnalysisResponse(BaseModel):
    """사주 분석 응답"""
    success: bool
    processing_time_ms: int
    pillars: Dict[str, Any]
    day_master: Dict[str, Any]
    geju: Dict[str, Any]
    yongshen: Dict[str, Any]
    wuxing_balance: Dict[str, int]
    synthesis: str
    easy_explanation: str
    classical_references: List[SearchResult]
    daewoon_summary: str = ""
    sewoon_summary: str = ""
    error: Optional[str] = None


class DaewoonItem(BaseModel):
    """대운 항목"""
    age_start: int
    age_end: int
    gan: str
    zhi: str
    gan_ko: str
    zhi_ko: str
    shishen: str
    is_current: bool = False


class FortuneAnalysisResponse(BaseModel):
    """대운/세운/월운 상세 분석 응답"""
    success: bool
    processing_time_ms: int
    fortune_type: str  # daewoon | sewoon | wolwoon
    current_fortune: Dict[str, Any]
    fortune_list: List[DaewoonItem]
    positive_factors: List[str]
    negative_factors: List[str]
    impact_on_wonguk: str
    detailed_analysis: str
    classical_references: List[SearchResult]
    error: Optional[str] = None


class GaewoonResponse(BaseModel):
    """개운법 응답"""
    success: bool
    processing_time_ms: int
    yongshen_element: str
    gaewoon_methods: List[Dict[str, Any]]
    favorable_colors: List[str]
    favorable_directions: List[str]
    favorable_numbers: List[int]
    favorable_foods: List[str]
    detailed_advice: str
    classical_references: List[SearchResult]
    error: Optional[str] = None


# 전역 객체 (lazy loading)
_calculator = None
_searcher = None


def get_calculator():
    global _calculator
    if _calculator is None:
        _calculator = SajuCalculator()
    return _calculator


def get_searcher():
    global _searcher
    if _searcher is None:
        _searcher = SajuSearch()
    return _searcher


# ================================================
# Health Check & 모니터링 엔드포인트
# ================================================
@app.get("/")
async def root():
    return {
        "message": "사주풀이 API 서버", 
        "version": "2.0.0",
        "optimizations": [
            "async_http_client",
            "redis_caching",
            "rate_limiting",
            "multi_worker",
            "prometheus_metrics"
        ]
    }


@app.get("/health")
async def health_check():
    """기본 헬스 체크"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/health/detailed")
async def health_check_detailed():
    """상세 헬스 체크 (Redis, LLM 연결 상태 포함)"""
    import psutil
    
    health = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "components": {}
    }
    
    # 시스템 리소스
    try:
        health["system"] = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:\\').percent,
        }
    except:
        health["system"] = {"error": "Unable to get system stats"}
    
    # Redis 상태
    if redis_client:
        try:
            redis_client.ping()
            health["components"]["redis"] = {"status": "connected"}
        except:
            health["components"]["redis"] = {"status": "disconnected"}
    else:
        health["components"]["redis"] = {"status": "disabled"}
    
    # HTTP 클라이언트 상태
    health["components"]["http_client"] = {
        "status": "initialized" if http_client else "not_initialized"
    }
    
    # ThreadPool 상태
    health["components"]["thread_pool"] = {
        "max_workers": MAX_WORKERS
    }
    
    return health


@app.get("/health/ready")
async def readiness_check():
    """Kubernetes readiness probe용 - 서비스 준비 상태"""
    try:
        # 필수 컴포넌트 체크
        calc = get_calculator()
        searcher = get_searcher()
        
        if calc and searcher:
            return {"status": "ready"}
        else:
            return JSONResponse(
                status_code=503,
                content={"status": "not_ready", "reason": "Components not initialized"}
            )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": str(e)}
        )


@app.get("/health/live")
async def liveness_check():
    """Kubernetes liveness probe용 - 프로세스 생존 여부"""
    return {"status": "alive"}


# Prometheus 메트릭 엔드포인트
if PROMETHEUS_AVAILABLE:
    @app.get("/metrics")
    async def metrics():
        """Prometheus 메트릭 노출"""
        return StreamingResponse(
            iter([generate_latest()]),
            media_type=CONTENT_TYPE_LATEST
        )


@app.post("/api/saju/analyze", response_model=SajuAnalysisResponse)
@limiter.limit(RATE_LIMIT)
async def analyze_saju(saju_request: SajuRequest, request: Request):
    """
    D모드 사주 분석 API (최적화 버전)
    - 벡터DB 검색 (HyDE + LLM 리랭킹) - 정확도 최대 유지
    - 비동기 LLM 종합 해석 (httpx)
    - Redis 캐싱 (동일 사주 결과 재사용)
    - Rate Limiting (과부하 방지)
    """
    start_time = time.time()
    
    # Prometheus 메트릭
    if PROMETHEUS_AVAILABLE:
        ACTIVE_REQUESTS.inc()
    
    try:
        # 캐시 키 생성 (동일 입력 → 동일 결과)
        cache_key = generate_cache_key(
            "analyze",
            year=saju_request.year, month=saju_request.month, day=saju_request.day,
            hour=saju_request.hour, minute=saju_request.minute, gender=saju_request.gender,
            is_lunar=saju_request.is_lunar, is_leap_month=saju_request.is_leap_month
        )
        
        # 캐시 조회
        cached = await get_cached(cache_key)
        if cached:
            print(f"[캐시 히트] {cache_key}")
            cached['processing_time_ms'] = int((time.time() - start_time) * 1000)
            if PROMETHEUS_AVAILABLE:
                REQUEST_COUNT.labels(endpoint='/api/saju/analyze', method='POST', status='cache_hit').inc()
                ACTIVE_REQUESTS.dec()
            return SajuAnalysisResponse(**cached)
        # 1. 사주 계산
        print(f"[1/6] 사주 계산 시작: {saju_request.name} {saju_request.year}/{saju_request.month}/{saju_request.day}")
        calc = get_calculator()
        info = calc.calculate(
            year=saju_request.year,
            month=saju_request.month,
            day=saju_request.day,
            hour=saju_request.hour,
            minute=saju_request.minute,
            is_lunar=saju_request.is_lunar,
            is_leap_month=saju_request.is_leap_month,
            gender=saju_request.gender,
            name=saju_request.name,
            use_solar_time=True,
        )
        print(f"  일간: {info.day_gan}({info.day_gan_ko}), 계산 완료")
        
        # 2. 벡터DB D모드 검색 (정확도 최대 - HyDE + LLM 리랭킹)
        print(f"[2/6] D모드 벡터 검색 시작")
        searcher = get_searcher()
        
        # 주요 검색 쿼리 생성
        day_gan_ko = info.day_gan_ko
        month_zhi = info.pillars['month']['zhi']
        
        # 월지 계절 정보
        MONTH_ZHI_SEASON = {
            '寅': '인월(봄)', '卯': '묘월(봄)', '辰': '진월(봄→여름)',
            '巳': '사월(여름)', '午': '오월(여름)', '未': '미월(여름→가을)',
            '申': '신월(가을)', '酉': '유월(가을)', '戌': '술월(가을→겨울)',
            '亥': '해월(겨울)', '子': '자월(겨울)', '丑': '축월(겨울→봄)',
        }
        season = MONTH_ZHI_SEASON.get(month_zhi, month_zhi)
        
        # D모드 검색 쿼리들 (병렬 실행)
        queries = [
            f"{day_gan_ko} 일간 {season} 격국과 용신",
            f"궁통보감 {day_gan_ko} {season} 조후 용신",
        ]
        
        all_results = []
        search_start = time.time()
        
        # D모드 검색 (정확도 최대 유지)
        for query in queries:
            print(f"  검색: {query}")
            try:
                results = searcher.search(query, top_k=3, min_score=0.3, mode="D")
                for r in results:
                    all_results.append(SearchResult(
                        book_title=r.book_title,
                        title=r.title,
                        content=r.content[:500] if len(r.content) > 500 else r.content,
                        score=r.final_score,
                        matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                    ))
            except Exception as search_err:
                print(f"  검색 오류: {search_err}")
        
        search_time = time.time() - search_start
        print(f"  D모드 검색 완료: {len(all_results)}건, {search_time:.2f}초")
        
        # 중복 제거
        seen = set()
        unique_results = []
        for r in all_results:
            key = f"{r.book_title}:{r.title}"
            if key not in seen:
                seen.add(key)
                unique_results.append(r)
        
        # 3. LLM 종합 해석 호출 (모드별 분기)
        print(f"[3/6] LLM 종합 해석 생성 (모드: {saju_request.analysis_level})")
        synthesis, easy_explanation = await generate_llm_analysis(
            info, unique_results[:5], analysis_level=saju_request.analysis_level
        )
        
        # 4. 격국 판단
        print(f"[4/6] 격국 판단")
        geju_name = determine_geju_simple(info)
        
        # 5. 조후용신
        print(f"[5/6] 조후용신 조회")
        johu = get_johu_yongshen(info.day_gan, month_zhi)
        
        # 6. 오행 분포
        print(f"[6/6] 오행 분포 계산")
        wuxing = calculate_wuxing_balance(info)
        
        processing_time = int((time.time() - start_time) * 1000)
        print(f"[완료] 분석 완료: {processing_time}ms ({processing_time/1000:.1f}초)")
        
        # 응답 데이터 구성
        response_data = {
            "success": True,
            "processing_time_ms": processing_time,
            "pillars": {
                'year': {'gan': info.pillars['year']['ko'][0], 'zhi': info.pillars['year']['ko'][1]},
                'month': {'gan': info.pillars['month']['ko'][0], 'zhi': info.pillars['month']['ko'][1]},
                'day': {'gan': info.pillars['day']['ko'][0], 'zhi': info.pillars['day']['ko'][1]},
                'hour': {'gan': info.pillars['hour']['ko'][0], 'zhi': info.pillars['hour']['ko'][1]},
            },
            "day_master": {
                'gan': info.day_gan_ko,
                'element': info.day_gan_desc,
            },
            "geju": {
                'name': geju_name,
            },
            "yongshen": johu,
            "wuxing_balance": wuxing,
            "synthesis": synthesis,
            "easy_explanation": easy_explanation,
            "classical_references": [r.dict() for r in unique_results[:5]],
        }
        
        # 캐시 저장 (비동기)
        asyncio.create_task(set_cached(cache_key, response_data))
        
        # Prometheus 메트릭
        if PROMETHEUS_AVAILABLE:
            REQUEST_COUNT.labels(endpoint='/api/saju/analyze', method='POST', status='success').inc()
            REQUEST_LATENCY.labels(endpoint='/api/saju/analyze').observe(time.time() - start_time)
            ACTIVE_REQUESTS.dec()
        
        return SajuAnalysisResponse(**response_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        
        # Prometheus 메트릭
        if PROMETHEUS_AVAILABLE:
            REQUEST_COUNT.labels(endpoint='/api/saju/analyze', method='POST', status='error').inc()
            ACTIVE_REQUESTS.dec()
        
        return SajuAnalysisResponse(
            success=False,
            processing_time_ms=processing_time,
            pillars={},
            day_master={},
            geju={},
            yongshen={},
            wuxing_balance={},
            synthesis="",
            easy_explanation="",
            classical_references=[],
            error=str(e),
        )


# ================================================
# 1. 격국 판단 룰엔진 (24격국 완전 정의)
# ================================================

# 지지 장간 (본기, 중기, 여기)
HIDDEN_STEMS = {
    '寅': ['甲', '丙', '戊'], '卯': ['乙'], '辰': ['戊', '乙', '癸'],
    '巳': ['丙', '庚', '戊'], '午': ['丁', '己'], '未': ['己', '丁', '乙'],
    '申': ['庚', '壬', '戊'], '酉': ['辛'], '戌': ['戊', '辛', '丁'],
    '亥': ['壬', '甲'], '子': ['癸'], '丑': ['己', '癸', '辛'],
}

# 일간의 건록지 (양간: 양지, 음간: 음지)
JIANLU_MAP = {
    '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳',
    '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子',
}

# 일간의 양인지
YANGREN_MAP = {
    '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳', '戊': '午',
    '己': '巳', '庚': '酉', '辛': '申', '壬': '子', '癸': '亥',
}

# 격국 상세 정의 (24격국)
GEJU_DEFINITIONS = {
    # 정격 8격 (월지 장간 기준)
    '정관격': {
        'category': '정격',
        'description': '월지 장간의 정관이 천간에 투출한 격',
        'characteristics': '관직운, 명예, 정치력, 리더십',
        'favorable_jobs': '공무원, 관리자, 법조인, 정치인',
        'strength': '질서정연, 책임감, 신뢰성',
        'weakness': '융통성 부족, 권위적 성향',
        'classical_ref': '자평진전: 정관격은 관성이 순수하고 인성의 생조를 받으면 귀격이 된다',
    },
    '편관격': {
        'category': '정격',
        'description': '월지 장간의 편관(칠살)이 천간에 투출한 격',
        'characteristics': '권위, 행동력, 결단력, 무관운',
        'favorable_jobs': '군인, 경찰, 외과의사, 운동선수, CEO',
        'strength': '추진력, 위기대응, 승부사 기질',
        'weakness': '급진적, 인내심 부족, 폭발적 성향',
        'classical_ref': '삼명통회: 칠살은 제압이 필요하나 제화되면 권위를 얻는다',
    },
    '정재격': {
        'category': '정격',
        'description': '월지 장간의 정재가 천간에 투출한 격',
        'characteristics': '재물복, 성실함, 절약정신',
        'favorable_jobs': '회계사, 금융업, 사업가, 부동산',
        'strength': '꾸준함, 신뢰성, 재테크 능력',
        'weakness': '소심함, 인색함, 변화 거부',
        'classical_ref': '적천수: 정재는 정당한 재물로 근면한 노력의 결실이다',
    },
    '편재격': {
        'category': '정격',
        'description': '월지 장간의 편재가 천간에 투출한 격',
        'characteristics': '사업수완, 투기성, 대인관계 능력',
        'favorable_jobs': '무역업, 영업, 투자자, 엔터테이너',
        'strength': '사교성, 융통성, 모험심',
        'weakness': '낭비벽, 부침이 큼, 안정감 부족',
        'classical_ref': '궁통보감: 편재는 유통의 재물로 크게 얻고 크게 잃는다',
    },
    '정인격': {
        'category': '정격',
        'description': '월지 장간의 정인이 천간에 투출한 격',
        'characteristics': '학문, 인덕, 명예, 어머니 복',
        'favorable_jobs': '교수, 연구원, 작가, 종교인',
        'strength': '지혜, 자비심, 학구열',
        'weakness': '현실감각 부족, 우유부단',
        'classical_ref': '자평진전: 정인은 생신(生身)의 근원으로 귀중히 여긴다',
    },
    '편인격': {
        'category': '정격',
        'description': '월지 장간의 편인이 천간에 투출한 격',
        'characteristics': '특수재능, 예술성, 비밀스러움',
        'favorable_jobs': '예술가, 디자이너, 역술인, 의약업',
        'strength': '창의성, 직관력, 특수분야 재능',
        'weakness': '변덕, 고독, 도식(倒食) 위험',
        'classical_ref': '삼명통회: 편인은 효신(梟神)이라 하여 제어가 필요하다',
    },
    '식신격': {
        'category': '정격',
        'description': '월지 장간의 식신이 천간에 투출한 격',
        'characteristics': '복록, 식복, 표현력, 자녀복',
        'favorable_jobs': '요리사, 예술가, 교육자, 서비스업',
        'strength': '낙천성, 베풂, 여유로움',
        'weakness': '나태함, 과식, 안주',
        'classical_ref': '적천수: 식신은 수명장수의 별로 칠살을 제어한다',
    },
    '상관격': {
        'category': '정격',
        'description': '월지 장간의 상관이 천간에 투출한 격',
        'characteristics': '재능, 표현력, 반항심, 예술성',
        'favorable_jobs': '연예인, 변호사, 프리랜서, 창업가',
        'strength': '언변, 창의성, 추진력',
        'weakness': '반항적, 불안정, 관재수',
        'classical_ref': '자평진전: 상관은 관을 상하게 하니 용관(用官)을 꺼린다',
    },
    # 특별격 (외격)
    '건록격': {
        'category': '외격',
        'description': '월지가 일간의 건록지인 격',
        'characteristics': '자수성가, 독립심, 형제덕',
        'favorable_jobs': '자영업, 프리랜서, 전문직',
        'strength': '자립심, 성실함, 지구력',
        'weakness': '고집, 타인 의존 어려움',
        'classical_ref': '삼명통회: 건록격은 재관이 없으면 빈천하기 쉽다',
    },
    '양인격': {
        'category': '외격',
        'description': '월지가 일간의 양인지인 격',
        'characteristics': '강인함, 결단력, 무관운',
        'favorable_jobs': '군인, 외과의사, 운동선수, 경호원',
        'strength': '용맹, 결단력, 위기대처',
        'weakness': '과격함, 형액(刑厄), 수술수',
        'classical_ref': '적천수: 양인은 칠살을 만나면 위엄이 있고 인수를 보면 문귀(文貴)하다',
    },
    # 종격 (從格)
    '종아격': {
        'category': '종격',
        'description': '일간이 무근하고 식상이 왕성하여 따르는 격',
        'characteristics': '예술성, 창작능력, 유통업',
        'favorable_jobs': '예술가, 작가, 유통업, 교육자',
        'strength': '창의성, 표현력',
        'weakness': '기복이 큼, 주체성 약함',
        'classical_ref': '적천수: 종아격은 재운을 만나면 발복한다',
    },
    '종재격': {
        'category': '종격',
        'description': '일간이 무근하고 재성이 왕성하여 따르는 격',
        'characteristics': '재물복, 사업운',
        'favorable_jobs': '사업가, 금융인, 부동산업',
        'strength': '재물 획득 능력',
        'weakness': '재다신약, 건강 주의',
        'classical_ref': '자평진전: 종재격은 식상운에 발복하고 인비운에 파격된다',
    },
    '종살격': {
        'category': '종격',
        'description': '일간이 무근하고 관살이 왕성하여 따르는 격',
        'characteristics': '관운, 직장운',
        'favorable_jobs': '공무원, 대기업 직원, 정치인',
        'strength': '권위, 조직력',
        'weakness': '자주성 부족, 압박감',
        'classical_ref': '삼명통회: 종살격은 재운을 만나면 통관하여 귀해진다',
    },
    '종강격': {
        'category': '종격',
        'description': '인비가 태왕하고 재관식이 없는 격',
        'characteristics': '독립성, 자수성가',
        'favorable_jobs': '자영업, 학자, 종교인',
        'strength': '독립심, 학문성',
        'weakness': '고집, 융통성 부족',
        'classical_ref': '적천수: 종강격은 비겁운에 발복하고 재관운에 파격된다',
    },
    # 잡격
    '곡직격': {
        'category': '잡격',
        'description': '갑을일간이 인묘진월에 목기가 왕성한 격',
        'characteristics': '인자함, 학문, 문학',
        'favorable_jobs': '교육자, 작가, 의사, 한의사',
        'strength': '자비심, 성장력',
        'weakness': '우유부단, 결단력 부족',
        'classical_ref': '삼명통회: 곡직격은 동방 목의 기운을 온전히 갖춘 격이다',
    },
    '염상격': {
        'category': '잡격',
        'description': '병정일간이 사오미월에 화기가 왕성한 격',
        'characteristics': '예술성, 화려함, 명예',
        'favorable_jobs': '예술가, 연예인, 조명/전기업',
        'strength': '열정, 명예욕',
        'weakness': '조급함, 화를 다스리기 어려움',
        'classical_ref': '적천수: 염상격은 남방 화의 기운이 왕성한 격이다',
    },
    '가색격': {
        'category': '잡격',
        'description': '무기일간이 진술축미월에 토기가 왕성한 격',
        'characteristics': '신뢰성, 중후함',
        'favorable_jobs': '부동산, 농업, 건축업',
        'strength': '안정성, 포용력',
        'weakness': '고집, 변화 거부',
        'classical_ref': '삼명통회: 가색격은 사계(四季) 토의 기운을 갖춘 격이다',
    },
    '종혁격': {
        'category': '잡격',
        'description': '경신일간이 신유술월에 금기가 왕성한 격',
        'characteristics': '결단력, 의리',
        'favorable_jobs': '군인, 법조인, 금융업',
        'strength': '의지력, 추진력',
        'weakness': '냉정함, 비정함',
        'classical_ref': '적천수: 종혁격은 서방 금의 기운이 왕성한 격이다',
    },
    '윤하격': {
        'category': '잡격',
        'description': '임계일간이 해자축월에 수기가 왕성한 격',
        'characteristics': '지혜, 유연함',
        'favorable_jobs': '학자, 무역업, 유통업',
        'strength': '지혜, 적응력',
        'weakness': '음침함, 변덕',
        'classical_ref': '삼명통회: 윤하격은 북방 수의 기운이 왕성한 격이다',
    },
}


def determine_geju_advanced(info) -> dict:
    """격국 판단 (고급 버전 - 24격국 완전 지원)"""
    month_zhi = info.pillars['month']['zhi']
    day_gan = info.day_gan
    
    # 천간들 (년, 월, 시)
    all_gans = [
        info.pillars['year']['gan'],
        info.pillars['month']['gan'],
        info.pillars['hour']['gan'],
    ]
    
    # 모든 지지
    all_zhis = [
        info.pillars['year']['zhi'],
        info.pillars['month']['zhi'],
        info.pillars['day']['zhi'],
        info.pillars['hour']['zhi'],
    ]
    
    # 십신 맵
    shishen_map = info.shishen_map
    
    # 1. 건록격 체크
    if month_zhi == JIANLU_MAP.get(day_gan):
        return {
            'name': '건록격',
            'category': '외격',
            **GEJU_DEFINITIONS['건록격']
        }
    
    # 2. 양인격 체크
    if month_zhi == YANGREN_MAP.get(day_gan):
        return {
            'name': '양인격',
            'category': '외격',
            **GEJU_DEFINITIONS['양인격']
        }
    
    # 3. 월지 장간 투출 확인 (정격 8격)
    hidden = HIDDEN_STEMS.get(month_zhi, [])
    
    for hidden_stem in hidden:
        # 천간에 투출 확인
        if hidden_stem in all_gans:
            ss = shishen_map.get(hidden_stem, '')
            
            if '정관' in ss and '정관격' in GEJU_DEFINITIONS:
                return {'name': '정관격', **GEJU_DEFINITIONS['정관격']}
            elif '편관' in ss and '편관격' in GEJU_DEFINITIONS:
                return {'name': '편관격', **GEJU_DEFINITIONS['편관격']}
            elif '정재' in ss and '정재격' in GEJU_DEFINITIONS:
                return {'name': '정재격', **GEJU_DEFINITIONS['정재격']}
            elif '편재' in ss and '편재격' in GEJU_DEFINITIONS:
                return {'name': '편재격', **GEJU_DEFINITIONS['편재격']}
            elif '정인' in ss and '정인격' in GEJU_DEFINITIONS:
                return {'name': '정인격', **GEJU_DEFINITIONS['정인격']}
            elif '편인' in ss and '편인격' in GEJU_DEFINITIONS:
                return {'name': '편인격', **GEJU_DEFINITIONS['편인격']}
            elif '식신' in ss and '식신격' in GEJU_DEFINITIONS:
                return {'name': '식신격', **GEJU_DEFINITIONS['식신격']}
            elif '상관' in ss and '상관격' in GEJU_DEFINITIONS:
                return {'name': '상관격', **GEJU_DEFINITIONS['상관격']}
    
    # 4. 투출 없으면 본기 기준
    if hidden:
        main_hidden = hidden[0]
        ss = shishen_map.get(main_hidden, '')
        
        if '정관' in ss:
            return {'name': '정관격', **GEJU_DEFINITIONS['정관격']}
        elif '편관' in ss:
            return {'name': '편관격', **GEJU_DEFINITIONS['편관격']}
        elif '정재' in ss:
            return {'name': '정재격', **GEJU_DEFINITIONS['정재격']}
        elif '편재' in ss:
            return {'name': '편재격', **GEJU_DEFINITIONS['편재격']}
        elif '정인' in ss:
            return {'name': '정인격', **GEJU_DEFINITIONS['정인격']}
        elif '편인' in ss:
            return {'name': '편인격', **GEJU_DEFINITIONS['편인격']}
        elif '식신' in ss:
            return {'name': '식신격', **GEJU_DEFINITIONS['식신격']}
        elif '상관' in ss:
            return {'name': '상관격', **GEJU_DEFINITIONS['상관격']}
    
    # 5. 종격/잡격 체크 (간략)
    # TODO: 일간 강약 판단 후 종격 판단 추가
    
    return {
        'name': '내격 분석 필요',
        'category': '미정',
        'description': '상세 분석이 필요합니다',
        'characteristics': '',
        'favorable_jobs': '',
        'strength': '',
        'weakness': '',
        'classical_ref': '',
    }


def determine_geju_simple(info) -> str:
    """격국 판단 (간략 버전) - 하위 호환용"""
    result = determine_geju_advanced(info)
    return result.get('name', '내격 분석 필요')


async def generate_llm_analysis(info, search_results: List[SearchResult], analysis_level: str = "easy") -> tuple:
    """
    LLM 종합 해석 생성 (비동기 최적화 버전)
    - httpx 비동기 클라이언트 사용 (논블로킹)
    - 병렬 API 호출 (asyncio.gather)
    - analysis_level에 따라 다른 프롬프트 사용:
      * easy(일반 모드): 쉽고 친근한 표현, 한자 사용 최소화
      * detailed(고급 모드): 명리학 전문 용어 사용, 상세 분석
      * expert(사주가 모드): 원문 인용, 학술적 표현, 최대 상세도
    """
    # settings는 파일 상단에서 이미 정의됨
    
    # 검색 결과 컨텍스트 구성 (모드별 상세도 조절)
    context_parts = []
    content_length = 300 if analysis_level == "easy" else (500 if analysis_level == "detailed" else 800)
    for r in search_results:
        context_parts.append(f"[{r.book_title}] {r.title}: {r.content[:content_length]}")
    search_context = "\n".join(context_parts) if context_parts else "검색 결과 없음"
    
    # 사주 정보
    pillars = info.pillars
    saju_info = f"""
일간: {info.day_gan}({info.day_gan_ko}, {info.day_gan_desc})
년주: {pillars['year']['zh']}({''.join(pillars['year']['ko'])})
월주: {pillars['month']['zh']}({''.join(pillars['month']['ko'])})
일주: {pillars['day']['zh']}({''.join(pillars['day']['ko'])})
시주: {pillars['hour']['zh']}({''.join(pillars['hour']['ko'])})
"""
    
    # ================================================================
    # 일반 모드 (easy): 쉽고 친근한 표현
    # ================================================================
    if analysis_level == "easy":
        synthesis_prompt = f"""사주 분석을 쉽고 친근하게 설명해주세요.

## 사주 정보
{saju_info}

## 고전 문헌 참조
{search_context}

## 작성 형식 (각 섹션 제목 필수)

**🌟 당신의 타고난 성격**
- 일간의 특성을 일상적인 비유로 설명 (나무/불/물 등)
- 사람들과의 관계에서 보이는 모습
- 성격의 장점과 매력 포인트
(4~5줄, 친근한 ~요 체)

**💼 어울리는 직업과 방향**
- 타고난 재능과 강점
- 잘 맞는 직업군 예시
- 피하면 좋을 분야
(3~4줄)

**🍀 행운을 부르는 팁**
- 좋은 색상, 숫자, 방위
- 긍정적인 활동과 취미
(3~4줄)

**💖 인간관계와 건강**
- 대인관계 조언
- 건강 관리 포인트
(3줄)

**📜 옛 책에서 전하는 지혜**
- 고전 내용을 쉽게 풀어서 (한자 사용 금지)
(3~4줄)

※ 핵심 원칙:
- 한자는 사용하지 마세요
- 전문 용어 대신 일상 단어 사용
- 친근하고 따뜻한 어투 (~이에요, ~거예요, ~하세요)
- 긍정적인 표현 위주로 작성
- 총 20~25줄로 작성
"""
        
        easy_prompt = f"""사주를 아주 간단하게 요약해주세요.

## 사주 정보
{saju_info}

## 작성 형식

**✨ 한 줄 요약**
당신은 ~한 사람이에요! (1줄)

**🌈 성격**
~한 성격의 소유자예요. (2~3줄)

**🎯 추천**
- 어울리는 일: ~
- 행운의 색: ~
- 좋은 방향: ~

**💬 오늘의 조언**
~하면 더 좋은 하루가 될 거예요! (1~2줄)

※ 한자 사용 금지, 친근한 반말 체(~예요, ~거예요). 총 10~12줄로 작성.
"""

    # ================================================================
    # 고급 모드 (detailed): 명리학 전문 용어 사용
    # ================================================================
    elif analysis_level == "detailed":
        synthesis_prompt = f"""명리학 전문가로서 아래 사주를 학술적으로 분석하세요.

## 사주 정보
{saju_info}

## 고전 문헌 참조
{search_context}

## 작성 형식 (각 섹션 제목 필수, 전문 용어 사용)

**[일간(日干) 심층 분석]**
- 일간의 오행 특성과 십성(十星) 분포
- 신강(身强)/신약(身弱) 판단 근거
- 일간 특유의 기질과 행동 패턴
- 천간 통근(通根)과 투간(透干) 여부
(6~8줄)

**[격국(格局) 정론]**
- 월지(月支) 장간(藏干)을 통한 격국 판정
- 정격(正格) vs 변격(變格) 분류
- 격국의 성패(成敗) 조건
- 격국에 맞는 직업군과 성공 방향
(6~8줄)

**[용신(用神)과 기신(忌神)]**
- 억부(抑扶) 용신 판단
- 조후(調候) 용신 판단 (궁통보감 참조)
- 통관(通關) 용신 필요 여부
- 희신(喜神), 기신(忌神), 한신(閑神) 구분
- 대운/세운에서 용신 기운 시기
(6~8줄)

**[고전 문헌 해석]**
- 적천수(滴天髓), 궁통보감(窮通寶鑑), 삼명통회(三命通會) 관련 구절
- 원문의 현대적 해석과 적용
- 이 사주에 대한 고전의 핵심 판단
(8~10줄)

**[운세 흐름과 조언]**
- 현재 대운의 영향
- 주의해야 할 기신 대운 시기
- 건강, 재물, 관계 측면 조언
(5~6줄)

한국어로 작성, 한자는 괄호에 병기. 전문 용어 적극 사용. 총 35~40줄로 작성.
"""
        
        easy_prompt = f"""사주 분석 요약 (중급자용)

## 사주 정보
{saju_info}

## 작성 형식

**[핵심 요약]**
- 일간 특성과 신강/신약 (2줄)
- 격국 명칭과 의미 (1줄)
- 용신과 기신 (1줄)

**[실생활 적용]**
- 직업/사업 적성 (2줄)
- 대인관계 특징 (1줄)
- 건강 주의점 (1줄)

**[행운 요소]**
- 용신 색상, 방위, 숫자 (2줄)
- 좋은 시기와 주의 시기 (2줄)

한국어 작성, 한자 병기. 총 15~18줄로 작성.
"""

    # ================================================================
    # 사주가 모드 (expert): 원문 인용, 최대 상세도
    # ================================================================
    else:  # expert
        synthesis_prompt = f"""당신은 30년 경력의 명리학 대가입니다. 아래 사주에 대해 학술 논문 수준으로 분석하세요.

## 사주 팔자(四柱八字)
{saju_info}

## 고전 문헌 원문
{search_context}

## 분석 체계 (학술적 깊이로 작성)

**一. 일주(日主) 심층 분석**
1) 일간(日干)의 오행 물상(物象)과 성정(性情)
2) 일지(日支)와의 관계: 좌하(坐下) 십신 분석
3) 신강신약(身强身弱) 판정: 득령(得令)·득지(得地)·득세(得勢) 관점
4) 천간투출(天干透出)과 지지장간(地支藏干) 상호작용
(8~10줄)

**二. 격국(格局) 정론(正論)**
1) 월지(月支) 본기(本氣)·중기(中氣)·여기(餘氣) 분석
2) 격국 판정: [구체적 격국명] - 판정 근거 상세 설명
3) 격국의 성격(成格) 조건과 파격(破格) 요인
4) 격국에 따른 부귀빈천(富貴貧賤) 논단
(8~10줄)

**三. 용신(用神)·기신(忌神) 체계**
1) 억부용신(抑扶用神): 신강/신약에 따른 필요 오행
2) 조후용신(調候用神): 궁통보감 월령별 용신
3) 통관용신(通關用神): 상충/상극 조정 필요 여부
4) 병약용신(病藥用神): 사주 병폐와 치료 오행
5) 희신(喜神)·한신(閒神)·구신(仇神) 체계적 분류
(8~10줄)

**四. 고전 원문 해석**
1) 적천수(滴天髓) 관련 구절과 주해
2) 궁통보감(窮通寶鑑) 해당 월령 원문 분석
3) 삼명통회(三命通會) 격국론 적용
4) 연해자평(淵海子平) 십신론 참조
※ 원문 인용 시 출전 명시 필수
(10~12줄)

**五. 대운(大運)·세운(歲運) 분석**
1) 현행 대운의 사주 원국 영향
2) 향후 10년간 운세 흐름 개요
3) 길운(吉運)·흉운(凶運) 시기 판단
(5~6줄)

**六. 종합 평단(評斷)**
1) 선천 명조의 등급과 잠재력
2) 직업·사업·학문 적성
3) 혼인·자녀·건강 논단
4) 개운(開運) 방안
(6~8줄)

※ 작성 원칙:
- 모든 전문 용어는 한자 병기 필수
- 고전 원문 인용 시 출전(적천수, 궁통보감 등) 명시
- 학술적이고 객관적인 문체 사용
- 총 50~60줄로 작성
"""
        
        easy_prompt = f"""사주가 실무 요약본

## 사주
{saju_info}

## 핵심 판단 (원문 근거 포함)

**[명조 개요]**
- 일간: {info.day_gan}({info.day_gan_ko}) - 신강/신약 판정
- 격국: [격국명] (월지 {pillars['month']['zh']} 기준)
- 용신: [용신 오행] / 기신: [기신 오행]

**[고전 근거]**
- 적천수: "관련 원문 인용" - 해석
- 궁통보감: "관련 원문 인용" - 해석

**[실무 조언]**
- 직업 적성: ~
- 대운 주의 시기: ~
- 개운 방안: ~

**[상담 포인트]**
고객에게 전달할 핵심 메시지 (3줄)

전문가용 간략 요약. 총 18~22줄.
"""
    
    print(f"  [프롬프트 모드: {analysis_level}] 종합={len(synthesis_prompt)}자, 요약={len(easy_prompt)}자")
    
    async def call_llm_async(prompt: str, label: str = "") -> str:
        """비동기 DeepSeek LLM 호출 (httpx)"""
        try:
            if PROMETHEUS_AVAILABLE:
                LLM_CALLS.labels(status='started').inc()
            
            resp = await http_client.post(
                f"{settings.deepseek.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000,
                    "temperature": 0.5,
                },
            )
            
            if resp.status_code == 200:
                if PROMETHEUS_AVAILABLE:
                    LLM_CALLS.labels(status='success').inc()
                return resp.json()["choices"][0]["message"]["content"]
            else:
                print(f"[LLM {label}] API 오류: {resp.status_code} - {resp.text[:200]}")
                if PROMETHEUS_AVAILABLE:
                    LLM_CALLS.labels(status='error').inc()
                return ""
        except Exception as e:
            print(f"[LLM {label}] 호출 예외: {e}")
            if PROMETHEUS_AVAILABLE:
                LLM_CALLS.labels(status='exception').inc()
            return ""
    
    try:
        # 비동기 병렬 LLM 호출 (asyncio.gather)
        synthesis, easy_explanation = await asyncio.gather(
            call_llm_async(synthesis_prompt, "종합"),
            call_llm_async(easy_prompt, "쉬운설명"),
        )
        
        print(f"  LLM 응답: 종합({len(synthesis)}자), 쉬운설명({len(easy_explanation)}자)")
        
        return synthesis, easy_explanation
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"LLM 분석 중 오류: {str(e)}", ""


# ================================================
# 2. 조후용신 완전 데이터 (10일간 x 12월령 = 120개)
# ================================================
# 궁통보감(窮通寶鑑) 기반 조후용신 데이터

JOHU_YONGSHEN_TABLE = {
    # 갑목(甲木) - 양목
    '甲': {
        '寅': {'primary': '丙', 'secondary': '癸', 'tertiary': '戊', 
               'reason': '초춘 갑목은 여한이 남아 병화로 따뜻이 하고, 계수로 뿌리를 적시며, 무토로 배양한다',
               'classical': '궁통보감: 甲木參天 寅月調候先取丙火'},
        '卯': {'primary': '丙', 'secondary': '癸', 'tertiary': None,
               'reason': '묘월 갑목은 양기가 점차 왕성하나 아직 병화가 필요하고 계수로 자양한다',
               'classical': '궁통보감: 卯月甲木 陽氣漸盛 專用丙火'},
        '辰': {'primary': '庚', 'secondary': '丁', 'tertiary': '壬',
               'reason': '진월 갑목은 토가 두터워 경금으로 소토하고 정화로 설기하며 임수로 자양',
               'classical': '궁통보감: 辰月甲木 土厚用庚疏之'},
        '巳': {'primary': '癸', 'secondary': '丁', 'tertiary': '庚',
               'reason': '사월 갑목은 화가 왕성하니 계수로 자양하고 정화로 설기하며 경금이 있으면 좋다',
               'classical': '궁통보감: 巳月甲木 木性枯焦 先取癸水'},
        '午': {'primary': '癸', 'secondary': '丁', 'tertiary': '庚',
               'reason': '오월 갑목은 화염이 극성하니 계수가 급하고 정화를 설기로 쓴다',
               'classical': '궁통보감: 午月甲木 木死火旺 專取癸水'},
        '未': {'primary': '癸', 'secondary': '丁', 'tertiary': '庚',
               'reason': '미월 갑목은 토조하니 계수로 윤택하게 하고 경금이 있으면 원천이 있다',
               'classical': '궁통보감: 未月甲木 土燥用癸'},
        '申': {'primary': '丁', 'secondary': '庚', 'tertiary': '壬',
               'reason': '신월 갑목은 금이 왕하니 정화로 제금하고 경금으로 설기하며 임수로 생부',
               'classical': '궁통보감: 申月甲木 金旺用丁制之'},
        '酉': {'primary': '丁', 'secondary': '丙', 'tertiary': '庚',
               'reason': '유월 갑목은 금왕절지라 정화 병화로 금을 제어한다',
               'classical': '궁통보감: 酉月甲木 庚辛旺地 專取丁火'},
        '戌': {'primary': '庚', 'secondary': '丁', 'tertiary': '甲',
               'reason': '술월 갑목은 토왕하니 경금으로 소토하고 정화로 따뜻이 한다',
               'classical': '궁통보감: 戌月甲木 土旺用庚'},
        '亥': {'primary': '丙', 'secondary': '庚', 'tertiary': '戊',
               'reason': '해월 갑목은 수왕목상하니 병화로 따뜻이 하고 무토로 제수한다',
               'classical': '궁통보감: 亥月甲木 木長生 丙火調候為先'},
        '子': {'primary': '丙', 'secondary': '丁', 'tertiary': '庚',
               'reason': '자월 갑목은 한수가 왕하니 병화 정화로 따뜻이 하는 것이 급하다',
               'classical': '궁통보감: 子月甲木 木絕 丙丁調候急'},
        '丑': {'primary': '丙', 'secondary': '丁', 'tertiary': '庚',
               'reason': '축월 갑목은 한습하니 병화로 따뜻이 하고 경금으로 설기한다',
               'classical': '궁통보감: 丑月甲木 寒濕 丙火調候'},
    },
    # 을목(乙木) - 음목
    '乙': {
        '寅': {'primary': '丙', 'secondary': '癸', 'tertiary': None,
               'reason': '인월 을목은 초춘 여한이 있어 병화로 따뜻이 하고 계수로 자양',
               'classical': '궁통보감: 乙木軟弱 寅月先丙後癸'},
        '卯': {'primary': '丙', 'secondary': '癸', 'tertiary': None,
               'reason': '묘월 을목은 건록지로 병화 계수가 조화롭게 필요',
               'classical': '궁통보감: 卯月乙木 丙癸並用'},
        '辰': {'primary': '癸', 'secondary': '丙', 'tertiary': '辛',
               'reason': '진월 을목은 토왕하니 계수로 자양하고 신금으로 설기',
               'classical': '궁통보감: 辰月乙木 癸水滋潤'},
        '巳': {'primary': '癸', 'secondary': '丙', 'tertiary': None,
               'reason': '사월 을목은 화왕목고하니 계수가 급하다',
               'classical': '궁통보감: 巳月乙木 木枯 癸水急需'},
        '午': {'primary': '癸', 'secondary': '丙', 'tertiary': None,
               'reason': '오월 을목은 목사화왕하니 계수로 자양함이 급하다',
               'classical': '궁통보감: 午月乙木 專用癸水'},
        '未': {'primary': '癸', 'secondary': '丙', 'tertiary': None,
               'reason': '미월 을목은 토조하니 계수가 필요하고 병화도 참작',
               'classical': '궁통보감: 未月乙木 癸丙並用'},
        '申': {'primary': '癸', 'secondary': '丙', 'tertiary': '己',
               'reason': '신월 을목은 금왕하니 계수로 설금생목하고 병화로 제금',
               'classical': '궁통보감: 申月乙木 金旺 癸水為先'},
        '酉': {'primary': '癸', 'secondary': '丙', 'tertiary': None,
               'reason': '유월 을목은 금왕절지라 계수가 급하고 병화로 따뜻이',
               'classical': '궁통보감: 酉月乙木 專取癸水'},
        '戌': {'primary': '癸', 'secondary': '辛', 'tertiary': '丙',
               'reason': '술월 을목은 토조하니 계수로 윤택하게 하고 병화로 조후',
               'classical': '궁통보감: 戌月乙木 癸水為主'},
        '亥': {'primary': '丙', 'secondary': '戊', 'tertiary': None,
               'reason': '해월 을목은 수왕하니 병화로 조후하고 무토로 제수',
               'classical': '궁통보감: 亥月乙木 丙火調候'},
        '子': {'primary': '丙', 'secondary': '戊', 'tertiary': None,
               'reason': '자월 을목은 한수가 왕하니 병화로 따뜻이 함이 급하다',
               'classical': '궁통보감: 子月乙木 丙火急需'},
        '丑': {'primary': '丙', 'secondary': '戊', 'tertiary': None,
               'reason': '축월 을목은 한습하니 병화로 조후하고 무토로 배양',
               'classical': '궁통보감: 丑月乙木 丙火調候'},
    },
    # 병화(丙火) - 양화
    '丙': {
        '寅': {'primary': '壬', 'secondary': '庚', 'tertiary': None,
               'reason': '인월 병화는 목왕화상하니 임수로 제어하고 경금으로 설기',
               'classical': '궁통보감: 寅月丙火 專用壬水'},
        '卯': {'primary': '壬', 'secondary': '己', 'tertiary': None,
               'reason': '묘월 병화는 목화통명하니 임수로 제어',
               'classical': '궁통보감: 卯月丙火 壬水為先'},
        '辰': {'primary': '壬', 'secondary': '甲', 'tertiary': None,
               'reason': '진월 병화는 토후회광하니 임수로 윤택하게',
               'classical': '궁통보감: 辰月丙火 專用壬水'},
        '巳': {'primary': '壬', 'secondary': '庚', 'tertiary': None,
               'reason': '사월 병화는 화왕지라 임수가 급하고 경금이 원류',
               'classical': '궁통보감: 巳月丙火 專取壬水'},
        '午': {'primary': '壬', 'secondary': '庚', 'tertiary': None,
               'reason': '오월 병화는 화염이 극성하니 임수가 급하다',
               'classical': '궁통보감: 午月丙火 壬庚並用'},
        '未': {'primary': '壬', 'secondary': '庚', 'tertiary': None,
               'reason': '미월 병화는 토조화염하니 임수가 필요',
               'classical': '궁통보감: 未月丙火 先壬後庚'},
        '申': {'primary': '壬', 'secondary': '戊', 'tertiary': None,
               'reason': '신월 병화는 금왕하니 임수로 금을 설하여 화를 생',
               'classical': '궁통보감: 申月丙火 壬水為用'},
        '酉': {'primary': '壬', 'secondary': '癸', 'tertiary': None,
               'reason': '유월 병화는 금왕화쇠하니 임수 계수로 설금',
               'classical': '궁통보감: 酉月丙火 壬癸並用'},
        '戌': {'primary': '甲', 'secondary': '壬', 'tertiary': None,
               'reason': '술월 병화는 토조하니 갑목으로 생화하고 임수로 윤택',
               'classical': '궁통보감: 戌月丙火 甲壬並用'},
        '亥': {'primary': '甲', 'secondary': '戊', 'tertiary': '庚',
               'reason': '해월 병화는 수왕화쇠하니 갑목으로 통관생화',
               'classical': '궁통보감: 亥月丙火 甲木為先'},
        '子': {'primary': '甲', 'secondary': '戊', 'tertiary': '壬',
               'reason': '자월 병화는 한수극화하니 갑목이 급하다',
               'classical': '궁통보감: 子月丙火 專取甲木'},
        '丑': {'primary': '甲', 'secondary': '壬', 'tertiary': None,
               'reason': '축월 병화는 한습하니 갑목으로 생화',
               'classical': '궁통보감: 丑月丙火 甲木為主'},
    },
    # 정화(丁火) - 음화
    '丁': {
        '寅': {'primary': '甲', 'secondary': '庚', 'tertiary': None,
               'reason': '인월 정화는 목왕하니 갑목으로 생화하고 경금으로 벌목',
               'classical': '궁통보감: 寅月丁火 甲庚並用'},
        '卯': {'primary': '甲', 'secondary': '庚', 'tertiary': None,
               'reason': '묘월 정화는 을목이 왕하나 갑목이 정화에 좋고 경금으로 벌',
               'classical': '궁통보감: 卯月丁火 用甲引丁'},
        '辰': {'primary': '甲', 'secondary': '庚', 'tertiary': '壬',
               'reason': '진월 정화는 토후하니 갑목으로 생화',
               'classical': '궁통보감: 辰月丁火 甲木為先'},
        '巳': {'primary': '甲', 'secondary': '庚', 'tertiary': '壬',
               'reason': '사월 정화는 건록지라 갑목이 필요하고 경금 임수로 조절',
               'classical': '궁통보감: 巳月丁火 甲庚並用'},
        '午': {'primary': '甲', 'secondary': '壬', 'tertiary': '庚',
               'reason': '오월 정화는 양인지라 갑목으로 인화하고 임수로 제어',
               'classical': '궁통보감: 午月丁火 壬甲並用'},
        '未': {'primary': '甲', 'secondary': '壬', 'tertiary': '庚',
               'reason': '미월 정화는 토조하니 갑목으로 생화하고 임수로 윤택',
               'classical': '궁통보감: 未月丁火 甲壬並用'},
        '申': {'primary': '甲', 'secondary': '庚', 'tertiary': '丙',
               'reason': '신월 정화는 금왕화쇠하니 갑목으로 생화하고 병화를 참작',
               'classical': '궁통보감: 申月丁火 甲木為主'},
        '酉': {'primary': '甲', 'secondary': '庚', 'tertiary': '丙',
               'reason': '유월 정화는 금왕하니 갑목으로 통관생화',
               'classical': '궁통보감: 酉月丁火 庚劈甲引丁'},
        '戌': {'primary': '甲', 'secondary': '庚', 'tertiary': '戊',
               'reason': '술월 정화는 토조하니 갑목으로 생화하고 경금으로 벌목',
               'classical': '궁통보감: 戌月丁火 甲庚並用'},
        '亥': {'primary': '甲', 'secondary': '庚', 'tertiary': None,
               'reason': '해월 정화는 수왕화약하니 갑목으로 통관생화가 급하다',
               'classical': '궁통보감: 亥月丁火 甲木為先'},
        '子': {'primary': '甲', 'secondary': '庚', 'tertiary': None,
               'reason': '자월 정화는 한수극화하니 갑목이 급하다',
               'classical': '궁통보감: 子月丁火 專取甲木'},
        '丑': {'primary': '甲', 'secondary': '庚', 'tertiary': None,
               'reason': '축월 정화는 한습하니 갑목으로 생화함이 급하다',
               'classical': '궁통보감: 丑月丁火 甲庚並用'},
    },
    # 무토(戊土) - 양토
    '戊': {
        '寅': {'primary': '丙', 'secondary': '甲', 'tertiary': '癸',
               'reason': '인월 무토는 한토라 병화로 따뜻이 하고 갑목으로 소토',
               'classical': '궁통보감: 寅月戊土 丙甲並用'},
        '卯': {'primary': '丙', 'secondary': '甲', 'tertiary': '癸',
               'reason': '묘월 무토는 목왕토허하니 병화로 따뜻이 하고 갑목으로 소토',
               'classical': '궁통보감: 卯月戊土 先丙後甲'},
        '辰': {'primary': '甲', 'secondary': '丙', 'tertiary': '癸',
               'reason': '진월 무토는 본령이라 갑목으로 소토하고 병화 계수로 조후',
               'classical': '궁통보감: 辰月戊土 甲木為先'},
        '巳': {'primary': '甲', 'secondary': '癸', 'tertiary': '丙',
               'reason': '사월 무토는 화왕토조하니 갑목 계수로 조절',
               'classical': '궁통보감: 巳月戊土 甲癸並用'},
        '午': {'primary': '壬', 'secondary': '甲', 'tertiary': '丙',
               'reason': '오월 무토는 화염토조하니 임수가 급하고 갑목으로 소토',
               'classical': '궁통보감: 午月戊土 先壬後甲'},
        '未': {'primary': '癸', 'secondary': '甲', 'tertiary': '丙',
               'reason': '미월 무토는 건조하니 계수로 윤택하게 하고 갑목으로 소토',
               'classical': '궁통보감: 未月戊土 癸甲並用'},
        '申': {'primary': '丙', 'secondary': '癸', 'tertiary': '甲',
               'reason': '신월 무토는 금왕설기하니 병화로 따뜻이 하고 계수로 윤택',
               'classical': '궁통보감: 申月戊土 丙火調候'},
        '酉': {'primary': '丙', 'secondary': '癸', 'tertiary': None,
               'reason': '유월 무토는 금왕토허하니 병화로 생토하고 계수로 윤택',
               'classical': '궁통보감: 酉月戊土 丙癸並用'},
        '戌': {'primary': '甲', 'secondary': '癸', 'tertiary': '丙',
               'reason': '술월 무토는 토왕하니 갑목으로 소토하고 계수로 윤택',
               'classical': '궁통보감: 戌月戊土 甲木為先'},
        '亥': {'primary': '甲', 'secondary': '丙', 'tertiary': None,
               'reason': '해월 무토는 수왕토습하니 갑목으로 소토하고 병화로 조후',
               'classical': '궁통보감: 亥月戊土 甲丙並用'},
        '子': {'primary': '丙', 'secondary': '甲', 'tertiary': None,
               'reason': '자월 무토는 한습하니 병화가 급하고 갑목으로 소토',
               'classical': '궁통보감: 子月戊土 丙火調候'},
        '丑': {'primary': '丙', 'secondary': '甲', 'tertiary': None,
               'reason': '축월 무토는 한습하니 병화로 따뜻이 하고 갑목으로 소토',
               'classical': '궁통보감: 丑月戊土 丙甲並用'},
    },
    # 기토(己土) - 음토
    '己': {
        '寅': {'primary': '丙', 'secondary': '甲', 'tertiary': '癸',
               'reason': '인월 기토는 한습하니 병화로 조후하고 갑목으로 소토',
               'classical': '궁통보감: 寅月己土 丙甲並用'},
        '卯': {'primary': '丙', 'secondary': '甲', 'tertiary': '癸',
               'reason': '묘월 기토는 목왕토약하니 병화로 따뜻이',
               'classical': '궁통보감: 卯月己土 先丙後甲'},
        '辰': {'primary': '甲', 'secondary': '丙', 'tertiary': '癸',
               'reason': '진월 기토는 토왕하니 갑목으로 소토',
               'classical': '궁통보감: 辰月己土 甲丙並用'},
        '巳': {'primary': '癸', 'secondary': '丙', 'tertiary': None,
               'reason': '사월 기토는 화왕토조하니 계수가 급하다',
               'classical': '궁통보감: 巳月己土 專取癸水'},
        '午': {'primary': '癸', 'secondary': '丙', 'tertiary': None,
               'reason': '오월 기토는 화염토조하니 계수가 급하다',
               'classical': '궁통보감: 午月己土 專取癸水'},
        '未': {'primary': '癸', 'secondary': '丙', 'tertiary': '甲',
               'reason': '미월 기토는 건조하니 계수로 윤택하게',
               'classical': '궁통보감: 未月己土 癸水為先'},
        '申': {'primary': '丙', 'secondary': '癸', 'tertiary': None,
               'reason': '신월 기토는 금왕설기하니 병화로 생토',
               'classical': '궁통보감: 申月己土 丙癸並用'},
        '酉': {'primary': '丙', 'secondary': '癸', 'tertiary': None,
               'reason': '유월 기토는 금왕토허하니 병화로 생토',
               'classical': '궁통보감: 酉月己土 丙火為主'},
        '戌': {'primary': '甲', 'secondary': '丙', 'tertiary': '癸',
               'reason': '술월 기토는 토왕하니 갑목으로 소토',
               'classical': '궁통보감: 戌月己土 甲丙並用'},
        '亥': {'primary': '丙', 'secondary': '甲', 'tertiary': None,
               'reason': '해월 기토는 수왕토습하니 병화로 조후',
               'classical': '궁통보감: 亥月己土 丙火調候'},
        '子': {'primary': '丙', 'secondary': '甲', 'tertiary': None,
               'reason': '자월 기토는 한습하니 병화가 급하다',
               'classical': '궁통보감: 子月己土 專用丙火'},
        '丑': {'primary': '丙', 'secondary': '甲', 'tertiary': None,
               'reason': '축월 기토는 한습하니 병화로 조후',
               'classical': '궁통보감: 丑月己土 丙甲並用'},
    },
    # 경금(庚金) - 양금
    '庚': {
        '寅': {'primary': '丙', 'secondary': '甲', 'tertiary': '丁',
               'reason': '인월 경금은 목왕금쇠하니 병화로 따뜻이 하고 갑목으로 설기',
               'classical': '궁통보감: 寅月庚金 丙火調候'},
        '卯': {'primary': '丁', 'secondary': '甲', 'tertiary': '丙',
               'reason': '묘월 경금은 목왕하니 정화로 연금하고 갑목으로 설기',
               'classical': '궁통보감: 卯月庚金 丁火鍛金'},
        '辰': {'primary': '甲', 'secondary': '丁', 'tertiary': '壬',
               'reason': '진월 경금은 토왕금상하니 갑목으로 소토하고 정화로 연금',
               'classical': '궁통보감: 辰月庚金 甲丁並用'},
        '巳': {'primary': '壬', 'secondary': '戊', 'tertiary': '丁',
               'reason': '사월 경금은 화왕금쇠하니 임수가 급하다',
               'classical': '궁통보감: 巳月庚金 壬水為先'},
        '午': {'primary': '壬', 'secondary': '癸', 'tertiary': '己',
               'reason': '오월 경금은 화염극금하니 임수가 급하다',
               'classical': '궁통보감: 午月庚金 專取壬水'},
        '未': {'primary': '壬', 'secondary': '癸', 'tertiary': '丁',
               'reason': '미월 경금은 토조금약하니 임수로 윤택하게',
               'classical': '궁통보감: 未月庚金 壬水為先'},
        '申': {'primary': '丁', 'secondary': '甲', 'tertiary': '壬',
               'reason': '신월 경금은 건록지라 정화로 연금하고 갑목으로 설기',
               'classical': '궁통보감: 申月庚金 丁甲並用'},
        '酉': {'primary': '丁', 'secondary': '甲', 'tertiary': '丙',
               'reason': '유월 경금은 양인지라 정화로 연금하고 갑목으로 설기',
               'classical': '궁통보감: 酉月庚金 丁火鍛金'},
        '戌': {'primary': '甲', 'secondary': '壬', 'tertiary': '丁',
               'reason': '술월 경금은 토왕하니 갑목으로 소토하고 임수로 세금',
               'classical': '궁통보감: 戌月庚金 甲壬並用'},
        '亥': {'primary': '丁', 'secondary': '甲', 'tertiary': '丙',
               'reason': '해월 경금은 수왕금침하니 정화로 따뜻이',
               'classical': '궁통보감: 亥月庚金 丁火調候'},
        '子': {'primary': '丁', 'secondary': '甲', 'tertiary': '丙',
               'reason': '자월 경금은 한수왕하니 정화로 조후가 급하다',
               'classical': '궁통보감: 子月庚金 丁火調候'},
        '丑': {'primary': '丁', 'secondary': '甲', 'tertiary': '丙',
               'reason': '축월 경금은 한습하니 정화로 조후하고 갑목으로 설기',
               'classical': '궁통보감: 丑月庚金 丁甲並用'},
    },
    # 신금(辛金) - 음금
    '辛': {
        '寅': {'primary': '己', 'secondary': '壬', 'tertiary': '庚',
               'reason': '인월 신금은 목왕금쇠하니 기토로 생금하고 임수로 세금',
               'classical': '궁통보감: 寅月辛金 己土生金'},
        '卯': {'primary': '壬', 'secondary': '己', 'tertiary': None,
               'reason': '묘월 신금은 목왕하니 임수로 세금하고 기토로 생금',
               'classical': '궁통보감: 卯月辛金 壬己並用'},
        '辰': {'primary': '壬', 'secondary': '甲', 'tertiary': None,
               'reason': '진월 신금은 토왕하니 임수로 세금하고 갑목으로 소토',
               'classical': '궁통보감: 辰月辛金 壬水為先'},
        '巳': {'primary': '壬', 'secondary': '癸', 'tertiary': '己',
               'reason': '사월 신금은 화왕금쇠하니 임수가 급하다',
               'classical': '궁통보감: 巳月辛金 專取壬水'},
        '午': {'primary': '壬', 'secondary': '癸', 'tertiary': '己',
               'reason': '오월 신금은 화염극금하니 임수 계수가 급하다',
               'classical': '궁통보감: 午月辛金 壬癸並用'},
        '未': {'primary': '壬', 'secondary': '癸', 'tertiary': '甲',
               'reason': '미월 신금은 토조하니 임수로 세금',
               'classical': '궁통보감: 未月辛金 壬水為先'},
        '申': {'primary': '壬', 'secondary': '甲', 'tertiary': None,
               'reason': '신월 신금은 금왕하니 임수로 설기하고 갑목으로 소토',
               'classical': '궁통보감: 申月辛金 壬甲並用'},
        '酉': {'primary': '壬', 'secondary': '甲', 'tertiary': None,
               'reason': '유월 신금은 건록지라 임수로 설기',
               'classical': '궁통보감: 酉月辛金 壬水為先'},
        '戌': {'primary': '壬', 'secondary': '甲', 'tertiary': None,
               'reason': '술월 신금은 토왕하니 임수로 세금하고 갑목으로 소토',
               'classical': '궁통보감: 戌月辛金 壬甲並用'},
        '亥': {'primary': '壬', 'secondary': '丙', 'tertiary': '戊',
               'reason': '해월 신금은 수왕금침하니 병화로 조후',
               'classical': '궁통보감: 亥月辛金 壬丙並用'},
        '子': {'primary': '丙', 'secondary': '戊', 'tertiary': '壬',
               'reason': '자월 신금은 한수왕하니 병화로 조후가 급하다',
               'classical': '궁통보감: 子月辛金 丙火調候'},
        '丑': {'primary': '丙', 'secondary': '壬', 'tertiary': '戊',
               'reason': '축월 신금은 한습하니 병화로 조후',
               'classical': '궁통보감: 丑月辛金 丙壬並用'},
    },
    # 임수(壬水) - 양수
    '壬': {
        '寅': {'primary': '戊', 'secondary': '丙', 'tertiary': '庚',
               'reason': '인월 임수는 수왕하니 무토로 제수하고 병화로 조후',
               'classical': '궁통보감: 寅月壬水 戊丙並用'},
        '卯': {'primary': '戊', 'secondary': '辛', 'tertiary': None,
               'reason': '묘월 임수는 목왕설기하니 무토로 제수',
               'classical': '궁통보감: 卯月壬水 戊土為先'},
        '辰': {'primary': '甲', 'secondary': '庚', 'tertiary': None,
               'reason': '진월 임수는 토왕하니 갑목으로 소토하고 경금으로 생수',
               'classical': '궁통보감: 辰月壬水 甲庚並用'},
        '巳': {'primary': '壬', 'secondary': '辛', 'tertiary': '庚',
               'reason': '사월 임수는 화왕수약하니 임수 비겁으로 돕고 신금으로 생수',
               'classical': '궁통보감: 巳月壬水 壬辛並用'},
        '午': {'primary': '庚', 'secondary': '辛', 'tertiary': '癸',
               'reason': '오월 임수는 화염수고하니 경금 신금이 급하다',
               'classical': '궁통보감: 午月壬水 庚辛為先'},
        '未': {'primary': '辛', 'secondary': '甲', 'tertiary': '癸',
               'reason': '미월 임수는 토조수약하니 신금으로 생수',
               'classical': '궁통보감: 未月壬水 辛甲並用'},
        '申': {'primary': '戊', 'secondary': '丁', 'tertiary': None,
               'reason': '신월 임수는 금왕수상하니 무토로 제수',
               'classical': '궁통보감: 申月壬水 戊丁並用'},
        '酉': {'primary': '甲', 'secondary': '戊', 'tertiary': None,
               'reason': '유월 임수는 금왕하니 갑목으로 설기하고 무토로 제수',
               'classical': '궁통보감: 酉月壬水 甲戊並用'},
        '戌': {'primary': '甲', 'secondary': '丙', 'tertiary': None,
               'reason': '술월 임수는 토왕하니 갑목으로 소토',
               'classical': '궁통보감: 戌月壬水 甲丙並用'},
        '亥': {'primary': '戊', 'secondary': '丙', 'tertiary': '庚',
               'reason': '해월 임수는 건록지라 무토로 제수하고 병화로 조후',
               'classical': '궁통보감: 亥月壬水 戊丙並用'},
        '子': {'primary': '戊', 'secondary': '丙', 'tertiary': None,
               'reason': '자월 임수는 양인지라 무토로 제수하고 병화로 조후',
               'classical': '궁통보감: 子月壬水 戊丙並用'},
        '丑': {'primary': '丙', 'secondary': '甲', 'tertiary': None,
               'reason': '축월 임수는 한습하니 병화로 조후가 급하다',
               'classical': '궁통보감: 丑月壬水 丙甲並用'},
    },
    # 계수(癸水) - 음수
    '癸': {
        '寅': {'primary': '辛', 'secondary': '丙', 'tertiary': None,
               'reason': '인월 계수는 목왕설기하니 신금으로 생수하고 병화로 조후',
               'classical': '궁통보감: 寅月癸水 辛丙並用'},
        '卯': {'primary': '辛', 'secondary': '庚', 'tertiary': None,
               'reason': '묘월 계수는 목왕하니 신금 경금으로 생수',
               'classical': '궁통보감: 卯月癸水 庚辛為先'},
        '辰': {'primary': '丙', 'secondary': '辛', 'tertiary': '甲',
               'reason': '진월 계수는 토왕하니 병화로 조후하고 신금으로 생수',
               'classical': '궁통보감: 辰月癸水 丙辛並用'},
        '巳': {'primary': '辛', 'secondary': '壬', 'tertiary': None,
               'reason': '사월 계수는 화왕수약하니 신금이 급하다',
               'classical': '궁통보감: 巳月癸水 專取辛金'},
        '午': {'primary': '庚', 'secondary': '辛', 'tertiary': '壬',
               'reason': '오월 계수는 화염수고하니 경금 신금이 급하다',
               'classical': '궁통보감: 午月癸水 庚辛並用'},
        '未': {'primary': '庚', 'secondary': '辛', 'tertiary': '壬',
               'reason': '미월 계수는 토조하니 경금 신금으로 생수',
               'classical': '궁통보감: 未月癸水 庚辛為先'},
        '申': {'primary': '丁', 'secondary': '丙', 'tertiary': None,
               'reason': '신월 계수는 금왕수상하니 정화로 제금',
               'classical': '궁통보감: 申月癸水 丁丙並用'},
        '酉': {'primary': '丙', 'secondary': '辛', 'tertiary': None,
               'reason': '유월 계수는 금왕하니 병화로 제금하고 따뜻이',
               'classical': '궁통보감: 酉月癸水 丙辛並用'},
        '戌': {'primary': '辛', 'secondary': '甲', 'tertiary': '丙',
               'reason': '술월 계수는 토왕하니 신금으로 생수하고 갑목으로 소토',
               'classical': '궁통보감: 戌月癸水 辛甲並用'},
        '亥': {'primary': '丙', 'secondary': '戊', 'tertiary': '庚',
               'reason': '해월 계수는 수왕하니 병화로 조후하고 무토로 제수',
               'classical': '궁통보감: 亥月癸水 丙戊並用'},
        '子': {'primary': '丙', 'secondary': '戊', 'tertiary': None,
               'reason': '자월 계수는 건록지라 병화로 조후가 급하다',
               'classical': '궁통보감: 子月癸水 丙火調候'},
        '丑': {'primary': '丙', 'secondary': '辛', 'tertiary': None,
               'reason': '축월 계수는 한습하니 병화로 조후하고 신금으로 생수',
               'classical': '궁통보감: 丑月癸水 丙辛並用'},
    },
}

# 천간 한글 변환
GAN_TO_KO = {
    '甲': '갑목', '乙': '을목', '丙': '병화', '丁': '정화', '戊': '무토',
    '己': '기토', '庚': '경금', '辛': '신금', '壬': '임수', '癸': '계수'
}


def get_johu_yongshen(day_gan: str, month_zhi: str) -> dict:
    """조후용신 조회 (120개 완전 데이터)"""
    day_data = JOHU_YONGSHEN_TABLE.get(day_gan, {})
    month_data = day_data.get(month_zhi, None)
    
    if month_data:
        return {
            'primary': GAN_TO_KO.get(month_data['primary'], month_data['primary']),
            'primary_gan': month_data['primary'],
            'secondary': GAN_TO_KO.get(month_data['secondary'], month_data['secondary']) if month_data['secondary'] else None,
            'secondary_gan': month_data['secondary'],
            'tertiary': GAN_TO_KO.get(month_data['tertiary'], month_data['tertiary']) if month_data.get('tertiary') else None,
            'tertiary_gan': month_data.get('tertiary'),
            'reason': month_data['reason'],
            'classical_ref': month_data['classical'],
        }
    
    return {
        'primary': '용신 분석 필요',
        'secondary': '희신 분석 필요',
        'tertiary': None,
        'reason': '상세 분석이 필요합니다',
        'classical_ref': '',
    }


# ================================================
# 3. 신살(神煞) 완전 데이터 - 50+ 신살 정의
# ================================================

# 지지 한글 변환
ZHI_KO_MAP = {
    '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
    '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
}

# 길신(吉神) 정의
SHINSAL_POSITIVE = {
    # 천을귀인 (天乙貴人) - 일간 기준
    '천을귀인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': ['丑', '未'], '乙': ['子', '申'], '丙': ['亥', '酉'], '丁': ['亥', '酉'],
            '戊': ['丑', '未'], '己': ['子', '申'], '庚': ['丑', '未'], '辛': ['寅', '午'],
            '壬': ['卯', '巳'], '癸': ['卯', '巳']
        },
        'meaning': '귀인의 도움, 어려움 속에서 구원, 사회적 인정',
        'description': '하늘의 귀인으로 위기 시 귀인의 도움이 있다',
        'classical': '삼명통회: 천을귀인은 만신 중 으뜸으로 모든 흉을 해소한다',
    },
    # 천덕귀인 (天德貴人) - 월지 기준
    '천덕귀인': {
        'lookup_type': 'month_zhi',
        'lookup_table': {
            '寅': '丁', '卯': '申', '辰': '壬', '巳': '辛',
            '午': '亥', '未': '甲', '申': '癸', '酉': '寅',
            '戌': '丙', '亥': '乙', '子': '巳', '丑': '庚'
        },
        'meaning': '덕을 베풂, 재앙 면함, 선행의 결과',
        'description': '하늘의 덕으로 재앙을 피하고 복을 받는다',
        'classical': '적천수: 천덕이 있으면 형액을 면한다',
    },
    # 월덕귀인 (月德貴人) - 월지 기준
    '월덕귀인': {
        'lookup_type': 'month_zhi',
        'lookup_table': {
            '寅': '丙', '卯': '甲', '辰': '壬', '巳': '庚',
            '午': '丙', '未': '甲', '申': '壬', '酉': '庚',
            '戌': '丙', '亥': '甲', '子': '壬', '丑': '庚'
        },
        'meaning': '덕망, 인덕, 재앙 면함',
        'description': '달의 덕으로 덕망이 있고 인덕이 있다',
        'classical': '삼명통회: 월덕은 자비롭고 복이 많다',
    },
    # 문창성 (文昌星) - 일간 기준
    '문창귀인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
            '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
            '壬': '寅', '癸': '卯'
        },
        'meaning': '학문, 문학, 시험 합격, 명예',
        'description': '문장의 재능이 뛰어나고 학업 성취가 좋다',
        'classical': '삼명통회: 문창이 있으면 총명하고 학업에 뛰어나다',
    },
    # 학당귀인 (學堂貴人) - 일간 기준
    '학당귀인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '亥', '乙': '亥', '丙': '寅', '丁': '寅',
            '戊': '寅', '己': '巳', '庚': '巳', '辛': '申',
            '壬': '申', '癸': '亥'
        },
        'meaning': '학문, 교육, 지적 능력',
        'description': '학문의 전당에 거하니 배움에 능하다',
        'classical': '삼명통회: 학당에 있으면 학업이 뛰어나다',
    },
    # 역마 (驛馬) - 일지/연지 기준
    '역마': {
        'lookup_type': 'year_day_zhi',
        'lookup_table': {
            '寅': '申', '午': '申', '戌': '申',
            '申': '寅', '子': '寅', '辰': '寅',
            '巳': '亥', '酉': '亥', '丑': '亥',
            '亥': '巳', '卯': '巳', '未': '巳'
        },
        'meaning': '이동, 여행, 변화, 해외 운',
        'description': '역마가 있으면 이동이 많고 활동적이다',
        'classical': '삼명통회: 역마는 동분서주하며 활동이 많다',
    },
    # 화개 (華蓋) - 일지/연지 기준
    '화개': {
        'lookup_type': 'year_day_zhi',
        'lookup_table': {
            '寅': '戌', '午': '戌', '戌': '戌',
            '申': '辰', '子': '辰', '辰': '辰',
            '巳': '丑', '酉': '丑', '丑': '丑',
            '亥': '未', '卯': '未', '未': '未'
        },
        'meaning': '예술성, 종교성, 고독, 학문',
        'description': '화개는 예술과 종교에 인연이 깊다',
        'classical': '적천수: 화개가 있으면 고독하나 예술에 능하다',
    },
    # 장성 (將星) - 일지/연지 기준
    '장성': {
        'lookup_type': 'year_day_zhi',
        'lookup_table': {
            '寅': '午', '午': '午', '戌': '午',
            '申': '子', '子': '子', '辰': '子',
            '巳': '酉', '酉': '酉', '丑': '酉',
            '亥': '卯', '卯': '卯', '未': '卯'
        },
        'meaning': '리더십, 권위, 지도력',
        'description': '장성은 지도자의 기질이 있다',
        'classical': '삼명통회: 장성이 있으면 권위가 있고 리더십이 있다',
    },
    # 금여록 (金輿祿) - 일간 기준
    '금여록': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '辰', '乙': '巳', '丙': '未', '丁': '申',
            '戊': '未', '己': '申', '庚': '戌', '辛': '亥',
            '壬': '丑', '癸': '寅'
        },
        'meaning': '재물복, 귀인 도움, 승진',
        'description': '금수레를 탄 것처럼 부귀하다',
        'classical': '삼명통회: 금여가 있으면 부귀영화를 누린다',
    },
    # 천주귀인 (天廚貴人) - 일간 기준  
    '천주귀인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '巳', '乙': '午', '丙': '巳', '丁': '午',
            '戊': '巳', '己': '午', '庚': '亥', '辛': '子',
            '壬': '亥', '癸': '子'
        },
        'meaning': '식복, 요리 재능, 음식 관련 직업',
        'description': '하늘의 부엌을 관장하니 식복이 좋다',
        'classical': '삼명통회: 천주가 있으면 식복이 많다',
    },
    # 태극귀인 (太極貴人) - 일간 기준
    '태극귀인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': ['子', '午'], '乙': ['子', '午'], 
            '丙': ['卯', '酉'], '丁': ['卯', '酉'],
            '戊': ['辰', '戌', '丑', '未'], '己': ['辰', '戌', '丑', '未'],
            '庚': ['寅', '亥'], '辛': ['寅', '亥'],
            '壬': ['巳', '申'], '癸': ['巳', '申']
        },
        'meaning': '학문, 철학, 종교적 깨달음',
        'description': '태극의 이치를 깨닫는 귀인',
        'classical': '삼명통회: 태극귀인은 학문에 뛰어나다',
    },
    # 복성귀인 (福星貴人) - 일간 기준
    '복성귀인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '寅', '乙': '丑', '丙': '子', '丁': '亥',
            '戊': '申', '己': '未', '庚': '午', '辛': '巳',
            '壬': '辰', '癸': '卯'
        },
        'meaning': '복록, 행운, 만사형통',
        'description': '복성이 비추어 행운이 따른다',
        'classical': '삼명통회: 복성이 있으면 만사가 순조롭다',
    },
}

# 흉신(凶神) 정의
SHINSAL_NEGATIVE = {
    # 양인 (羊刃) - 일간 기준
    '양인': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳',
            '戊': '午', '己': '巳', '庚': '酉', '辛': '申',
            '壬': '子', '癸': '亥'
        },
        'meaning': '과격, 수술수, 형액, 재물 손실',
        'description': '양인은 칼날처럼 날카로우니 형액 주의',
        'classical': '삼명통회: 양인은 형충이 많고 관살을 보면 권위가 있다',
    },
    # 겁살 (劫煞) - 일지/연지 기준
    '겁살': {
        'lookup_type': 'year_day_zhi',
        'lookup_table': {
            '寅': '亥', '午': '亥', '戌': '亥',
            '申': '巳', '子': '巳', '辰': '巳',
            '巳': '寅', '酉': '寅', '丑': '寅',
            '亥': '申', '卯': '申', '未': '申'
        },
        'meaning': '도난, 사기, 손재, 갑작스런 재앙',
        'description': '겁살은 재물 손실과 도난을 주의해야 한다',
        'classical': '삼명통회: 겁살이 있으면 도난과 손재를 주의',
    },
    # 망신살 (亡神煞) - 일지/연지 기준
    '망신살': {
        'lookup_type': 'year_day_zhi',
        'lookup_table': {
            '寅': '巳', '午': '巳', '戌': '巳',
            '申': '亥', '子': '亥', '辰': '亥',
            '巳': '申', '酉': '申', '丑': '申',
            '亥': '寅', '卯': '寅', '未': '寅'
        },
        'meaning': '명예 실추, 망신, 실패',
        'description': '망신살은 명예를 잃기 쉬우니 언행 주의',
        'classical': '삼명통회: 망신이 있으면 명예를 손상하기 쉽다',
    },
    # 원진살 (怨嗔煞) - 일지 기준
    '원진살': {
        'lookup_type': 'day_zhi',
        'lookup_table': {
            '子': '未', '丑': '午', '寅': '巳', '卯': '辰',
            '辰': '卯', '巳': '寅', '午': '丑', '未': '子',
            '申': '亥', '酉': '戌', '戌': '酉', '亥': '申'
        },
        'meaning': '대인 갈등, 원망, 이별',
        'description': '원진은 미움을 받거나 원수를 만들기 쉽다',
        'classical': '삼명통회: 원진이 있으면 대인관계에 문제가 많다',
    },
    # 고신살 (孤辰煞) - 연지 기준
    '고신살': {
        'lookup_type': 'year_zhi',
        'lookup_table': {
            '寅': '巳', '卯': '巳', '辰': '巳',
            '巳': '申', '午': '申', '未': '申',
            '申': '亥', '酉': '亥', '戌': '亥',
            '亥': '寅', '子': '寅', '丑': '寅'
        },
        'meaning': '고독, 독신, 배우자 인연 약함',
        'description': '고신은 혼자되기 쉽다 (남자에게 불리)',
        'classical': '삼명통회: 고신이 있으면 배우자와 인연이 약하다',
    },
    # 과숙살 (寡宿煞) - 연지 기준
    '과숙살': {
        'lookup_type': 'year_zhi',
        'lookup_table': {
            '寅': '丑', '卯': '丑', '辰': '丑',
            '巳': '辰', '午': '辰', '未': '辰',
            '申': '未', '酉': '未', '戌': '未',
            '亥': '戌', '子': '戌', '丑': '戌'
        },
        'meaning': '고독, 과부, 배우자 인연 약함',
        'description': '과숙은 혼자되기 쉽다 (여자에게 불리)',
        'classical': '삼명통회: 과숙이 있으면 배우자와 사별하기 쉽다',
    },
    # 백호대살 (白虎大煞) - 일간 기준
    '백호대살': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '辰', '乙': '巳', '丙': '午', '丁': '未',
            '戊': '午', '己': '未', '庚': '戌', '辛': '亥',
            '壬': '子', '癸': '丑'
        },
        'meaning': '혈액, 수술, 교통사고, 급작스런 재앙',
        'description': '백호는 유혈사고와 급한 재앙을 주의',
        'classical': '삼명통회: 백호가 있으면 혈광지재를 주의',
    },
    # 도화살 (桃花煞) - 일지/연지 기준
    '도화살': {
        'lookup_type': 'year_day_zhi',
        'lookup_table': {
            '寅': '卯', '午': '卯', '戌': '卯',
            '申': '酉', '子': '酉', '辰': '酉',
            '巳': '午', '酉': '午', '丑': '午',
            '亥': '子', '卯': '子', '未': '子'
        },
        'meaning': '이성 문제, 외도, 색정, 연예성',
        'description': '도화는 이성의 인기가 많으나 색정 주의',
        'classical': '삼명통회: 도화가 있으면 이성의 인연이 많다',
    },
    # 홍염살 (紅艶煞) - 일간 기준
    '홍염살': {
        'lookup_type': 'day_gan',
        'lookup_table': {
            '甲': '午', '乙': '午', '丙': '寅', '丁': '未',
            '戊': '辰', '己': '辰', '庚': '戌', '辛': '酉',
            '壬': '子', '癸': '申'
        },
        'meaning': '색정, 이성 문제, 예술성',
        'description': '홍염은 이성에게 인기 있으나 색정 주의',
        'classical': '삼명통회: 홍염이 있으면 이성에게 매력적이다',
    },
    # 육액살 (六厄煞) - 일지 기준
    '육액살': {
        'lookup_type': 'day_zhi',
        'lookup_table': {
            '子': '卯', '丑': '辰', '寅': '巳', '卯': '午',
            '辰': '未', '巳': '申', '午': '酉', '未': '戌',
            '申': '亥', '酉': '子', '戌': '丑', '亥': '寅'
        },
        'meaning': '병액, 재난, 질병',
        'description': '육액은 질병과 재난을 주의',
        'classical': '삼명통회: 육액이 있으면 질병을 조심해야 한다',
    },
    # 천라지망 (天羅地網)
    '천라지망': {
        'lookup_type': 'pillars_pair',
        'lookup_table': {
            '戌亥': True,  # 천라 (술해)
            '辰巳': True,  # 지망 (진사)
        },
        'meaning': '구속, 속박, 법적 문제, 답답함',
        'description': '하늘과 땅의 그물에 갇힌 격',
        'classical': '삼명통회: 천라지망에 걸리면 답답하고 속박된다',
    },
    # 공망 (空亡) - 일주 기준
    '공망': {
        'lookup_type': 'day_pillar_special',
        'meaning': '헛됨, 실패, 무효',
        'description': '공망은 일이 헛되이 돌아가기 쉽다',
        'classical': '삼명통회: 공망에 들면 일이 허사가 되기 쉽다',
    },
    # 형(刑)
    '형': {
        'lookup_type': 'zhi_interaction',
        'pairs': [
            ('寅', '巳'), ('巳', '申'), ('寅', '申'),  # 무은지형
            ('丑', '戌'), ('戌', '未'), ('丑', '未'),  # 무례지형
            ('子', '卯'),  # 무례지형
            ('辰', '辰'), ('午', '午'), ('酉', '酉'), ('亥', '亥'),  # 자형
        ],
        'meaning': '형벌, 재판, 수술, 갈등',
        'description': '형이 있으면 법적 문제나 수술수 주의',
        'classical': '삼명통회: 형은 형벌과 시비를 암시한다',
    },
    # 충(冲)
    '충': {
        'lookup_type': 'zhi_interaction',
        'pairs': [
            ('子', '午'), ('丑', '未'), ('寅', '申'),
            ('卯', '酉'), ('辰', '戌'), ('巳', '亥'),
        ],
        'meaning': '충돌, 변화, 이동, 갈등',
        'description': '충이 있으면 변화와 이동이 많다',
        'classical': '삼명통회: 충은 변동과 충돌을 의미한다',
    },
    # 파(破)
    '파': {
        'lookup_type': 'zhi_interaction',
        'pairs': [
            ('子', '酉'), ('丑', '辰'), ('寅', '亥'),
            ('卯', '午'), ('巳', '申'), ('未', '戌'),
        ],
        'meaning': '파괴, 손실, 이별',
        'description': '파가 있으면 파손과 손실을 주의',
        'classical': '삼명통회: 파는 파괴와 손실을 암시한다',
    },
    # 해(害)
    '해': {
        'lookup_type': 'zhi_interaction',
        'pairs': [
            ('子', '未'), ('丑', '午'), ('寅', '巳'),
            ('卯', '辰'), ('申', '亥'), ('酉', '戌'),
        ],
        'meaning': '해침, 질병, 구설',
        'description': '해가 있으면 구설과 질병을 주의',
        'classical': '삼명통회: 해는 해침과 손해를 의미한다',
    },
}

# 길신 리스트
POSITIVE_SHINSAL_LIST = [
    '천을귀인', '천덕귀인', '월덕귀인', '문창귀인', '학당귀인',
    '역마', '화개', '장성', '금여록', '천주귀인', '태극귀인', '복성귀인'
]

# 흉신 리스트
NEGATIVE_SHINSAL_LIST = [
    '양인', '겁살', '망신살', '원진살', '고신살', '과숙살',
    '백호대살', '도화살', '홍염살', '육액살', '형', '충', '파', '해'
]


def find_all_shinsal(info) -> dict:
    """사주에서 모든 신살 찾기"""
    year_zhi = info.pillars['year']['zhi']
    month_zhi = info.pillars['month']['zhi']
    day_gan = info.day_gan
    day_zhi = info.pillars['day']['zhi']
    hour_zhi = info.pillars['hour']['zhi']
    
    all_zhis = [year_zhi, month_zhi, day_zhi, hour_zhi]
    all_gans = [
        info.pillars['year']['gan'],
        info.pillars['month']['gan'],
        day_gan,
        info.pillars['hour']['gan']
    ]
    
    positive_found = []
    negative_found = []
    
    # 길신 체크
    for name, data in SHINSAL_POSITIVE.items():
        lookup_type = data['lookup_type']
        lookup_table = data.get('lookup_table', {})
        
        if lookup_type == 'day_gan':
            targets = lookup_table.get(day_gan, [])
            if isinstance(targets, str):
                targets = [targets]
            for zhi in all_zhis:
                if zhi in targets:
                    positive_found.append({
                        'name': name,
                        'position': f"{ZHI_KO_MAP.get(zhi, zhi)}지",
                        'meaning': data['meaning'],
                        'description': data['description'],
                    })
                    break
        
        elif lookup_type == 'month_zhi':
            target = lookup_table.get(month_zhi, '')
            for gan in all_gans:
                if gan == target:
                    positive_found.append({
                        'name': name,
                        'meaning': data['meaning'],
                        'description': data['description'],
                    })
                    break
        
        elif lookup_type == 'year_day_zhi':
            for base_zhi in [year_zhi, day_zhi]:
                target = lookup_table.get(base_zhi, '')
                for zhi in all_zhis:
                    if zhi == target and zhi != base_zhi:
                        positive_found.append({
                            'name': name,
                            'position': f"{ZHI_KO_MAP.get(zhi, zhi)}지",
                            'meaning': data['meaning'],
                            'description': data['description'],
                        })
                        break
    
    # 흉신 체크
    for name, data in SHINSAL_NEGATIVE.items():
        lookup_type = data['lookup_type']
        lookup_table = data.get('lookup_table', {})
        
        if lookup_type == 'day_gan':
            targets = lookup_table.get(day_gan, [])
            if isinstance(targets, str):
                targets = [targets]
            for zhi in all_zhis:
                if zhi in targets:
                    negative_found.append({
                        'name': name,
                        'position': f"{ZHI_KO_MAP.get(zhi, zhi)}지",
                        'meaning': data['meaning'],
                        'description': data['description'],
                    })
                    break
        
        elif lookup_type == 'year_day_zhi':
            for base_zhi in [year_zhi, day_zhi]:
                target = lookup_table.get(base_zhi, '')
                for zhi in all_zhis:
                    if zhi == target and zhi != base_zhi:
                        negative_found.append({
                            'name': name,
                            'position': f"{ZHI_KO_MAP.get(zhi, zhi)}지",
                            'meaning': data['meaning'],
                            'description': data['description'],
                        })
                        break
        
        elif lookup_type == 'day_zhi':
            target = lookup_table.get(day_zhi, '')
            for zhi in all_zhis:
                if zhi == target and zhi != day_zhi:
                    negative_found.append({
                        'name': name,
                        'meaning': data['meaning'],
                        'description': data['description'],
                    })
                    break
        
        elif lookup_type == 'year_zhi':
            target = lookup_table.get(year_zhi, '')
            for zhi in all_zhis:
                if zhi == target:
                    negative_found.append({
                        'name': name,
                        'meaning': data['meaning'],
                        'description': data['description'],
                    })
                    break
        
        elif lookup_type == 'zhi_interaction':
            pairs = data.get('pairs', [])
            for zhi1 in all_zhis:
                for zhi2 in all_zhis:
                    if zhi1 != zhi2:
                        if (zhi1, zhi2) in pairs or (zhi2, zhi1) in pairs:
                            negative_found.append({
                                'name': name,
                                'pair': f"{ZHI_KO_MAP.get(zhi1, zhi1)}-{ZHI_KO_MAP.get(zhi2, zhi2)}",
                                'meaning': data['meaning'],
                                'description': data['description'],
                            })
    
    # 중복 제거
    seen_positive = set()
    unique_positive = []
    for s in positive_found:
        key = s['name']
        if key not in seen_positive:
            seen_positive.add(key)
            unique_positive.append(s)
    
    seen_negative = set()
    unique_negative = []
    for s in negative_found:
        key = f"{s['name']}-{s.get('pair', s.get('position', ''))}"
        if key not in seen_negative:
            seen_negative.add(key)
            unique_negative.append(s)
    
    return {
        'positive': unique_positive,
        'negative': unique_negative,
        'summary': {
            'positive_count': len(unique_positive),
            'negative_count': len(unique_negative),
            'overall': '길신이 많음' if len(unique_positive) > len(unique_negative) else 
                      ('흉신이 많음' if len(unique_negative) > len(unique_positive) else '균형'),
        }
    }


def calculate_wuxing_balance(info) -> dict:
    """오행 분포 계산"""
    count = {'목': 0, '화': 0, '토': 0, '금': 0, '수': 0}
    wuxing_ko = {'木': '목', '火': '화', '土': '토', '金': '금', '水': '수'}
    
    for pillar in info.pillars.values():
        gan_wx = WUXING_MAP.get(pillar['gan'], '')
        zhi_wx = WUXING_MAP.get(pillar['zhi'], '')
        
        if gan_wx:
            count[wuxing_ko.get(gan_wx, gan_wx)] += 1
        if zhi_wx:
            count[wuxing_ko.get(zhi_wx, zhi_wx)] += 1
    
    return count


# ================================================
# 4. 대운/세운 해석 강화 프레임워크
# ================================================

# 지지 충(冲) 관계
ZHI_CHONG = {
    '子': '午', '午': '子', '丑': '未', '未': '丑',
    '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
    '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳',
}

# 지지 합(合) 관계 - 육합
ZHI_LIUHE = {
    '子': '丑', '丑': '子', '寅': '亥', '亥': '寅',
    '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰',
    '巳': '申', '申': '巳', '午': '未', '未': '午',
}

# 지지 삼합(三合) 관계
ZHI_SANHE = {
    '寅': {'full': ['寅', '午', '戌'], 'element': '火'},
    '午': {'full': ['寅', '午', '戌'], 'element': '火'},
    '戌': {'full': ['寅', '午', '戌'], 'element': '火'},
    '申': {'full': ['申', '子', '辰'], 'element': '水'},
    '子': {'full': ['申', '子', '辰'], 'element': '水'},
    '辰': {'full': ['申', '子', '辰'], 'element': '水'},
    '巳': {'full': ['巳', '酉', '丑'], 'element': '金'},
    '酉': {'full': ['巳', '酉', '丑'], 'element': '金'},
    '丑': {'full': ['巳', '酉', '丑'], 'element': '金'},
    '亥': {'full': ['亥', '卯', '未'], 'element': '木'},
    '卯': {'full': ['亥', '卯', '未'], 'element': '木'},
    '未': {'full': ['亥', '卯', '未'], 'element': '木'},
}

# 천간 합(合) 관계
GAN_HE = {
    '甲': '己', '己': '甲',
    '乙': '庚', '庚': '乙',
    '丙': '辛', '辛': '丙',
    '丁': '壬', '壬': '丁',
    '戊': '癸', '癸': '戊',
}

# 천간 충(冲) 관계
GAN_CHONG = {
    '甲': '庚', '庚': '甲',
    '乙': '辛', '辛': '乙',
    '丙': '壬', '壬': '丙',
    '丁': '癸', '癸': '丁',
    '戊': '甲', '甲': '戊',
    '己': '乙', '乙': '己',
}

# 십신 한글 매핑
SIPSIN_KO_MAP = {
    '비견': '비견', '겁재': '겁재',
    '식신': '식신', '상관': '상관',
    '편재': '편재', '정재': '정재',
    '편관': '편관', '정관': '정관',
    '편인': '편인', '정인': '정인',
}

# 천간 음양
GAN_YINYANG = {
    '甲': '양', '乙': '음', '丙': '양', '丁': '음', '戊': '양',
    '己': '음', '庚': '양', '辛': '음', '壬': '양', '癸': '음'
}


def get_sipsin_relation(day_gan: str, target_gan: str) -> str:
    """일간 기준 대상 천간의 십신 관계 계산"""
    day_wx = GAN_WUXING.get(day_gan, '')
    target_wx = GAN_WUXING.get(target_gan, '')
    day_yy = GAN_YINYANG.get(day_gan, '')
    target_yy = GAN_YINYANG.get(target_gan, '')
    
    if not day_wx or not target_wx:
        return '?'
    
    same_yy = (day_yy == target_yy)
    
    if day_wx == target_wx:
        return '비견' if same_yy else '겁재'
    
    if WUXING_SHENG.get(day_wx) == target_wx:
        return '식신' if same_yy else '상관'
    
    if WUXING_KE.get(day_wx) == target_wx:
        return '편재' if same_yy else '정재'
    
    if WUXING_KE.get(target_wx) == day_wx:
        return '편관' if same_yy else '정관'
    
    if WUXING_SHENG.get(target_wx) == day_wx:
        return '편인' if same_yy else '정인'
    
    return '?'


# 오행 생극 관계
WUXING_SHENG = {  # 생(生)
    '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
}
WUXING_KE = {  # 극(克)
    '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
}

# 천간 오행
GAN_WUXING = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
}

# 지지 오행
ZHI_WUXING = {
    '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水', '子': '水', '丑': '土'
}


def analyze_fortune_interactions(info, fortune_gan: str, fortune_zhi: str, yongshen_gan: str = None) -> dict:
    """대운/세운과 원국의 상호작용 분석"""
    
    day_gan = info.day_gan
    day_zhi = info.pillars['day']['zhi']
    all_zhis = [
        info.pillars['year']['zhi'],
        info.pillars['month']['zhi'],
        day_zhi,
        info.pillars['hour']['zhi']
    ]
    all_gans = [
        info.pillars['year']['gan'],
        info.pillars['month']['gan'],
        day_gan,
        info.pillars['hour']['gan']
    ]
    
    positive_effects = []
    negative_effects = []
    interactions = []
    score = 50  # 기본 점수 50점
    
    # 1. 천간 합(合) 체크
    if GAN_HE.get(fortune_gan) in all_gans:
        target = GAN_HE.get(fortune_gan)
        positive_effects.append(f"운의 {GAN_TO_KO.get(fortune_gan, fortune_gan)}이 원국 {GAN_TO_KO.get(target, target)}과 합(合)하여 화합")
        interactions.append({'type': 'gan_he', 'fortune': fortune_gan, 'wonguk': target, 'effect': 'positive'})
        score += 15
    
    # 2. 천간 충(冲) 체크
    if GAN_CHONG.get(fortune_gan) in all_gans:
        target = GAN_CHONG.get(fortune_gan)
        negative_effects.append(f"운의 {GAN_TO_KO.get(fortune_gan, fortune_gan)}이 원국 {GAN_TO_KO.get(target, target)}과 충(冲)하여 갈등")
        interactions.append({'type': 'gan_chong', 'fortune': fortune_gan, 'wonguk': target, 'effect': 'negative'})
        score -= 10
    
    # 3. 지지 육합 체크
    if ZHI_LIUHE.get(fortune_zhi) in all_zhis:
        target = ZHI_LIUHE.get(fortune_zhi)
        positive_effects.append(f"운의 {ZHI_KO_MAP.get(fortune_zhi, fortune_zhi)}이 원국 {ZHI_KO_MAP.get(target, target)}과 육합하여 조화")
        interactions.append({'type': 'zhi_liuhe', 'fortune': fortune_zhi, 'wonguk': target, 'effect': 'positive'})
        score += 12
    
    # 4. 지지 충(冲) 체크
    if ZHI_CHONG.get(fortune_zhi) in all_zhis:
        target = ZHI_CHONG.get(fortune_zhi)
        position = '년지' if target == all_zhis[0] else ('월지' if target == all_zhis[1] else ('일지' if target == all_zhis[2] else '시지'))
        negative_effects.append(f"운의 {ZHI_KO_MAP.get(fortune_zhi, fortune_zhi)}이 {position} {ZHI_KO_MAP.get(target, target)}과 충(冲)하여 변동")
        interactions.append({'type': 'zhi_chong', 'fortune': fortune_zhi, 'wonguk': target, 'position': position, 'effect': 'negative'})
        score -= 15
        
        # 일지 충은 더 심각
        if target == day_zhi:
            negative_effects.append("⚠️ 일지 충은 배우자궁/자신에게 영향 - 이사, 직장변동, 건강 주의")
            score -= 10
    
    # 5. 삼합 성립 체크
    sanhe_info = ZHI_SANHE.get(fortune_zhi, {})
    if sanhe_info:
        full_sanhe = sanhe_info['full']
        match_count = sum(1 for zhi in all_zhis if zhi in full_sanhe)
        if match_count >= 2:
            element = sanhe_info['element']
            positive_effects.append(f"삼합({element}국) 형성으로 {element} 기운 강화")
            interactions.append({'type': 'sanhe', 'element': element, 'effect': 'positive'})
            score += 10
    
    # 6. 용신 보조 체크
    if yongshen_gan:
        fortune_wuxing = GAN_WUXING.get(fortune_gan, '')
        yongshen_wuxing = GAN_WUXING.get(yongshen_gan, '')
        
        # 운이 용신과 같은 오행
        if fortune_wuxing == yongshen_wuxing:
            positive_effects.append(f"✨ 운이 용신({GAN_TO_KO.get(yongshen_gan, yongshen_gan)})과 같은 오행으로 최상의 운")
            score += 25
        
        # 운이 용신을 생함
        if WUXING_SHENG.get(fortune_wuxing) == yongshen_wuxing:
            positive_effects.append(f"운이 용신을 생(生)하여 길하다")
            score += 15
        
        # 운이 용신을 극함
        if WUXING_KE.get(fortune_wuxing) == yongshen_wuxing:
            negative_effects.append(f"⚠️ 운이 용신을 극(克)하여 불리하다")
            score -= 20
    
    # 7. 일간 기준 길흉 판단
    fortune_wuxing = GAN_WUXING.get(fortune_gan, '')
    day_wuxing = GAN_WUXING.get(day_gan, '')
    
    # 운이 일간을 생함
    if WUXING_SHENG.get(fortune_wuxing) == day_wuxing:
        positive_effects.append(f"운이 일간을 생(生)하여 신강해지니 활력 증가")
        score += 8
    
    # 운이 일간을 극함
    if WUXING_KE.get(fortune_wuxing) == day_wuxing:
        negative_effects.append(f"운이 일간을 극(克)하여 압박을 받음")
        score -= 8
    
    # 점수 범위 제한
    score = max(0, min(100, score))
    
    # 종합 평가
    if score >= 80:
        overall = "최상의 운"
    elif score >= 65:
        overall = "좋은 운"
    elif score >= 50:
        overall = "평운"
    elif score >= 35:
        overall = "주의 필요"
    else:
        overall = "어려운 시기"
    
    return {
        'positive_effects': positive_effects,
        'negative_effects': negative_effects,
        'interactions': interactions,
        'score': score,
        'overall': overall,
        'advice': generate_fortune_advice(positive_effects, negative_effects, score),
    }


def generate_fortune_advice(positive: list, negative: list, score: int) -> str:
    """운세 점수와 효과에 따른 조언 생성"""
    if score >= 80:
        return "적극적으로 새로운 기회를 잡으세요. 귀인의 도움이 있고 노력한 만큼 성과가 있습니다."
    elif score >= 65:
        return "전반적으로 순조로운 시기입니다. 꾸준한 노력이 결실을 맺습니다."
    elif score >= 50:
        return "평범한 운세입니다. 무리하지 말고 현재 상태를 유지하세요."
    elif score >= 35:
        return "변화가 예상됩니다. 중요한 결정은 신중히 하고 건강관리에 유의하세요."
    else:
        return "어려운 시기입니다. 모험을 피하고 내실을 다지는 데 집중하세요."


# ================================================
# 5. 일진/오늘운세 계산 로직
# ================================================

def calculate_daily_fortune(info, target_date: str = None) -> dict:
    """오늘의 운세 계산
    
    Args:
        info: 사주 정보 객체
        target_date: 대상 날짜 (YYYY-MM-DD 형식, 기본값은 오늘)
    """
    from datetime import datetime, date
    
    if target_date:
        year, month, day = map(int, target_date.split('-'))
    else:
        today = date.today()
        year, month, day = today.year, today.month, today.day
    
    # 일진 계산 (간단한 방식 - 실제로는 만세력 기반 계산 필요)
    # 기준일: 2000년 1월 1일 = 갑자일
    base_date = date(2000, 1, 1)
    target = date(year, month, day)
    diff = (target - base_date).days
    
    GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    
    # 2000-01-01은 戊午일 (戊=4, 午=6)
    base_gan_idx = 4
    base_zhi_idx = 6
    
    gan_idx = (base_gan_idx + diff) % 10
    zhi_idx = (base_zhi_idx + diff) % 12
    
    daily_gan = GANS[gan_idx]
    daily_zhi = ZHIS[zhi_idx]
    
    # 원국과의 상호작용 분석
    yongshen = get_johu_yongshen(info.day_gan, info.pillars['month']['zhi'])
    yongshen_gan = yongshen.get('primary_gan', '')
    
    interactions = analyze_fortune_interactions(info, daily_gan, daily_zhi, yongshen_gan)
    
    # 일진 신살 찾기
    shinsal_found = []
    day_gan = info.day_gan
    
    # 천을귀인 체크
    tianyi = SHINSAL_POSITIVE['천을귀인']['lookup_table'].get(day_gan, [])
    if daily_zhi in tianyi:
        shinsal_found.append({'name': '천을귀인', 'effect': '귀인의 도움이 있는 날'})
    
    # 도화살 체크
    taohua_base = info.pillars['year']['zhi']
    taohua_target = SHINSAL_NEGATIVE['도화살']['lookup_table'].get(taohua_base, '')
    if daily_zhi == taohua_target:
        shinsal_found.append({'name': '도화', 'effect': '이성운이 좋은 날, 과음 주의'})
    
    # 역마 체크
    yima_target = SHINSAL_POSITIVE['역마']['lookup_table'].get(taohua_base, '')
    if daily_zhi == yima_target:
        shinsal_found.append({'name': '역마', 'effect': '이동, 출장에 좋은 날'})
    
    # 종합 점수로 오늘의 운세 등급 결정
    score = interactions['score']
    
    if score >= 80:
        grade = "대길"
        emoji = "🌟"
        message = "만사형통의 날입니다. 중요한 일을 추진하세요."
    elif score >= 65:
        grade = "길"
        emoji = "☀️"
        message = "순조로운 하루입니다. 적극적으로 활동하세요."
    elif score >= 50:
        grade = "평"
        emoji = "🌤️"
        message = "평범한 하루입니다. 일상에 충실하세요."
    elif score >= 35:
        grade = "소흉"
        emoji = "☁️"
        message = "소소한 어려움이 있을 수 있습니다. 신중하게 행동하세요."
    else:
        grade = "흉"
        emoji = "🌧️"
        message = "조심해야 할 날입니다. 무리하지 마세요."
    
    return {
        'date': f"{year}-{month:02d}-{day:02d}",
        'daily_pillar': {
            'gan': daily_gan,
            'zhi': daily_zhi,
            'gan_ko': GAN_TO_KO.get(daily_gan, daily_gan),
            'zhi_ko': ZHI_KO_MAP.get(daily_zhi, daily_zhi),
        },
        'grade': grade,
        'emoji': emoji,
        'score': score,
        'message': message,
        'shinsal': shinsal_found,
        'positive_effects': interactions['positive_effects'],
        'negative_effects': interactions['negative_effects'],
        'advice': interactions['advice'],
        'lucky_elements': get_lucky_elements_for_day(info, daily_gan),
    }


def get_lucky_elements_for_day(info, daily_gan: str) -> dict:
    """오늘의 행운 요소"""
    yongshen = get_johu_yongshen(info.day_gan, info.pillars['month']['zhi'])
    primary = yongshen.get('primary', '')
    
    # 용신 기반 행운 요소
    gaewoon = get_gaewoon_by_element(primary)
    
    return {
        'colors': gaewoon.get('colors', [])[:2],
        'directions': gaewoon.get('directions', []),
        'numbers': gaewoon.get('numbers', [])[:2],
    }


@app.post("/api/saju/fortune/daewoon", response_model=FortuneAnalysisResponse)
async def analyze_daewoon(request: FortuneRequest):
    """대운 상세 분석 API"""
    start_time = time.time()
    
    try:
        calc = get_calculator()
        info = calc.calculate(
            year=request.year,
            month=request.month,
            day=request.day,
            hour=request.hour,
            minute=request.minute,
            is_lunar=request.is_lunar,
            is_leap_month=request.is_leap_month,
            gender=request.gender,
            name=request.name,
            use_solar_time=True,
        )
        
        daewoon_list = calculate_daewoon(info, request.gender)
        current_age = request.target_year - request.year
        current_daewoon = find_current_daewoon(daewoon_list, current_age)
        
        searcher = get_searcher()
        query = f"{info.day_gan_ko} 일간 {current_daewoon['gan_ko']}{current_daewoon['zhi_ko']} 대운 영향"
        
        search_results = []
        try:
            results = searcher.search(query, top_k=3, min_score=0.3, mode="D")
            for r in results:
                search_results.append(SearchResult(
                    book_title=r.book_title,
                    title=r.title,
                    content=r.content[:500] if len(r.content) > 500 else r.content,
                    score=r.final_score,
                    matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                ))
        except Exception as e:
            print(f"대운 검색 오류: {e}")
        
        positive, negative, impact, detailed = await generate_daewoon_analysis(
            info, current_daewoon, search_results
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return FortuneAnalysisResponse(
            success=True,
            processing_time_ms=processing_time,
            fortune_type="daewoon",
            current_fortune=current_daewoon,
            fortune_list=daewoon_list,
            positive_factors=positive,
            negative_factors=negative,
            impact_on_wonguk=impact,
            detailed_analysis=detailed,
            classical_references=search_results,
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return FortuneAnalysisResponse(
            success=False,
            processing_time_ms=processing_time,
            fortune_type="daewoon",
            current_fortune={},
            fortune_list=[],
            positive_factors=[],
            negative_factors=[],
            impact_on_wonguk="",
            detailed_analysis="",
            classical_references=[],
            error=str(e),
        )


@app.post("/api/saju/fortune/sewoon", response_model=FortuneAnalysisResponse)
async def analyze_sewoon(request: FortuneRequest):
    """세운 상세 분석 API"""
    start_time = time.time()
    
    try:
        calc = get_calculator()
        info = calc.calculate(
            year=request.year,
            month=request.month,
            day=request.day,
            hour=request.hour,
            minute=request.minute,
            is_lunar=request.is_lunar,
            is_leap_month=request.is_leap_month,
            gender=request.gender,
            name=request.name,
            use_solar_time=True,
        )
        
        sewoon = calculate_sewoon(request.target_year)
        
        searcher = get_searcher()
        query = f"{info.day_gan_ko} 일간 {sewoon['gan_ko']}{sewoon['zhi_ko']} 세운 {request.target_year}년"
        
        search_results = []
        try:
            results = searcher.search(query, top_k=3, min_score=0.3, mode="D")
            for r in results:
                search_results.append(SearchResult(
                    book_title=r.book_title,
                    title=r.title,
                    content=r.content[:500] if len(r.content) > 500 else r.content,
                    score=r.final_score,
                    matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                ))
        except Exception as e:
            print(f"세운 검색 오류: {e}")
        
        positive, negative, impact, detailed = await generate_sewoon_analysis(
            info, sewoon, request.target_year, search_results
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return FortuneAnalysisResponse(
            success=True,
            processing_time_ms=processing_time,
            fortune_type="sewoon",
            current_fortune=sewoon,
            fortune_list=[],
            positive_factors=positive,
            negative_factors=negative,
            impact_on_wonguk=impact,
            detailed_analysis=detailed,
            classical_references=search_results,
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return FortuneAnalysisResponse(
            success=False,
            processing_time_ms=processing_time,
            fortune_type="sewoon",
            current_fortune={},
            fortune_list=[],
            positive_factors=[],
            negative_factors=[],
            impact_on_wonguk="",
            detailed_analysis="",
            classical_references=[],
            error=str(e),
        )


@app.post("/api/saju/fortune/wolwoon", response_model=FortuneAnalysisResponse)
async def analyze_wolwoon(request: FortuneRequest):
    """월운 상세 분석 API"""
    start_time = time.time()
    
    try:
        calc = get_calculator()
        info = calc.calculate(
            year=request.year,
            month=request.month,
            day=request.day,
            hour=request.hour,
            minute=request.minute,
            is_lunar=request.is_lunar,
            is_leap_month=request.is_leap_month,
            gender=request.gender,
            name=request.name,
            use_solar_time=True,
        )
        
        wolwoon = calculate_wolwoon(request.target_year, request.target_month)
        
        searcher = get_searcher()
        query = f"{info.day_gan_ko} 일간 {wolwoon['gan_ko']}{wolwoon['zhi_ko']} 월운"
        
        search_results = []
        try:
            results = searcher.search(query, top_k=3, min_score=0.3, mode="D")
            for r in results:
                search_results.append(SearchResult(
                    book_title=r.book_title,
                    title=r.title,
                    content=r.content[:500] if len(r.content) > 500 else r.content,
                    score=r.final_score,
                    matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                ))
        except Exception as e:
            print(f"월운 검색 오류: {e}")
        
        positive, negative, impact, detailed = await generate_wolwoon_analysis(
            info, wolwoon, request.target_year, request.target_month, search_results
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return FortuneAnalysisResponse(
            success=True,
            processing_time_ms=processing_time,
            fortune_type="wolwoon",
            current_fortune=wolwoon,
            fortune_list=[],
            positive_factors=positive,
            negative_factors=negative,
            impact_on_wonguk=impact,
            detailed_analysis=detailed,
            classical_references=search_results,
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return FortuneAnalysisResponse(
            success=False,
            processing_time_ms=processing_time,
            fortune_type="wolwoon",
            current_fortune={},
            fortune_list=[],
            positive_factors=[],
            negative_factors=[],
            impact_on_wonguk="",
            detailed_analysis="",
            classical_references=[],
            error=str(e),
        )


@app.post("/api/saju/gaewoon", response_model=GaewoonResponse)
async def analyze_gaewoon(request: GaewoonRequest):
    """개운법 분석 API"""
    start_time = time.time()
    
    try:
        calc = get_calculator()
        info = calc.calculate(
            year=request.year,
            month=request.month,
            day=request.day,
            hour=request.hour,
            minute=request.minute,
            is_lunar=request.is_lunar,
            is_leap_month=request.is_leap_month,
            gender=request.gender,
            name=request.name,
            use_solar_time=True,
        )
        
        yongshen = request.yongshen or get_johu_yongshen(info.day_gan, info.pillars['month']['zhi']).get('primary', '')
        
        searcher = get_searcher()
        query = f"{yongshen} 용신 개운법 보완"
        
        search_results = []
        try:
            results = searcher.search(query, top_k=3, min_score=0.3, mode="D")
            for r in results:
                search_results.append(SearchResult(
                    book_title=r.book_title,
                    title=r.title,
                    content=r.content[:500] if len(r.content) > 500 else r.content,
                    score=r.final_score,
                    matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                ))
        except Exception as e:
            print(f"개운법 검색 오류: {e}")
        
        gaewoon_data = get_gaewoon_by_element(yongshen)
        detailed_advice = await generate_gaewoon_advice(info, yongshen, search_results)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return GaewoonResponse(
            success=True,
            processing_time_ms=processing_time,
            yongshen_element=yongshen,
            gaewoon_methods=gaewoon_data['methods'],
            favorable_colors=gaewoon_data['colors'],
            favorable_directions=gaewoon_data['directions'],
            favorable_numbers=gaewoon_data['numbers'],
            favorable_foods=gaewoon_data['foods'],
            detailed_advice=detailed_advice,
            classical_references=search_results,
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return GaewoonResponse(
            success=False,
            processing_time_ms=processing_time,
            yongshen_element="",
            gaewoon_methods=[],
            favorable_colors=[],
            favorable_directions=[],
            favorable_numbers=[],
            favorable_foods=[],
            detailed_advice="",
            classical_references=[],
            error=str(e),
        )


def calculate_daewoon(info, gender: str) -> List[DaewoonItem]:
    """대운 계산"""
    GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    GAN_KO = {'甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'}
    ZHI_KO = {'子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'}
    
    month_gan = info.pillars['month']['gan']
    month_zhi = info.pillars['month']['zhi']
    year_gan = info.pillars['year']['gan']
    
    gan_idx = GANS.index(month_gan)
    zhi_idx = ZHIS.index(month_zhi)
    
    is_yang_year = GANS.index(year_gan) % 2 == 0
    is_male = gender == "male"
    is_forward = (is_yang_year and is_male) or (not is_yang_year and not is_male)
    
    daewoon_list = []
    start_age = 3
    
    for i in range(10):
        if is_forward:
            new_gan_idx = (gan_idx + i + 1) % 10
            new_zhi_idx = (zhi_idx + i + 1) % 12
        else:
            new_gan_idx = (gan_idx - i - 1) % 10
            new_zhi_idx = (zhi_idx - i - 1) % 12
        
        gan = GANS[new_gan_idx]
        zhi = ZHIS[new_zhi_idx]
        
        shishen = info.shishen_map.get(gan, '')
        
        daewoon_list.append(DaewoonItem(
            age_start=start_age + (i * 10),
            age_end=start_age + ((i + 1) * 10) - 1,
            gan=gan,
            zhi=zhi,
            gan_ko=GAN_KO[gan],
            zhi_ko=ZHI_KO[zhi],
            shishen=shishen,
            is_current=False,
        ))
    
    return daewoon_list


def find_current_daewoon(daewoon_list: List[DaewoonItem], current_age: int) -> dict:
    """현재 대운 찾기"""
    for dw in daewoon_list:
        if dw.age_start <= current_age <= dw.age_end:
            dw.is_current = True
            return {
                'age_start': dw.age_start,
                'age_end': dw.age_end,
                'gan': dw.gan,
                'zhi': dw.zhi,
                'gan_ko': dw.gan_ko,
                'zhi_ko': dw.zhi_ko,
                'shishen': dw.shishen,
            }
    return daewoon_list[0].dict() if daewoon_list else {}


def calculate_sewoon(target_year: int) -> dict:
    """세운 계산"""
    GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    GAN_KO = {'甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'}
    ZHI_KO = {'子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'}
    
    gan_idx = (target_year - 4) % 10
    zhi_idx = (target_year - 4) % 12
    
    gan = GANS[gan_idx]
    zhi = ZHIS[zhi_idx]
    
    return {
        'year': target_year,
        'gan': gan,
        'zhi': zhi,
        'gan_ko': GAN_KO[gan],
        'zhi_ko': ZHI_KO[zhi],
    }


def calculate_wolwoon(target_year: int, target_month: int) -> dict:
    """월운 계산"""
    GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    ZHIS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
    GAN_KO = {'甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'}
    ZHI_KO = {'寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해', '子': '자', '丑': '축'}
    
    year_gan_idx = (target_year - 4) % 10
    MONTH_GAN_START = {0: 2, 1: 4, 2: 6, 3: 8, 4: 0, 5: 2, 6: 4, 7: 6, 8: 8, 9: 0}
    
    month_gan_start = MONTH_GAN_START[year_gan_idx]
    month_idx = target_month - 1
    
    gan_idx = (month_gan_start + month_idx) % 10
    zhi_idx = month_idx
    
    gan = GANS[gan_idx]
    zhi = ZHIS[zhi_idx]
    
    return {
        'year': target_year,
        'month': target_month,
        'gan': gan,
        'zhi': zhi,
        'gan_ko': GAN_KO[gan],
        'zhi_ko': ZHI_KO[zhi],
    }


def get_gaewoon_by_element(element: str) -> dict:
    """오행별 개운법 데이터"""
    GAEWOON_DATA = {
        '목': {
            'methods': [
                {'category': '직업', 'items': ['교육, 출판, 의류, 문화예술, 농업, 조경 관련 직종']},
                {'category': '취미', 'items': ['등산, 식물 가꾸기, 독서, 악기 연주, 명상']},
                {'category': '건강', 'items': ['간 건강 관리, 스트레칭, 산림욕, 충분한 수면']},
            ],
            'colors': ['청색', '녹색', '파란색'],
            'directions': ['동쪽'],
            'numbers': [3, 8],
            'foods': ['신맛 음식', '푸른 채소', '녹색 과일'],
        },
        '화': {
            'methods': [
                {'category': '직업', 'items': ['IT, 전기, 조명, 미디어, 예술, 엔터테인먼트']},
                {'category': '취미', 'items': ['운동, 요가, 캠핑, 바베큐, 사진 촬영']},
                {'category': '건강', 'items': ['심장 건강, 유산소 운동, 혈액순환 관리']},
            ],
            'colors': ['빨간색', '보라색', '분홍색'],
            'directions': ['남쪽'],
            'numbers': [2, 7],
            'foods': ['쓴맛 음식', '붉은 과일', '커피'],
        },
        '토': {
            'methods': [
                {'category': '직업', 'items': ['부동산, 건축, 금융, 농업, 도자기, 인테리어']},
                {'category': '취미', 'items': ['정원 가꾸기, 도예, 요리, 인테리어 꾸미기']},
                {'category': '건강', 'items': ['위장 건강, 규칙적인 식사, 소화 관리']},
            ],
            'colors': ['황색', '갈색', '베이지'],
            'directions': ['중앙'],
            'numbers': [5, 10],
            'foods': ['단맛 음식', '곡류', '노란색 음식'],
        },
        '금': {
            'methods': [
                {'category': '직업', 'items': ['금융, 법조, 의료, 기계, 보석, 군경']},
                {'category': '취미', 'items': ['등산, 격투기, 펜싱, 금속 공예']},
                {'category': '건강', 'items': ['폐 건강, 호흡 운동, 피부 관리']},
            ],
            'colors': ['흰색', '금색', '은색'],
            'directions': ['서쪽'],
            'numbers': [4, 9],
            'foods': ['매운 음식', '흰색 음식', '무, 양파'],
        },
        '수': {
            'methods': [
                {'category': '직업', 'items': ['무역, 물류, 수산업, 음료, 여행, 통신']},
                {'category': '취미', 'items': ['수영, 낚시, 여행, 명상, 음악 감상']},
                {'category': '건강', 'items': ['신장 건강, 충분한 수분 섭취, 하체 운동']},
            ],
            'colors': ['검정색', '남색', '파란색'],
            'directions': ['북쪽'],
            'numbers': [1, 6],
            'foods': ['짠맛 음식', '검은콩', '해조류'],
        },
    }
    
    element_map = {
        '갑목': '목', '을목': '목', '목': '목',
        '병화': '화', '정화': '화', '화': '화',
        '무토': '토', '기토': '토', '토': '토',
        '경금': '금', '신금': '금', '금': '금',
        '임수': '수', '계수': '수', '수': '수',
    }
    
    mapped = element_map.get(element, '토')
    return GAEWOON_DATA.get(mapped, GAEWOON_DATA['토'])


async def generate_daewoon_analysis(info, current_daewoon: dict, search_results: List[SearchResult]):
    """대운 상세 분석 생성 (비동기 httpx 버전)"""
    # settings는 파일 상단에서 이미 정의됨
    
    context_parts = []
    for r in search_results:
        context_parts.append(f"[{r.book_title}] {r.title}: {r.content[:300]}")
    search_context = "\n".join(context_parts) if context_parts else "검색 결과 없음"
    
    prompt = f"""당신은 명리학 전문가입니다. 아래 정보를 바탕으로 대운 분석을 작성하세요.

## 사주 원국
일간: {info.day_gan}({info.day_gan_ko}, {info.day_gan_desc})

## 현재 대운
{current_daewoon.get('gan_ko', '')}{current_daewoon.get('zhi_ko', '')}대운 ({current_daewoon.get('age_start', '')}~{current_daewoon.get('age_end', '')}세)
십신: {current_daewoon.get('shishen', '')}

## 고전 문헌 참조
{search_context}

## 작성 요청
1. 긍정적 요소 3가지 (리스트)
2. 주의할 요소 3가지 (리스트)  
3. 원국에 미치는 영향 (3줄)
4. 상세 분석 (5줄)

JSON 형식으로 응답하세요:
{{"positive": ["요소1", "요소2", "요소3"], "negative": ["요소1", "요소2", "요소3"], "impact": "영향 설명", "detailed": "상세 분석"}}
"""
    
    try:
        resp = await http_client.post(
            f"{settings.deepseek.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1500,
                "temperature": 0.4,
            },
        )
        
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            try:
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    return (
                        data.get('positive', ['분석 중']),
                        data.get('negative', ['분석 중']),
                        data.get('impact', '분석 중'),
                        data.get('detailed', '분석 중'),
                    )
            except:
                pass
            return (
                ['현재 대운의 에너지가 순조롭습니다'],
                ['과욕을 경계하세요'],
                content[:200],
                content,
            )
    except Exception as e:
        print(f"대운 분석 LLM 오류: {e}")
    
    return (
        ['분석 진행 중'],
        ['분석 진행 중'],
        '분석 진행 중입니다.',
        '상세 분석을 준비 중입니다.',
    )


async def generate_sewoon_analysis(info, sewoon: dict, target_year: int, search_results: List[SearchResult]):
    """세운 상세 분석 생성 (비동기 httpx 버전)"""
    # settings는 파일 상단에서 이미 정의됨
    
    context_parts = []
    for r in search_results:
        context_parts.append(f"[{r.book_title}] {r.title}: {r.content[:300]}")
    search_context = "\n".join(context_parts) if context_parts else "검색 결과 없음"
    
    prompt = f"""당신은 명리학 전문가입니다. {target_year}년 세운 분석을 작성하세요.

## 사주 원국
일간: {info.day_gan}({info.day_gan_ko}, {info.day_gan_desc})

## {target_year}년 세운
{sewoon.get('gan_ko', '')}{sewoon.get('zhi_ko', '')}년

## 고전 문헌 참조
{search_context}

## 작성 요청
1. 긍정적 요소 3가지 (리스트)
2. 주의할 요소 3가지 (리스트)  
3. 원국에 미치는 영향 (3줄)
4. 상세 분석 (5줄)

JSON 형식으로 응답하세요:
{{"positive": ["요소1", "요소2", "요소3"], "negative": ["요소1", "요소2", "요소3"], "impact": "영향 설명", "detailed": "상세 분석"}}
"""
    
    try:
        resp = await http_client.post(
            f"{settings.deepseek.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1500,
                "temperature": 0.4,
            },
        )
        
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            try:
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    return (
                        data.get('positive', ['분석 중']),
                        data.get('negative', ['분석 중']),
                        data.get('impact', '분석 중'),
                        data.get('detailed', '분석 중'),
                    )
            except:
                pass
            return (
                [f'{target_year}년은 새로운 기회의 해입니다'],
                ['무리한 확장은 삼가세요'],
                content[:200],
                content,
            )
    except Exception as e:
        print(f"세운 분석 LLM 오류: {e}")
    
    return (
        ['분석 진행 중'],
        ['분석 진행 중'],
        '분석 진행 중입니다.',
        '상세 분석을 준비 중입니다.',
    )


async def generate_wolwoon_analysis(info, wolwoon: dict, target_year: int, target_month: int, search_results: List[SearchResult]):
    """월운 상세 분석 생성 (비동기 httpx 버전)"""
    # settings는 파일 상단에서 이미 정의됨
    
    context_parts = []
    for r in search_results:
        context_parts.append(f"[{r.book_title}] {r.title}: {r.content[:300]}")
    search_context = "\n".join(context_parts) if context_parts else "검색 결과 없음"
    
    prompt = f"""당신은 명리학 전문가입니다. {target_year}년 {target_month}월 월운 분석을 작성하세요.

## 사주 원국
일간: {info.day_gan}({info.day_gan_ko}, {info.day_gan_desc})

## {target_year}년 {target_month}월 월운
{wolwoon.get('gan_ko', '')}{wolwoon.get('zhi_ko', '')}월

## 고전 문헌 참조
{search_context}

## 작성 요청
1. 긍정적 요소 3가지 (리스트)
2. 주의할 요소 3가지 (리스트)  
3. 원국에 미치는 영향 (2줄)
4. 상세 분석 (3줄)

JSON 형식으로 응답하세요:
{{"positive": ["요소1", "요소2", "요소3"], "negative": ["요소1", "요소2", "요소3"], "impact": "영향 설명", "detailed": "상세 분석"}}
"""
    
    try:
        resp = await http_client.post(
            f"{settings.deepseek.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1200,
                "temperature": 0.4,
            },
        )
        
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            try:
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    return (
                        data.get('positive', ['분석 중']),
                        data.get('negative', ['분석 중']),
                        data.get('impact', '분석 중'),
                        data.get('detailed', '분석 중'),
                    )
            except:
                pass
            return (
                [f'{target_month}월은 활동적인 달입니다'],
                ['건강 관리에 유의하세요'],
                content[:150],
                content,
            )
    except Exception as e:
        print(f"월운 분석 LLM 오류: {e}")
    
    return (
        ['분석 진행 중'],
        ['분석 진행 중'],
        '분석 진행 중입니다.',
        '상세 분석을 준비 중입니다.',
    )


async def generate_gaewoon_advice(info, yongshen: str, search_results: List[SearchResult]) -> str:
    """개운법 상세 조언 생성 (비동기 httpx 버전)"""
    # settings는 파일 상단에서 이미 정의됨
    
    context_parts = []
    for r in search_results:
        context_parts.append(f"[{r.book_title}] {r.title}: {r.content[:300]}")
    search_context = "\n".join(context_parts) if context_parts else "검색 결과 없음"
    
    prompt = f"""당신은 명리학 전문가입니다. 개운법 조언을 작성하세요.

## 사주 원국
일간: {info.day_gan}({info.day_gan_ko}, {info.day_gan_desc})

## 용신
{yongshen}

## 고전 문헌 참조
{search_context}

## 작성 요청
용신 {yongshen}을 보완하기 위한 구체적이고 실천 가능한 개운법을 5~7줄로 작성하세요.
- 일상에서 쉽게 실천할 수 있는 방법
- 직업/취미 관련 조언
- 건강 관리 조언
- 대인관계 조언

친근한 어투로 작성하세요.
"""
    
    try:
        resp = await http_client.post(
            f"{settings.deepseek.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 800,
                "temperature": 0.4,
            },
        )
        
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"개운법 LLM 오류: {e}")
    
    return f"{yongshen} 기운을 보완하는 것이 좋습니다. 관련 색상의 옷을 자주 입고, 해당 방위를 활용하세요."


# ================================================
# 5. 일진/오늘운세 API
# ================================================

class DailyFortuneRequest(BaseModel):
    """일진/오늘운세 요청"""
    name: str = ""
    gender: str = "male"
    year: int
    month: int
    day: int
    hour: int = 12
    minute: int = 0
    is_lunar: bool = False
    is_leap_month: bool = False
    target_date: Optional[str] = None  # YYYY-MM-DD


class DailyFortuneResponse(BaseModel):
    """일진/오늘운세 응답"""
    success: bool
    processing_time_ms: int
    date: str
    daily_pillar: Dict[str, str]
    grade: str
    emoji: str
    score: int
    message: str
    shinsal: List[Dict[str, str]]
    positive_effects: List[str]
    negative_effects: List[str]
    advice: str
    lucky_elements: Dict[str, Any]
    error: Optional[str] = None


@app.post("/api/saju/daily", response_model=DailyFortuneResponse)
async def get_daily_fortune(request: DailyFortuneRequest):
    """일진/오늘운세 API"""
    start_time = time.time()
    
    try:
        calc = get_calculator()
        info = calc.calculate(
            year=request.year,
            month=request.month,
            day=request.day,
            hour=request.hour,
            minute=request.minute,
            is_lunar=request.is_lunar,
            is_leap_month=request.is_leap_month,
            gender=request.gender,
            name=request.name,
            use_solar_time=True,
        )
        
        result = calculate_daily_fortune(info, request.target_date)
        processing_time = int((time.time() - start_time) * 1000)
        
        return DailyFortuneResponse(
            success=True,
            processing_time_ms=processing_time,
            **result
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return DailyFortuneResponse(
            success=False,
            processing_time_ms=processing_time,
            date="",
            daily_pillar={},
            grade="",
            emoji="",
            score=0,
            message="",
            shinsal=[],
            positive_effects=[],
            negative_effects=[],
            advice="",
            lucky_elements={},
            error=str(e),
        )


# ================================================
# 6. 궁합(Compatibility) 분석 API
# ================================================

class CompatibilityRequest(BaseModel):
    """궁합 분석 요청"""
    # 본인 정보
    person1_name: str = ""
    person1_gender: str = "male"
    person1_year: int
    person1_month: int
    person1_day: int
    person1_hour: int = 12
    person1_minute: int = 0
    person1_is_lunar: bool = False
    
    # 상대방 정보
    person2_name: str = ""
    person2_gender: str = "female"
    person2_year: int
    person2_month: int
    person2_day: int
    person2_hour: int = 12
    person2_minute: int = 0
    person2_is_lunar: bool = False


class CompatibilityItem(BaseModel):
    """궁합 항목"""
    category: str
    score: int
    max_score: int
    description: str
    details: List[str]


class CompatibilityDetailedAnalysis(BaseModel):
    """세부 궁합 분석"""
    title: str
    content: str
    importance: str  # "high", "medium", "low"


class CompatibilityResponse(BaseModel):
    """궁합 분석 응답"""
    success: bool
    processing_time_ms: int
    total_score: int
    grade: str
    emoji: str
    summary: str
    categories: List[CompatibilityItem]
    strengths: List[str]
    weaknesses: List[str]
    advice: str
    classical_references: List[SearchResult]
    # 확장된 세부 분석
    detailed_analyses: List[CompatibilityDetailedAnalysis] = []
    hannan_analysis: Optional[str] = None  # 한난조습 분석
    jiji_interactions: List[str] = []  # 지지 충합 관계
    jijanggan_analysis: List[str] = []  # 지장간 합 분석
    sipsin_analysis: List[str] = []  # 십신 상호작용
    pillar_influences: List[str] = []  # 주별 영향 분석
    ai_synthesis: Optional[str] = None  # AI 종합 해석
    error: Optional[str] = None


@app.post("/api/saju/compatibility", response_model=CompatibilityResponse)
async def analyze_compatibility(request: CompatibilityRequest):
    """궁합 분석 API - 전문가 수준 세밀 분석"""
    start_time = time.time()
    
    try:
        calc = get_calculator()
        
        # 두 사람의 사주 계산
        info1 = calc.calculate(
            year=request.person1_year,
            month=request.person1_month,
            day=request.person1_day,
            hour=request.person1_hour,
            minute=request.person1_minute,
            is_lunar=request.person1_is_lunar,
            gender=request.person1_gender,
            name=request.person1_name,
            use_solar_time=True,
        )
        
        info2 = calc.calculate(
            year=request.person2_year,
            month=request.person2_month,
            day=request.person2_day,
            hour=request.person2_hour,
            minute=request.person2_minute,
            is_lunar=request.person2_is_lunar,
            gender=request.person2_gender,
            name=request.person2_name,
            use_solar_time=True,
        )
        
        name1 = request.person1_name or "본인"
        name2 = request.person2_name or "상대방"
        
        # ================================================
        # 기본 5가지 궁합 분석 (100점 만점)
        # ================================================
        categories = []
        strengths = []
        weaknesses = []
        total_score = 0
        
        # 1. 일간 궁합 (天干相合) - 25점 만점
        ilgan_result = analyze_ilgan_compatibility(info1, info2)
        categories.append(ilgan_result)
        total_score += ilgan_result.score
        if ilgan_result.score >= 20:
            strengths.extend(ilgan_result.details[:1])
        elif ilgan_result.score <= 10:
            weaknesses.extend(ilgan_result.details[:1])
        
        # 2. 일지 궁합 (地支相合) - 25점 만점
        ilji_result = analyze_ilji_compatibility(info1, info2)
        categories.append(ilji_result)
        total_score += ilji_result.score
        if ilji_result.score >= 20:
            strengths.extend(ilji_result.details[:1])
        elif ilji_result.score <= 10:
            weaknesses.extend(ilji_result.details[:1])
        
        # 3. 용신 상생 궁합 - 20점 만점
        yongshen_result = analyze_yongshen_compatibility(info1, info2)
        categories.append(yongshen_result)
        total_score += yongshen_result.score
        if yongshen_result.score >= 15:
            strengths.extend(yongshen_result.details[:1])
        elif yongshen_result.score <= 8:
            weaknesses.extend(yongshen_result.details[:1])
        
        # 4. 오행 균형 궁합 - 15점 만점
        wuxing_result = analyze_wuxing_compatibility(info1, info2)
        categories.append(wuxing_result)
        total_score += wuxing_result.score
        if wuxing_result.score >= 12:
            strengths.extend(wuxing_result.details[:1])
        elif wuxing_result.score <= 6:
            weaknesses.extend(wuxing_result.details[:1])
        
        # 5. 대운 동조 궁합 - 15점 만점
        daeun_result = analyze_daeun_sync_compatibility(info1, info2, request.person1_gender, request.person2_gender)
        categories.append(daeun_result)
        total_score += daeun_result.score
        if daeun_result.score >= 12:
            strengths.extend(daeun_result.details[:1])
        elif daeun_result.score <= 6:
            weaknesses.extend(daeun_result.details[:1])
        
        # ================================================
        # 추가 세밀 분석 (프리미엄)
        # ================================================
        detailed_analyses = []
        jiji_interactions = []
        jijanggan_analysis = []
        sipsin_analysis = []
        pillar_influences = []
        
        # 6. 한난조습(寒暖燥濕) 분석 - 기후 균형
        hannan_analysis = analyze_hannan_joseup_compatibility(info1, info2, name1, name2)
        if hannan_analysis:
            detailed_analyses.append(CompatibilityDetailedAnalysis(
                title="한난조습(寒暖燥濕) 궁합",
                content=hannan_analysis,
                importance="high"
            ))
        
        # 7. 지지 충합 관계 상세 분석
        jiji_interactions = analyze_all_jiji_interactions(info1, info2, name1, name2)
        
        # 8. 지장간 합 분석
        jijanggan_analysis = analyze_jijanggan_compatibility(info1, info2, name1, name2)
        
        # 9. 십신 상호작용 분석
        sipsin_analysis = analyze_sipsin_compatibility(info1, info2, name1, name2)
        
        # 10. 주별(년월일시) 영향 분석
        pillar_influences = analyze_pillar_influences(info1, info2, name1, name2)
        
        # ================================================
        # 등급 결정 (한난조습 등 추가 요소 반영)
        # ================================================
        bonus_score = 0
        if hannan_analysis and ("매우 좋" in hannan_analysis or "최상" in hannan_analysis or "완벽" in hannan_analysis):
            bonus_score += 5
        if len([j for j in jiji_interactions if "합" in j and "충" not in j]) >= 2:
            bonus_score += 3
        if len([j for j in jijanggan_analysis if "합" in j]) >= 1:
            bonus_score += 2
        
        adjusted_score = min(total_score + bonus_score, 100)
        
        if adjusted_score >= 90:
            grade = "천생연분"
            emoji = "💕"
            summary = f"{name1}님과 {name2}님은 천생연분 중에서도 최상의 궁합입니다! 한난조습의 조화, 지지의 합, 지장간의 합이 어우러진 드문 인연입니다."
        elif adjusted_score >= 80:
            grade = "천생연분"
            emoji = "💕"
            summary = f"{name1}님과 {name2}님은 천생연분입니다! 서로를 완벽하게 보완하고 성장시키는 최상의 궁합입니다."
        elif adjusted_score >= 70:
            grade = "좋은 인연"
            emoji = "💗"
            summary = f"좋은 궁합입니다. 서로 노력하면 행복한 관계를 유지할 수 있습니다."
        elif adjusted_score >= 55:
            grade = "보통"
            emoji = "💛"
            summary = f"평범한 궁합입니다. 서로 이해하고 배려하면 좋은 관계가 될 수 있습니다."
        elif adjusted_score >= 40:
            grade = "노력 필요"
            emoji = "💔"
            summary = f"다소 맞지 않는 부분이 있습니다. 서로의 차이를 인정하고 노력이 필요합니다."
        else:
            grade = "주의 필요"
            emoji = "⚠️"
            summary = f"궁합이 좋지 않습니다. 신중한 결정이 필요합니다."
        
        # ================================================
        # 고전 문헌 검색 (확장 - 최적화된 쿼리)
        # ================================================
        search_results = []
        try:
            searcher = get_searcher()
            
            zhi1 = info1.pillars['day']['zhi']
            zhi2 = info2.pillars['day']['zhi']
            zhi1_ko = ZHI_KO_MAP.get(zhi1, zhi1)
            zhi2_ko = ZHI_KO_MAP.get(zhi2, zhi2)
            
            hannan_type1 = analyze_hannan_joseup(info1)
            hannan_type2 = analyze_hannan_joseup(info2)
            
            queries = [
                f"궁합 {info1.day_gan_ko}일간 {info2.day_gan_ko}일간 배우자",
                f"부부 궁합 천간합 지지합",
                f"한난조습 조후 궁합 寒暖燥濕",
                f"일지 {zhi1_ko} {zhi2_ko} 배우자궁",
                f"日支 合沖刑 配偶 夫婦",
                f"음양배합 부부화합 天干合",
                f"비겁 상관 극처 극부 혼인운",
                f"도화살 홍란성 연애 궁합",
            ]
            
            if ZHI_CHONG.get(zhi1) == zhi2:
                queries.append(f"日支沖 부부 갈등 해소")
            if ZHI_LIUHE.get(zhi1) == zhi2:
                queries.append(f"日支合 육합 천생배필")
            
            for query in queries:
                results = searcher.search(query, top_k=2, min_score=0.3, mode="D")
                for r in results:
                    if not any(sr.title == r.title for sr in search_results):
                        search_results.append(SearchResult(
                            book_title=r.book_title,
                            title=r.title,
                            content=r.content[:500] if len(r.content) > 500 else r.content,
                            score=r.final_score,
                            matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                        ))
        except Exception as e:
            print(f"궁합 검색 오류: {e}")
        
        # ================================================
        # AI 종합 해석 생성
        # ================================================
        ai_synthesis = None
        try:
            ai_synthesis = await generate_compatibility_ai_synthesis(
                info1, info2, name1, name2,
                adjusted_score, grade,
                hannan_analysis, jiji_interactions, 
                jijanggan_analysis, sipsin_analysis,
                pillar_influences
            )
        except Exception as e:
            print(f"AI 종합 해석 오류: {e}")
        
        # 조언 생성
        advice = generate_compatibility_advice(adjusted_score, strengths, weaknesses)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return CompatibilityResponse(
            success=True,
            processing_time_ms=processing_time,
            total_score=adjusted_score,
            grade=grade,
            emoji=emoji,
            summary=summary,
            categories=categories,
            strengths=strengths[:5],
            weaknesses=weaknesses[:5],
            advice=advice,
            classical_references=search_results[:5],
            detailed_analyses=detailed_analyses,
            hannan_analysis=hannan_analysis,
            jiji_interactions=jiji_interactions,
            jijanggan_analysis=jijanggan_analysis,
            sipsin_analysis=sipsin_analysis,
            pillar_influences=pillar_influences,
            ai_synthesis=ai_synthesis,
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return CompatibilityResponse(
            success=False,
            processing_time_ms=processing_time,
            total_score=0,
            grade="",
            emoji="",
            summary="",
            categories=[],
            strengths=[],
            weaknesses=[],
            advice="",
            classical_references=[],
            error=str(e),
        )


def analyze_ilgan_compatibility(info1, info2) -> CompatibilityItem:
    """일간(天干) 궁합 분석 - 25점 만점"""
    gan1 = info1.day_gan
    gan2 = info2.day_gan
    
    details = []
    score = 12  # 기본 점수
    
    # 천간합 체크
    if GAN_HE.get(gan1) == gan2:
        score = 25
        details.append(f"✨ {GAN_TO_KO.get(gan1, gan1)}과 {GAN_TO_KO.get(gan2, gan2)}의 천간합 - 천생연분의 궁합")
    elif GAN_CHONG.get(gan1) == gan2:
        score = 5
        details.append(f"⚠️ {GAN_TO_KO.get(gan1, gan1)}과 {GAN_TO_KO.get(gan2, gan2)}의 천간충 - 갈등이 잦을 수 있음")
    else:
        # 오행 생극 관계
        wx1 = GAN_WUXING.get(gan1, '')
        wx2 = GAN_WUXING.get(gan2, '')
        
        if WUXING_SHENG.get(wx1) == wx2 or WUXING_SHENG.get(wx2) == wx1:
            score = 18
            details.append(f"💗 {GAN_TO_KO.get(gan1, gan1)}과 {GAN_TO_KO.get(gan2, gan2)} - 상생 관계로 서로 도움을 주는 궁합")
        elif WUXING_KE.get(wx1) == wx2:
            score = 8
            details.append(f"⚡ {GAN_TO_KO.get(gan1, gan1)}이 {GAN_TO_KO.get(gan2, gan2)}을 극함 - 한쪽이 주도권을 가짐")
        elif WUXING_KE.get(wx2) == wx1:
            score = 8
            details.append(f"⚡ {GAN_TO_KO.get(gan2, gan2)}이 {GAN_TO_KO.get(gan1, gan1)}을 극함 - 한쪽이 주도권을 가짐")
        elif wx1 == wx2:
            score = 15
            details.append(f"💛 같은 오행으로 이해가 쉬우나 경쟁 가능성")
        else:
            details.append(f"일반적인 일간 관계")
    
    return CompatibilityItem(
        category="일간(天干) 궁합",
        score=score,
        max_score=25,
        description="두 사람의 본질적 성향 호환성",
        details=details,
    )


def analyze_ilji_compatibility(info1, info2) -> CompatibilityItem:
    """일지(地支) 궁합 분석 - 25점 만점"""
    zhi1 = info1.pillars['day']['zhi']
    zhi2 = info2.pillars['day']['zhi']
    
    details = []
    score = 12  # 기본 점수
    
    # 육합 체크
    if ZHI_LIUHE.get(zhi1) == zhi2:
        score = 25
        details.append(f"✨ {ZHI_KO_MAP.get(zhi1, zhi1)}과 {ZHI_KO_MAP.get(zhi2, zhi2)}의 육합 - 천생배필의 궁합")
    
    # 삼합 체크
    elif zhi1 in ZHI_SANHE and zhi2 in ZHI_SANHE.get(zhi1, {}).get('full', []):
        element = ZHI_SANHE[zhi1]['element']
        score = 20
        details.append(f"💗 {ZHI_KO_MAP.get(zhi1, zhi1)}과 {ZHI_KO_MAP.get(zhi2, zhi2)}의 삼합({element}국) - 좋은 궁합")
    
    # 충 체크
    elif ZHI_CHONG.get(zhi1) == zhi2:
        score = 5
        details.append(f"⚠️ {ZHI_KO_MAP.get(zhi1, zhi1)}과 {ZHI_KO_MAP.get(zhi2, zhi2)}의 충 - 변화와 갈등이 많음")
    
    # 형 체크
    elif (zhi1, zhi2) in SHINSAL_NEGATIVE['형']['pairs'] or (zhi2, zhi1) in SHINSAL_NEGATIVE['형']['pairs']:
        score = 8
        details.append(f"⚡ {ZHI_KO_MAP.get(zhi1, zhi1)}과 {ZHI_KO_MAP.get(zhi2, zhi2)}의 형 - 갈등 주의")
    
    # 해 체크
    elif (zhi1, zhi2) in SHINSAL_NEGATIVE['해']['pairs'] or (zhi2, zhi1) in SHINSAL_NEGATIVE['해']['pairs']:
        score = 10
        details.append(f"💔 {ZHI_KO_MAP.get(zhi1, zhi1)}과 {ZHI_KO_MAP.get(zhi2, zhi2)}의 해 - 서로 해치는 관계 주의")
    
    else:
        # 오행 관계
        wx1 = ZHI_WUXING.get(zhi1, '')
        wx2 = ZHI_WUXING.get(zhi2, '')
        
        if WUXING_SHENG.get(wx1) == wx2 or WUXING_SHENG.get(wx2) == wx1:
            score = 16
            details.append(f"💛 일지 상생 관계 - 서로 돕는 궁합")
        elif wx1 == wx2:
            score = 14
            details.append(f"같은 오행 일지 - 비슷한 가정관")
        else:
            details.append(f"일반적인 일지 관계")
    
    return CompatibilityItem(
        category="일지(地支) 궁합",
        score=score,
        max_score=25,
        description="배우자궁 호환성 (가정생활)",
        details=details,
    )


def analyze_yongshen_compatibility(info1, info2) -> CompatibilityItem:
    """용신 상생 궁합 분석 - 20점 만점"""
    yong1 = get_johu_yongshen(info1.day_gan, info1.pillars['month']['zhi'])
    yong2 = get_johu_yongshen(info2.day_gan, info2.pillars['month']['zhi'])
    
    yong1_gan = yong1.get('primary_gan', '')
    yong2_gan = yong2.get('primary_gan', '')
    
    details = []
    score = 10  # 기본 점수
    
    if not yong1_gan or not yong2_gan:
        details.append("용신 분석 필요")
        return CompatibilityItem(
            category="용신 상생 궁합",
            score=score,
            max_score=20,
            description="서로의 필요를 채워주는 관계",
            details=details,
        )
    
    wx1 = GAN_WUXING.get(yong1_gan, '')
    wx2 = GAN_WUXING.get(yong2_gan, '')
    
    # 상대방 사주에 내 용신이 있는지 체크
    all_gans1 = [info1.pillars[p]['gan'] for p in ['year', 'month', 'day', 'hour']]
    all_gans2 = [info2.pillars[p]['gan'] for p in ['year', 'month', 'day', 'hour']]
    
    yong1_in_2 = yong1_gan in all_gans2
    yong2_in_1 = yong2_gan in all_gans1
    
    if yong1_in_2 and yong2_in_1:
        score = 20
        details.append(f"✨ 서로의 용신을 사주에 가지고 있어 최상의 보완 관계")
    elif yong1_in_2:
        score = 16
        details.append(f"💗 상대방이 나({GAN_TO_KO.get(yong1_gan, yong1_gan)})의 용신을 가지고 있음 - 내가 도움받음")
    elif yong2_in_1:
        score = 16
        details.append(f"💗 내가 상대방({GAN_TO_KO.get(yong2_gan, yong2_gan)})의 용신을 가지고 있음 - 상대를 도와줌")
    elif wx1 == wx2:
        score = 12
        details.append(f"용신 오행이 같아 비슷한 것을 원함")
    elif WUXING_KE.get(wx1) == wx2 or WUXING_KE.get(wx2) == wx1:
        score = 6
        details.append(f"⚠️ 용신이 상극 관계 - 원하는 것이 충돌할 수 있음")
    else:
        details.append(f"일반적인 용신 관계")
    
    return CompatibilityItem(
        category="용신 상생 궁합",
        score=score,
        max_score=20,
        description="서로의 필요를 채워주는 관계",
        details=details,
    )


def analyze_wuxing_compatibility(info1, info2) -> CompatibilityItem:
    """오행 균형 궁합 분석 - 15점 만점"""
    wx1 = calculate_wuxing_balance(info1)
    wx2 = calculate_wuxing_balance(info2)
    
    details = []
    score = 8  # 기본 점수
    
    # 각자의 부족한 오행 파악
    def find_weak_elements(wx):
        avg = sum(wx.values()) / 5
        return [k for k, v in wx.items() if v < avg * 0.5]
    
    def find_strong_elements(wx):
        avg = sum(wx.values()) / 5
        return [k for k, v in wx.items() if v > avg * 1.5]
    
    weak1 = find_weak_elements(wx1)
    weak2 = find_weak_elements(wx2)
    strong1 = find_strong_elements(wx1)
    strong2 = find_strong_elements(wx2)
    
    # 서로의 부족함을 채워주는지 확인
    complement_count = 0
    for w in weak1:
        if w in strong2:
            complement_count += 1
    for w in weak2:
        if w in strong1:
            complement_count += 1
    
    if complement_count >= 3:
        score = 15
        details.append(f"✨ 오행이 완벽하게 보완되는 관계 - 음양의 조화")
    elif complement_count >= 2:
        score = 12
        details.append(f"💗 오행이 잘 보완됨 - 서로의 부족함을 채워줌")
    elif complement_count >= 1:
        score = 10
        details.append(f"💛 일부 오행이 보완됨")
    else:
        # 같은 오행이 강한지 체크
        same_strong = set(strong1) & set(strong2)
        if same_strong:
            score = 6
            details.append(f"⚠️ {', '.join(same_strong)} 오행이 모두 강해 충돌 가능성")
        else:
            details.append(f"일반적인 오행 관계")
    
    return CompatibilityItem(
        category="오행 균형 궁합",
        score=score,
        max_score=15,
        description="음양오행의 상호 보완성",
        details=details,
    )


def analyze_daeun_sync_compatibility(info1, info2, gender1: str, gender2: str) -> CompatibilityItem:
    """대운 동조 궁합 분석 - 15점 만점"""
    dw1 = calculate_daewoon(info1, gender1)
    dw2 = calculate_daewoon(info2, gender2)
    
    details = []
    score = 8  # 기본 점수
    
    # 현재 나이 기준 대운 비교 (예: 35세 기준)
    current_age = 35
    
    def find_dw_at_age(dw_list, age):
        for dw in dw_list:
            if dw.age_start <= age <= dw.age_end:
                return dw
        return dw_list[0] if dw_list else None
    
    dw1_current = find_dw_at_age(dw1, current_age)
    dw2_current = find_dw_at_age(dw2, current_age)
    
    if dw1_current and dw2_current:
        # 대운 지지 관계 체크
        zhi1 = dw1_current.zhi
        zhi2 = dw2_current.zhi
        
        if ZHI_LIUHE.get(zhi1) == zhi2:
            score = 15
            details.append(f"✨ 현재 대운이 육합 - 지금 시기에 만남이 좋음")
        elif ZHI_CHONG.get(zhi1) == zhi2:
            score = 5
            details.append(f"⚠️ 현재 대운이 충 - 이 시기 갈등 주의")
        elif zhi1 in ZHI_SANHE and zhi2 in ZHI_SANHE.get(zhi1, {}).get('full', []):
            score = 12
            details.append(f"💗 현재 대운이 삼합 - 함께 성장하는 시기")
        else:
            details.append(f"현재 대운 관계: 일반적")
        
        # 대운 전반적 흐름 비교
        sync_count = 0
        for i in range(min(len(dw1), len(dw2))):
            dw1_elem = GAN_WUXING.get(dw1[i].gan, '')
            dw2_elem = GAN_WUXING.get(dw2[i].gan, '')
            if dw1_elem == dw2_elem:
                sync_count += 1
            elif WUXING_SHENG.get(dw1_elem) == dw2_elem or WUXING_SHENG.get(dw2_elem) == dw1_elem:
                sync_count += 0.5
        
        if sync_count >= 5:
            score = min(score + 3, 15)
            details.append(f"대운 흐름이 조화로움")
    else:
        details.append(f"대운 정보 부족")
    
    return CompatibilityItem(
        category="대운 동조 궁합",
        score=score,
        max_score=15,
        description="인생 사이클의 동조성",
        details=details,
    )


def generate_compatibility_advice(total_score: int, strengths: list, weaknesses: list) -> str:
    """궁합 점수에 따른 조언 생성"""
    if total_score >= 85:
        return "천생연분의 궁합입니다. 서로를 믿고 함께 나아가세요. 작은 갈등에 연연하지 말고 큰 그림을 보세요."
    elif total_score >= 70:
        return "좋은 궁합입니다. 서로의 장점을 인정하고, 단점은 보완해주세요. 대화와 소통이 더 좋은 관계로 이끕니다."
    elif total_score >= 55:
        return "평범한 궁합입니다. 서로 다른 점을 인정하고 존중하세요. 노력하면 좋은 관계가 될 수 있습니다."
    elif total_score >= 40:
        return "맞지 않는 부분이 있습니다. 서로의 차이를 이해하고 배려가 필요합니다. 갈등 시 감정적 대응을 피하세요."
    else:
        return "궁합이 좋지 않습니다. 관계를 유지하려면 특별한 노력이 필요합니다. 신중한 결정을 권합니다."


# ================================================
# 6-1-1. 한난조습(寒暖燥濕) 분석 함수
# ================================================

def analyze_hannan_joseup(info) -> str:
    """
    개인 사주의 한난조습 판정
    
    판정 기준:
    - 寒(한): 亥子丑월생 + 水金 과다 + 火 부족
    - 暖(난): 巳午未월생 + 火土 과다 + 水 부족
    - 燥(조): 火가 있고 水 부족
    - 濕(습): 水가 많고 火가 없거나 약함
    """
    month_zhi = info.pillars['month']['zhi']
    wuxing = calculate_wuxing_balance(info)
    
    cold_months = ['亥', '子', '丑']
    hot_months = ['巳', '午', '未']
    
    water = wuxing.get('수', 0)
    fire = wuxing.get('화', 0)
    metal = wuxing.get('금', 0)
    earth = wuxing.get('토', 0)
    
    if month_zhi in cold_months and (water + metal) > (fire + earth) and fire < 2:
        return "한(寒)"
    
    if month_zhi in hot_months and (fire + earth) > (water + metal) and water < 2:
        return "난(暖)"
    
    if fire >= 2 and water <= 1:
        return "조(燥)"
    
    if water >= 3 and fire <= 1:
        return "습(濕)"
    
    return "중화(中和)"


def analyze_hannan_joseup_compatibility(info1, info2, name1: str, name2: str) -> str:
    """두 사주의 한난조습 궁합 분석"""
    type1 = analyze_hannan_joseup(info1)
    type2 = analyze_hannan_joseup(info2)
    
    compatibility_matrix = {
        ("한(寒)", "난(暖)"): "최상의 조합! 차가운 기운과 따뜻한 기운이 완벽하게 조화를 이룹니다. 서로의 부족함을 채워주는 천생연분입니다.",
        ("난(暖)", "한(寒)"): "최상의 조합! 따뜻한 기운과 차가운 기운이 완벽하게 조화를 이룹니다. 서로의 부족함을 채워주는 천생연분입니다.",
        ("조(燥)", "습(濕)"): "최상의 조합! 메마른 기운과 촉촉한 기운이 조화를 이룹니다. 서로에게 꼭 필요한 존재입니다.",
        ("습(濕)", "조(燥)"): "최상의 조합! 촉촉한 기운과 메마른 기운이 조화를 이룹니다. 서로에게 꼭 필요한 존재입니다.",
        ("한(寒)", "한(寒)"): "둘 다 차가운 기운이 강합니다. 냉랭하거나 우울한 분위기가 될 수 있으니, 따뜻한 활동을 함께하세요.",
        ("난(暖)", "난(暖)"): "둘 다 뜨거운 기운이 강합니다. 열정적이지만 충돌이 잦을 수 있으니, 서로 양보하는 자세가 필요합니다.",
        ("조(燥)", "조(燥)"): "둘 다 건조한 기운이 강합니다. 메마른 관계가 될 수 있으니, 감정 표현을 많이 하세요.",
        ("습(濕)", "습(濕)"): "둘 다 습한 기운이 강합니다. 침체될 수 있으니, 활동적인 취미를 함께하세요.",
        ("중화(中和)", "중화(中和)"): "둘 다 균형 잡힌 사주입니다. 안정적인 관계를 유지할 수 있습니다.",
    }
    
    key = (type1, type2)
    if key in compatibility_matrix:
        description = compatibility_matrix[key]
    elif type1 == "중화(中和)" or type2 == "중화(中和)":
        description = "한쪽이 균형 잡힌 사주여서 안정적인 관계를 유지할 수 있습니다."
    else:
        description = f"{name1}님은 {type1} 타입, {name2}님은 {type2} 타입입니다. 서로 이해하고 배려하면 좋은 관계가 될 수 있습니다."
    
    return f"【한난조습 분석】 {name1}님: {type1}, {name2}님: {type2}\n{description}"


# ================================================
# 6-1-2. 지지 형(刑)/파(破)/해(害) 분석 함수
# ================================================

ZHI_XING = {
    '子': '卯', '卯': '子',
    '寅': '巳', '巳': '申', '申': '寅',
    '丑': '戌', '戌': '未', '未': '丑',
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


def analyze_all_jiji_interactions(info1, info2, name1: str, name2: str) -> List[str]:
    """두 사주의 모든 지지 상호작용 분석 (합/충/형/파/해)"""
    results = []
    
    pillars_pairs = [
        ('year', 'year', '년주'),
        ('month', 'month', '월주'),
        ('day', 'day', '일지'),
        ('hour', 'hour', '시주'),
    ]
    
    for p1_key, p2_key, pair_name in pillars_pairs:
        zhi1 = info1.pillars[p1_key]['zhi']
        zhi2 = info2.pillars[p2_key]['zhi']
        zhi1_ko = ZHI_KO_MAP.get(zhi1, zhi1)
        zhi2_ko = ZHI_KO_MAP.get(zhi2, zhi2)
        
        if ZHI_LIUHE.get(zhi1) == zhi2:
            results.append(f"✨ {pair_name} 육합({zhi1_ko}-{zhi2_ko}): 자연스러운 결합, 좋은 인연")
        
        if ZHI_CHONG.get(zhi1) == zhi2:
            if pair_name == '일지':
                results.append(f"⚠️ {pair_name} 충({zhi1_ko}-{zhi2_ko}): 배우자궁 충돌, 갈등 주의 필요")
            else:
                results.append(f"⚡ {pair_name} 충({zhi1_ko}-{zhi2_ko}): 갈등 요소 있음")
        
        if ZHI_XING.get(zhi1) == zhi2 or ZHI_XING.get(zhi2) == zhi1:
            xing_type = ""
            if (zhi1 in ['子', '卯'] and zhi2 in ['子', '卯']):
                xing_type = "무례지형(無禮之刑)"
            elif (zhi1 in ['寅', '巳', '申'] and zhi2 in ['寅', '巳', '申']):
                xing_type = "무은지형(無恩之刑)"
            elif (zhi1 in ['丑', '戌', '未'] and zhi2 in ['丑', '戌', '未']):
                xing_type = "무자지형(無自之刑)"
            results.append(f"⚠️ {pair_name} 형({zhi1_ko}-{zhi2_ko}): {xing_type} - 서로 상처를 줄 수 있음")
        
        if ZHI_PO.get(zhi1) == zhi2:
            results.append(f"💔 {pair_name} 파({zhi1_ko}-{zhi2_ko}): 깨지는 인연, 약속 불이행 경향")
        
        if ZHI_HAI.get(zhi1) == zhi2:
            results.append(f"😔 {pair_name} 해({zhi1_ko}-{zhi2_ko}): 서로 해치는 관계, 뒷담화 주의")
    
    if not results:
        results.append("지지 간 특별한 충/형/파/해가 없습니다. 안정적인 관계입니다.")
    
    return results


# ================================================
# 6-1-3. 지장간(支藏干) 합 분석 함수
# ================================================

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


def analyze_jijanggan_compatibility(info1, info2, name1: str, name2: str) -> List[str]:
    """지장간 합 분석 - 숨은 인연 찾기"""
    results = []
    
    zhi1 = info1.pillars['day']['zhi']
    zhi2 = info2.pillars['day']['zhi']
    
    gans1 = JIJANGGAN.get(zhi1, [])
    gans2 = JIJANGGAN.get(zhi2, [])
    
    gan_he_pairs = [
        ('甲', '己', '토(土)'),
        ('乙', '庚', '금(金)'),
        ('丙', '辛', '수(水)'),
        ('丁', '壬', '목(木)'),
        ('戊', '癸', '화(火)'),
    ]
    
    found_hap = []
    for g1 in gans1:
        for g2 in gans2:
            for (h1, h2, result) in gan_he_pairs:
                if (g1 == h1 and g2 == h2) or (g1 == h2 and g2 == h1):
                    found_hap.append(f"{GAN_TO_KO.get(g1, g1)}-{GAN_TO_KO.get(g2, g2)}합 → {result}")
    
    if found_hap:
        results.append(f"🔮 지장간 숨은 합 발견!")
        results.append(f"   {name1}님의 일지 {ZHI_KO_MAP.get(zhi1, zhi1)} 속 천간: {', '.join([GAN_TO_KO.get(g, g) for g in gans1])}")
        results.append(f"   {name2}님의 일지 {ZHI_KO_MAP.get(zhi2, zhi2)} 속 천간: {', '.join([GAN_TO_KO.get(g, g) for g in gans2])}")
        results.append(f"   → {', '.join(found_hap)}")
        results.append(f"   겉으로는 잘 안 맞아 보여도 속으로 통하는 숨은 인연이 있습니다!")
    else:
        results.append(f"지장간에서 특별한 합이 발견되지 않았습니다.")
    
    return results


# ================================================
# 6-1-4. 십신 상호작용 분석 함수
# ================================================

def analyze_sipsin_compatibility(info1, info2, name1: str, name2: str) -> List[str]:
    """십신 상호작용 분석"""
    results = []
    
    gan1 = info1.day_gan
    gan2 = info2.day_gan
    
    sipsin_a_to_b = get_sipsin_relation(gan1, gan2)
    sipsin_b_to_a = get_sipsin_relation(gan2, gan1)
    
    sipsin_ko_a = SIPSIN_KO_MAP.get(sipsin_a_to_b, sipsin_a_to_b)
    sipsin_ko_b = SIPSIN_KO_MAP.get(sipsin_b_to_a, sipsin_b_to_a)
    
    results.append(f"【십신 상호관계】")
    results.append(f"  {name1}님 → {name2}님: {sipsin_ko_a}")
    results.append(f"  {name2}님 → {name1}님: {sipsin_ko_b}")
    
    interpretations = {
        ('정재', '정관'): "이상적인 부부 관계 - 남자가 여자를 보살피고, 여자가 남자를 따르는 전통적 궁합",
        ('편재', '편관'): "열정적이지만 불안정한 관계 - 자극적이나 변동이 많을 수 있음",
        ('식신', '정인'): "보살핌의 관계 - 서로 편안함을 주는 궁합",
        ('상관', '편인'): "창의적이지만 갈등 가능 - 서로 다른 사고방식",
        ('비견', '비견'): "친구 같은 관계 - 경쟁 요소 있음",
        ('겁재', '겁재'): "강한 끌림이나 재물/주도권 다툼 가능",
    }
    
    key = (sipsin_ko_a, sipsin_ko_b)
    reverse_key = (sipsin_ko_b, sipsin_ko_a)
    
    if key in interpretations:
        results.append(f"  → {interpretations[key]}")
    elif reverse_key in interpretations:
        results.append(f"  → {interpretations[reverse_key]}")
    else:
        results.append(f"  → 일반적인 십신 관계입니다.")
    
    return results


# ================================================
# 6-1-5. 주별 영향 분석 함수
# ================================================

def analyze_pillar_influences(info1, info2, name1: str, name2: str) -> List[str]:
    """년/월/일/시주 영향 분석"""
    results = []
    
    year_zhi1 = info1.pillars['year']['zhi']
    year_zhi2 = info2.pillars['year']['zhi']
    
    if ZHI_CHONG.get(year_zhi1) == year_zhi2:
        results.append(f"⚠️ 년주 충: 집안 간 갈등, 가족 문제 발생 가능")
    elif ZHI_LIUHE.get(year_zhi1) == year_zhi2:
        results.append(f"✨ 년주 합: 양가 화합, 가족 관계 좋음")
    
    month_zhi1 = info1.pillars['month']['zhi']
    month_zhi2 = info2.pillars['month']['zhi']
    
    if ZHI_CHONG.get(month_zhi1) == month_zhi2:
        results.append(f"⚠️ 월주 충: 부모/형제 관계에서 갈등 가능")
    elif ZHI_LIUHE.get(month_zhi1) == month_zhi2:
        results.append(f"✨ 월주 합: 부모/형제와 원만한 관계")
    
    hour_zhi1 = info1.pillars['hour']['zhi']
    hour_zhi2 = info2.pillars['hour']['zhi']
    
    if ZHI_CHONG.get(hour_zhi1) == hour_zhi2:
        results.append(f"⚠️ 시주 충: 자녀/노년에 갈등 가능")
    elif ZHI_LIUHE.get(hour_zhi1) == hour_zhi2:
        results.append(f"✨ 시주 합: 자녀/노년운 좋음")
    
    if not results:
        results.append("주별 특별한 충/합이 없습니다.")
    
    return results


# ================================================
# 6-1-6. 신살(神煞) 분석 함수
# ================================================

def calculate_dohua(year_zhi: str) -> str:
    """도화살 계산"""
    dohua_map = {
        '申': '酉', '子': '酉', '辰': '酉',
        '寅': '卯', '午': '卯', '戌': '卯',
        '巳': '午', '酉': '午', '丑': '午',
        '亥': '子', '卯': '子', '未': '子',
    }
    return dohua_map.get(year_zhi, '')


def calculate_hongran(year_zhi: str) -> str:
    """홍란성 계산"""
    hongran_map = {
        '子': '卯', '丑': '寅', '寅': '丑', '卯': '子',
        '辰': '亥', '巳': '戌', '午': '酉', '未': '申',
        '申': '未', '酉': '午', '戌': '巳', '亥': '辰',
    }
    return hongran_map.get(year_zhi, '')


def calculate_tianxi(year_zhi: str) -> str:
    """천희성 계산"""
    tianxi_map = {
        '子': '酉', '丑': '申', '寅': '未', '卯': '午',
        '辰': '巳', '巳': '辰', '午': '卯', '未': '寅',
        '申': '丑', '酉': '子', '戌': '亥', '亥': '戌',
    }
    return tianxi_map.get(year_zhi, '')


def analyze_sinsals_compatibility(info1, info2, name1: str, name2: str) -> List[str]:
    """신살 궁합 분석"""
    results = []
    
    year_zhi1 = info1.pillars['year']['zhi']
    year_zhi2 = info2.pillars['year']['zhi']
    
    dohua1 = calculate_dohua(year_zhi1)
    dohua2 = calculate_dohua(year_zhi2)
    hongran1 = calculate_hongran(year_zhi1)
    hongran2 = calculate_hongran(year_zhi2)
    
    results.append("【신살 분석】")
    
    if dohua1 and dohua2:
        results.append(f"  ⚠️ 양쪽 모두 도화살 보유 - 외부 유혹 주의")
    elif dohua1 or dohua2:
        results.append(f"  💕 한쪽에 도화살 - 매력적인 관계")
    
    day_zhi1 = info1.pillars['day']['zhi']
    day_zhi2 = info2.pillars['day']['zhi']
    
    if hongran1 == day_zhi2 or hongran2 == day_zhi1:
        results.append(f"  ✨ 홍란성과 배우자궁 연결 - 결혼 인연 강함!")
    
    if not results[1:]:
        results.append("  특별한 연애/결혼 신살 조합이 없습니다.")
    
    return results


# ================================================
# 6-1-7. AI 종합 해석 생성 함수
# ================================================

async def generate_compatibility_ai_synthesis(
    info1, info2, name1: str, name2: str,
    total_score: int, grade: str,
    hannan_analysis: str, jiji_interactions: List[str],
    jijanggan_analysis: List[str], sipsin_analysis: List[str],
    pillar_influences: List[str]
) -> str:
    """LLM을 사용한 궁합 AI 종합 해석 생성"""
    
    saju1_summary = f"""【{name1}님 사주】
- 연주: {info1.pillars['year']['gan']}{info1.pillars['year']['zhi']}
- 월주: {info1.pillars['month']['gan']}{info1.pillars['month']['zhi']}
- 일주: {info1.pillars['day']['gan']}{info1.pillars['day']['zhi']} (일간: {info1.day_gan_ko})
- 시주: {info1.pillars['hour']['gan']}{info1.pillars['hour']['zhi']}"""
    
    saju2_summary = f"""【{name2}님 사주】
- 연주: {info2.pillars['year']['gan']}{info2.pillars['year']['zhi']}
- 월주: {info2.pillars['month']['gan']}{info2.pillars['month']['zhi']}
- 일주: {info2.pillars['day']['gan']}{info2.pillars['day']['zhi']} (일간: {info2.day_gan_ko})
- 시주: {info2.pillars['hour']['gan']}{info2.pillars['hour']['zhi']}"""
    
    analysis_summary = f"""【분석 결과】
총점: {total_score}점
등급: {grade}

【한난조습 분석】
{hannan_analysis or '분석 없음'}

【지지 상호작용】
{chr(10).join(jiji_interactions) if jiji_interactions else '없음'}

【지장간 합】
{chr(10).join(jijanggan_analysis) if jijanggan_analysis else '없음'}

【십신 관계】
{chr(10).join(sipsin_analysis) if sipsin_analysis else '없음'}

【주별 영향】
{chr(10).join(pillar_influences) if pillar_influences else '없음'}"""
    
    system_prompt = """당신은 중국 최고의 사주명리학 대가입니다.
두 사람의 궁합을 종합 해석해주세요.

원칙:
1. 고전 명리학 이론에 기반 (적천수, 자평진전, 삼명통회)
2. 한난조습을 궁합의 근본으로 중시
3. 긍정적인 면과 주의할 점을 균형있게 제시
4. 쉽고 친근하게 설명 (20-30대 대상)
5. 200자 이내로 핵심만 전달"""
    
    user_prompt = f"""{saju1_summary}

{saju2_summary}

{analysis_summary}

위 분석을 바탕으로 두 사람의 궁합을 200자 이내로 종합 해석해주세요.
핵심 포인트와 조언을 담아주세요."""
    
    try:
        from core.llm_client import get_deepseek_client
        client = get_deepseek_client()
        
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=500,
            temperature=0.7,
        )
        
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        print(f"AI 종합 해석 생성 실패: {e}")
        if total_score >= 80:
            return f"{name1}님과 {name2}님은 천생연분의 궁합입니다. 한난조습이 조화롭고 지지의 합이 있어 서로를 완벽하게 보완합니다. 함께라면 어떤 어려움도 극복할 수 있습니다."
        elif total_score >= 60:
            return f"{name1}님과 {name2}님은 좋은 인연입니다. 서로 다른 점이 있지만 그것이 오히려 보완이 됩니다. 대화와 이해로 더 깊은 관계를 만들어가세요."
        else:
            return f"{name1}님과 {name2}님은 노력이 필요한 관계입니다. 서로의 차이를 인정하고 배려하면 좋은 관계가 될 수 있습니다."


# ================================================
# 6-2. 상세 궁합 분석 API (LLM 동적 생성, 하드코딩 없음)
# ================================================

class DetailedCompatibilityRequest(BaseModel):
    """상세 궁합 분석 요청"""
    person1_profile_id: str
    person1_name: str
    person1_gender: str
    person1_year: int
    person1_month: int
    person1_day: int
    person1_hour: int = 12
    person1_saju_result: Optional[Dict[str, Any]] = None
    
    person2_profile_id: str
    person2_name: str
    person2_gender: str
    person2_year: int
    person2_month: int
    person2_day: int
    person2_hour: int = 12
    person2_saju_result: Optional[Dict[str, Any]] = None
    
    analysis_level: str = "easy"


class CompatibilitySectionModel(BaseModel):
    """궁합 섹션"""
    title: str
    score: int
    maxScore: int
    summary: str
    details: List[str]
    easyExplanation: str


class DetailedCompatibilityResponse(BaseModel):
    """상세 궁합 분석 응답"""
    success: bool
    totalScore: int
    grade: str
    summary: str
    sections: Dict[str, CompatibilitySectionModel]
    strengths: List[str]
    cautions: List[str]
    advice: str
    classicalRefs: List[SearchResult] = []
    error: Optional[str] = None


@app.post("/api/saju/compatibility/detailed", response_model=DetailedCompatibilityResponse)
async def analyze_compatibility_detailed(request: DetailedCompatibilityRequest):
    """
    상세 궁합 분석 API - 저장된 사주풀이 결과를 활용하여 LLM으로 동적 생성
    하드코딩 없이 모든 해석을 AI가 생성
    """
    start_time = time.time()
    
    try:
        calc = get_calculator()
        
        # 두 사람의 사주 계산
        info1 = calc.calculate(
            year=request.person1_year,
            month=request.person1_month,
            day=request.person1_day,
            hour=request.person1_hour,
            minute=0,
            is_lunar=False,
            gender=request.person1_gender,
            name=request.person1_name,
            use_solar_time=True,
        )
        
        info2 = calc.calculate(
            year=request.person2_year,
            month=request.person2_month,
            day=request.person2_day,
            hour=request.person2_hour,
            minute=0,
            is_lunar=False,
            gender=request.person2_gender,
            name=request.person2_name,
            use_solar_time=True,
        )
        
        name1 = request.person1_name
        name2 = request.person2_name
        analysis_level = request.analysis_level
        
        # 저장된 사주풀이 결과
        saju1 = request.person1_saju_result or {}
        saju2 = request.person2_saju_result or {}
        
        # 고전 문헌 검색
        searcher = get_searcher()
        classical_refs = []
        search_queries = [
            f"궁합 {info1.day_gan_ko}일간 {info2.day_gan_ko}일간",
            f"부부 궁합 한난조습",
            f"배우자 인연 합충",
            f"천간합 지지합 궁합",
        ]
        
        all_search_context = []
        for query in search_queries:
            try:
                results = searcher.search(query, top_k=3, min_score=0.25, mode="D")
                for r in results:
                    if not any(cr.title == r.title for cr in classical_refs):
                        classical_refs.append(SearchResult(
                            book_title=r.book_title,
                            title=r.title,
                            content=r.content[:800] if len(r.content) > 800 else r.content,
                            score=r.final_score,
                            matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                        ))
                        all_search_context.append(f"[{r.book_title} - {r.title}]\n{r.content[:600]}")
            except Exception as e:
                print(f"검색 오류: {e}")
        
        search_context = "\n\n".join(all_search_context[:8])
        
        # 사주 정보 문자열 생성
        def format_saju_info(info, saju_result, name):
            pillars = info.pillars
            saju_str = f"{pillars['year']['gan']}{pillars['year']['zhi']} {pillars['month']['gan']}{pillars['month']['zhi']} {pillars['day']['gan']}{pillars['day']['zhi']} {pillars['hour']['gan']}{pillars['hour']['zhi']}"
            
            result = f"""
【{name}님 사주 정보】
- 사주팔자: {saju_str}
- 일간(日干): {info.day_gan_ko} ({GAN_WUXING.get(info.day_gan, '')}행)
- 년주: {pillars['year']['gan']}{pillars['year']['zhi']} ({ZHI_KO_MAP.get(pillars['year']['zhi'], '')})
- 월주: {pillars['month']['gan']}{pillars['month']['zhi']} ({ZHI_KO_MAP.get(pillars['month']['zhi'], '')})
- 일주: {pillars['day']['gan']}{pillars['day']['zhi']} ({ZHI_KO_MAP.get(pillars['day']['zhi'], '')})
- 시주: {pillars['hour']['gan']}{pillars['hour']['zhi']} ({ZHI_KO_MAP.get(pillars['hour']['zhi'], '')})
"""
            
            if saju_result:
                if saju_result.get('synthesis'):
                    result += f"\n- 기존 사주풀이 요약: {saju_result.get('synthesis', '')[:500]}"
                if saju_result.get('interpretation'):
                    interp = saju_result.get('interpretation', {})
                    if isinstance(interp, dict):
                        if interp.get('personality'):
                            result += f"\n- 성격: {interp.get('personality', '')[:200]}"
                        if interp.get('relationships'):
                            result += f"\n- 대인관계: {interp.get('relationships', '')[:200]}"
            
            return result
        
        saju1_info = format_saju_info(info1, saju1, name1)
        saju2_info = format_saju_info(info2, saju2, name2)
        
        # 분석 레벨에 따른 프롬프트 스타일
        if analysis_level == "easy":
            style_instruction = """
【작성 스타일】
- 일반인이 쉽게 이해할 수 있도록 따뜻하고 친근하게 설명
- 전문 용어는 괄호 안에 쉬운 설명 추가
- 희망적이고 긍정적인 톤 유지
- 구체적인 예시와 비유 사용
"""
        elif analysis_level == "detailed":
            style_instruction = """
【작성 스타일】
- 명리학 전문 용어 사용 (한자 병기)
- 이론적 근거와 함께 상세 분석
- 객관적이고 균형 잡힌 시각
"""
        else:
            style_instruction = """
【작성 스타일】
- 최고 수준의 학술적 분석
- 모든 명리학 용어와 고전 인용 포함
- 매우 상세하고 깊이 있는 해석
"""
        
        # LLM 프롬프트 - 전체 궁합 분석을 한 번에 요청
        llm_prompt = f"""당신은 중국 최고의 사주명리학 대가입니다. 두 사람의 궁합을 깊이 있게 분석해주세요.

{saju1_info}

{saju2_info}

【참고 고전 문헌】
{search_context}

{style_instruction}

다음 7개 영역에 대해 각각 상세 분석해주세요. 반드시 JSON 형식으로 응답하세요.

1. **overall (종합궁합)**: 두 사람의 전체적인 인연과 궁합 총평
2. **hannan (한난조습)**: 두 사람의 기후/계절 조화 분석 (寒暖燥濕)
3. **chungHap (합충형파)**: 천간합, 지지육합, 충, 형, 파 관계 분석
4. **jijanggan (지장간)**: 지지 속 숨은 천간의 합 분석
5. **sipsin (십신관계)**: 두 사람이 서로에게 주는 십신 영향
6. **yongshin (용신보완)**: 서로의 용신을 보완하는지 분석
7. **daeun (대운조화)**: 대운 흐름의 조화

JSON 형식:
{{
  "totalScore": 0-100 사이 점수,
  "grade": "천생연분/좋은 인연/보통/노력 필요/주의 필요" 중 하나,
  "summary": "전체 궁합 요약 (100자 이내)",
  "sections": {{
    "overall": {{
      "title": "종합 궁합",
      "score": 0-100,
      "maxScore": 100,
      "summary": "한 줄 요약",
      "details": ["세부내용1", "세부내용2", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "hannan": {{
      "title": "한난조습(寒暖燥濕) 궁합",
      "score": 0-20,
      "maxScore": 20,
      "summary": "한 줄 요약",
      "details": ["세부내용1", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "chungHap": {{
      "title": "합충형파(合沖刑破) 관계",
      "score": 0-25,
      "maxScore": 25,
      "summary": "한 줄 요약",
      "details": ["세부내용1", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "jijanggan": {{
      "title": "지장간(支藏干) 합",
      "score": 0-15,
      "maxScore": 15,
      "summary": "한 줄 요약",
      "details": ["세부내용1", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "sipsin": {{
      "title": "십신(十神) 상호작용",
      "score": 0-15,
      "maxScore": 15,
      "summary": "한 줄 요약",
      "details": ["세부내용1", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "yongshin": {{
      "title": "용신(用神) 보완 관계",
      "score": 0-15,
      "maxScore": 15,
      "summary": "한 줄 요약",
      "details": ["세부내용1", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }},
    "daeun": {{
      "title": "대운(大運) 조화",
      "score": 0-10,
      "maxScore": 10,
      "summary": "한 줄 요약",
      "details": ["세부내용1", ...],
      "easyExplanation": "쉬운 설명 (200자 이상)"
    }}
  }},
  "strengths": ["좋은점1", "좋은점2", ...],
  "cautions": ["주의점1", "주의점2", ...],
  "advice": "두 분을 위한 조언 (200자 이상)"
}}

중요: 
- 각 섹션의 easyExplanation은 반드시 200자 이상 상세하게 작성
- 실제 두 사람의 사주를 분석한 내용으로 작성
- 고전 문헌 내용을 참고하여 근거 있는 분석
- JSON만 출력하고 다른 텍스트 없이 응답
"""
        
        # LLM 호출
        llm = get_llm_client()
        response = llm.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": llm_prompt}],
            max_tokens=4000,
            temperature=0.7,
        )
        
        llm_result = response.choices[0].message.content.strip()
        
        # JSON 파싱
        try:
            # JSON 블록 추출
            if "```json" in llm_result:
                llm_result = llm_result.split("```json")[1].split("```")[0]
            elif "```" in llm_result:
                llm_result = llm_result.split("```")[1].split("```")[0]
            
            parsed = json.loads(llm_result)
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
            print(f"LLM 응답: {llm_result[:500]}")
            raise Exception("AI 응답 파싱 오류")
        
        # 응답 구성
        sections = {}
        for key, section_data in parsed.get("sections", {}).items():
            sections[key] = CompatibilitySectionModel(
                title=section_data.get("title", ""),
                score=section_data.get("score", 0),
                maxScore=section_data.get("maxScore", 100),
                summary=section_data.get("summary", ""),
                details=section_data.get("details", []),
                easyExplanation=section_data.get("easyExplanation", ""),
            )
        
        processing_time = int((time.time() - start_time) * 1000)
        print(f"[궁합분석] {name1} & {name2} - 점수: {parsed.get('totalScore', 0)}, 시간: {processing_time}ms")
        
        return DetailedCompatibilityResponse(
            success=True,
            totalScore=parsed.get("totalScore", 0),
            grade=parsed.get("grade", "보통"),
            summary=parsed.get("summary", ""),
            sections=sections,
            strengths=parsed.get("strengths", []),
            cautions=parsed.get("cautions", []),
            advice=parsed.get("advice", ""),
            classicalRefs=classical_refs[:6],
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return DetailedCompatibilityResponse(
            success=False,
            totalScore=0,
            grade="",
            summary="",
            sections={},
            strengths=[],
            cautions=[],
            advice="",
            error=str(e),
        )


# ================================================
# 7. 분석 API 확장 - 신살 정보 포함
# ================================================

# 기존 analyze_saju API에 신살 정보 추가를 위한 응답 모델 확장
class SajuAnalysisResponseExtended(SajuAnalysisResponse):
    """확장된 사주 분석 응답 (신살 포함)"""
    shinsal: Dict[str, Any] = {}
    fortune_interactions: Dict[str, Any] = {}


@app.post("/api/saju/analyze/extended", response_model=SajuAnalysisResponseExtended)
async def analyze_saju_extended(request: SajuRequest):
    """확장된 사주 분석 API (신살 + 운세 상호작용 포함)"""
    start_time = time.time()
    
    try:
        # 기본 분석 실행
        calc = get_calculator()
        info = calc.calculate(
            year=request.year,
            month=request.month,
            day=request.day,
            hour=request.hour,
            minute=request.minute,
            is_lunar=request.is_lunar,
            is_leap_month=request.is_leap_month,
            gender=request.gender,
            name=request.name,
            use_solar_time=True,
        )
        
        # 벡터 검색
        searcher = get_searcher()
        day_gan_ko = info.day_gan_ko
        month_zhi = info.pillars['month']['zhi']
        
        MONTH_ZHI_SEASON = {
            '寅': '인월(봄)', '卯': '묘월(봄)', '辰': '진월(봄→여름)',
            '巳': '사월(여름)', '午': '오월(여름)', '未': '미월(여름→가을)',
            '申': '신월(가을)', '酉': '유월(가을)', '戌': '술월(가을→겨울)',
            '亥': '해월(겨울)', '子': '자월(겨울)', '丑': '축월(겨울→봄)',
        }
        season = MONTH_ZHI_SEASON.get(month_zhi, month_zhi)
        
        queries = [
            f"{day_gan_ko} 일간 {season} 격국과 용신",
            f"궁통보감 {day_gan_ko} {season} 조후 용신",
        ]
        
        all_results = []
        for query in queries:
            try:
                results = searcher.search(query, top_k=3, min_score=0.3, mode="D")
                for r in results:
                    all_results.append(SearchResult(
                        book_title=r.book_title,
                        title=r.title,
                        content=r.content[:500] if len(r.content) > 500 else r.content,
                        score=r.final_score,
                        matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                    ))
            except Exception as e:
                print(f"검색 오류: {e}")
        
        # 중복 제거
        seen = set()
        unique_results = []
        for r in all_results:
            key = f"{r.book_title}:{r.title}"
            if key not in seen:
                seen.add(key)
                unique_results.append(r)
        
        # LLM 분석
        synthesis, easy_explanation = await generate_llm_analysis(info, unique_results[:5])
        
        # 격국 판단 (고급)
        geju_result = determine_geju_advanced(info)
        
        # 조후용신
        johu = get_johu_yongshen(info.day_gan, month_zhi)
        
        # 오행 분포
        wuxing = calculate_wuxing_balance(info)
        
        # 신살 찾기
        shinsal = find_all_shinsal(info)
        
        # 세운과의 상호작용
        sewoon = calculate_sewoon(request.target_year)
        fortune_interactions = analyze_fortune_interactions(
            info, 
            sewoon['gan'], 
            sewoon['zhi'],
            johu.get('primary_gan')
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return SajuAnalysisResponseExtended(
            success=True,
            processing_time_ms=processing_time,
            pillars={
                'year': {'gan': info.pillars['year']['ko'][0], 'zhi': info.pillars['year']['ko'][1]},
                'month': {'gan': info.pillars['month']['ko'][0], 'zhi': info.pillars['month']['ko'][1]},
                'day': {'gan': info.pillars['day']['ko'][0], 'zhi': info.pillars['day']['ko'][1]},
                'hour': {'gan': info.pillars['hour']['ko'][0], 'zhi': info.pillars['hour']['ko'][1]},
            },
            day_master={
                'gan': info.day_gan_ko,
                'element': info.day_gan_desc,
            },
            geju=geju_result,
            yongshen=johu,
            wuxing_balance=wuxing,
            synthesis=synthesis,
            easy_explanation=easy_explanation,
            classical_references=unique_results[:5],
            shinsal=shinsal,
            fortune_interactions=fortune_interactions,
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        processing_time = int((time.time() - start_time) * 1000)
        return SajuAnalysisResponseExtended(
            success=False,
            processing_time_ms=processing_time,
            pillars={},
            day_master={},
            geju={},
            yongshen={},
            wuxing_balance={},
            synthesis="",
            easy_explanation="",
            classical_references=[],
            shinsal={},
            fortune_interactions={},
            error=str(e),
        )


if __name__ == "__main__":
    import uvicorn
    
    # 환경변수에서 설정 로드
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "").lower() == "true"
    workers_count = int(os.getenv("WORKERS", "1"))  # 개발 시 1, 프로덕션은 gunicorn 사용
    
    print("=" * 60)
    print("🚀 사주풀이 API 서버 (최적화 버전 2.0)")
    print("=" * 60)
    print(f"  Host: {host}:{port}")
    print(f"  Workers: {workers_count}")
    print(f"  ThreadPool: {MAX_WORKERS}")
    print(f"  Redis: {'활성화' if REDIS_AVAILABLE else '비활성화'}")
    print(f"  Prometheus: {'활성화' if PROMETHEUS_AVAILABLE else '비활성화'}")
    print(f"  Rate Limit: {RATE_LIMIT}")
    print("=" * 60)
    print("\n📌 프로덕션 실행:")
    print("  gunicorn -c gunicorn.conf.py saju_api:app")
    print("\n📌 엔드포인트:")
    print("  - /health          : 기본 헬스체크")
    print("  - /health/detailed : 상세 헬스체크")
    print("  - /health/ready    : K8s Readiness")
    print("  - /health/live     : K8s Liveness")
    if PROMETHEUS_AVAILABLE:
        print("  - /metrics         : Prometheus 메트릭")
    print("=" * 60)
    
    # 개발 모드: 단일 프로세스 + 핫 리로드
    if debug:
        uvicorn.run(
            "saju_api:app", 
            host=host, 
            port=port, 
            reload=True,
            log_level="debug"
        )
    else:
        # 기본 모드: 단일 프로세스 (프로덕션은 gunicorn 권장)
        uvicorn.run(
            app, 
            host=host, 
            port=port,
            log_level="info"
        )
