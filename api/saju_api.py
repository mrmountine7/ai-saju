"""
사주풀이 API 서버 (FastAPI) - 성능 최적화 버전
================================================
D모드 벡터 검색 + LLM 분석을 React 프론트엔드에 제공

최적화 내역 (1,000+ 동시접속 대응):
1. 비동기 HTTP 클라이언트 (httpx) - 논블로킹 LLM 호출
2. Redis 캐싱 레이어 - 동일 사주 결과 캐시
3. Gunicorn 멀티워커 지원
4. Rate Limiting - API 과부하 방지
5. Health check + Prometheus 메트릭 - 모니터링

실행 방법:
  개발: python saju_api.py
  프로덕션: gunicorn -c gunicorn.conf.py saju_api:app
"""

import sys
import os
import time
import json
import hashlib
from pathlib import Path
from datetime import datetime

# saju-classics-pipeline 경로 추가 (환경변수 로드 전에)
PIPELINE_PATH = r"C:\AgenticAI_Trainning\그래프DB(고전문헌)구축\saju-classics-pipeline"
sys.path.insert(0, PIPELINE_PATH)
os.chdir(PIPELINE_PATH)  # .env 파일 경로 기준

from dotenv import load_dotenv
load_dotenv(os.path.join(PIPELINE_PATH, '.env'))

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
        from analyzers.saju_calculator import SajuCalculator
        _calculator = SajuCalculator()
    return _calculator


def get_searcher():
    global _searcher
    if _searcher is None:
        from search import SajuSearch
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
async def analyze_saju(request: SajuRequest, req: Request):
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
            year=request.year, month=request.month, day=request.day,
            hour=request.hour, minute=request.minute, gender=request.gender,
            is_lunar=request.is_lunar, is_leap_month=request.is_leap_month
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
        print(f"[1/6] 사주 계산 시작: {request.name} {request.year}/{request.month}/{request.day}")
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
        
        # 3. LLM 종합 해석 호출
        print(f"[3/6] LLM 종합 해석 생성")
        synthesis, easy_explanation = await generate_llm_analysis(info, unique_results[:5])
        
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


async def generate_llm_analysis(info, search_results: List[SearchResult]) -> tuple:
    """
    LLM 종합 해석 생성 (비동기 최적화 버전)
    - httpx 비동기 클라이언트 사용 (논블로킹)
    - 병렬 API 호출 (asyncio.gather)
    """
    from config.settings import settings
    
    # 검색 결과 컨텍스트 구성
    context_parts = []
    for r in search_results:
        context_parts.append(f"[{r.book_title}] {r.title}: {r.content[:300]}")
    search_context = "\n".join(context_parts) if context_parts else "검색 결과 없음"
    
    # 사주 정보
    pillars = info.pillars
    saju_info = f"""
일간: {info.day_gan}({info.day_gan_ko}, {info.day_gan_desc})
년주: {pillars['year']['zh']}({pillars['year']['ko']})
월주: {pillars['month']['zh']}({pillars['month']['ko']})
일주: {pillars['day']['zh']}({pillars['day']['ko']})
시주: {pillars['hour']['zh']}({pillars['hour']['ko']})
"""
    
    # 종합 해석 프롬프트 (최적화 버전 - 상세하면서 빠르게)
    synthesis_prompt = f"""명리학 전문가로서 아래 사주를 해석하세요.

## 사주 정보
{saju_info}

## 고전 문헌 참조
{search_context}

## 작성 형식 (각 섹션 제목 필수)

**[일간(日干) 특성]**
- 일간의 오행 특성과 비유 (태양/나무/바위 등)
- 성격, 기질, 대인관계 특징
- 신강/신약 여부와 직업 적성
(6~8줄)

**[격국(格局) 분석]**
- 격국 명칭과 판단 근거
- 이 격국의 의미와 장단점
- 유리한 직업군과 성공 방향
(6~8줄)

**[용신(用神) 판단]**
- 용신과 희신, 기신 판단
- 용신 유형 (억부/조후/통관/병약)
- 일상에서 용신 활용법 (색상, 방위, 직업)
(6~8줄)

**[고전 문헌 해석]**
- 위 고전 원문의 한글 번역
- 이 사주에 적용되는 핵심 내용
- 고전이 말하는 길흉과 조언
(8~10줄)

**[종합 조언]**
- 장점과 주의점
- 건강, 재물, 대인관계 조언
(4~5줄)

한국어로 작성, 한자는 괄호에 병기. 총 30~35줄로 작성하세요.
"""
    
    # 쉬운 설명 프롬프트 (최적화 버전)
    easy_prompt = f"""사주를 쉽게 설명해주세요.

## 사주 정보
{saju_info}

## 작성 형식 (각 섹션 제목 필수)

**🌟 당신은 이런 사람이에요**
- 비유를 사용해 성격과 기질 설명 (3~4줄)

**💼 인생의 방향**
- 어울리는 직업과 재능 발휘 분야 (2~3줄)

**🍀 행운을 부르는 방법**
- 좋은 색상, 방위, 활동 (2~3줄)

**⚠️ 주의할 점**
- 건강, 대인관계 주의사항 (2줄)

**📜 옛 현인의 지혜**
- 고전에서 말하는 조언을 쉽게 풀어서 (3~4줄)

친근한 어투(~이에요, ~거예요)로 작성. 한자 사용 금지. 총 15~18줄로 작성.
"""
    
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
    from analyzers.saju_calculator import WUXING_MAP, HIDDEN_STEMS
    
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
    from config.settings import settings
    
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
    from config.settings import settings
    
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
    from config.settings import settings
    
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
    from config.settings import settings
    
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
    error: Optional[str] = None


@app.post("/api/saju/compatibility", response_model=CompatibilityResponse)
async def analyze_compatibility(request: CompatibilityRequest):
    """궁합 분석 API"""
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
        
        # 5가지 궁합 분석
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
        
        # 등급 결정
        if total_score >= 85:
            grade = "천생연분"
            emoji = "💕"
            summary = "두 분은 천생연분입니다! 서로를 보완하고 성장시키는 최상의 궁합입니다."
        elif total_score >= 70:
            grade = "좋은 인연"
            emoji = "💗"
            summary = "좋은 궁합입니다. 서로 노력하면 행복한 관계를 유지할 수 있습니다."
        elif total_score >= 55:
            grade = "보통"
            emoji = "💛"
            summary = "평범한 궁합입니다. 서로 이해하고 배려하면 좋은 관계가 될 수 있습니다."
        elif total_score >= 40:
            grade = "노력 필요"
            emoji = "💔"
            summary = "다소 맞지 않는 부분이 있습니다. 서로의 차이를 인정하고 노력이 필요합니다."
        else:
            grade = "주의 필요"
            emoji = "⚠️"
            summary = "궁합이 좋지 않습니다. 신중한 결정이 필요합니다."
        
        # 고전 문헌 검색
        search_results = []
        try:
            searcher = get_searcher()
            query = f"궁합 {info1.day_gan_ko}일간 {info2.day_gan_ko}일간 배우자"
            results = searcher.search(query, top_k=2, min_score=0.3, mode="D")
            for r in results:
                search_results.append(SearchResult(
                    book_title=r.book_title,
                    title=r.title,
                    content=r.content[:400] if len(r.content) > 400 else r.content,
                    score=r.final_score,
                    matched_patterns=list(r.matched_patterns) if r.matched_patterns else [],
                ))
        except Exception as e:
            print(f"궁합 검색 오류: {e}")
        
        # 조언 생성
        advice = generate_compatibility_advice(total_score, strengths, weaknesses)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return CompatibilityResponse(
            success=True,
            processing_time_ms=processing_time,
            total_score=total_score,
            grade=grade,
            emoji=emoji,
            summary=summary,
            categories=categories,
            strengths=strengths[:3],
            weaknesses=weaknesses[:3],
            advice=advice,
            classical_references=search_results,
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
