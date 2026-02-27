# 사주풀이 API 성능 최적화 가이드

## 개요
동시접속 1,000+ 사용자 대응을 위한 최적화 버전 (v2.0)

## 최적화 내역

### 1. 비동기 LLM 호출 (httpx)
- **변경 전**: `requests.post()` (동기, 블로킹)
- **변경 후**: `httpx.AsyncClient.post()` (비동기, 논블로킹)
- **효과**: LLM 응답 대기 중 다른 요청 처리 가능

```python
# 기존 (블로킹)
resp = requests.post(url, json=data, timeout=60)

# 최적화 (논블로킹)
resp = await http_client.post(url, json=data)
```

### 2. Redis 캐싱 레이어
- 동일 사주 분석 결과 캐시 (기본 1시간)
- 캐시 히트 시 응답 시간 ~50ms (원래 ~50초)

```bash
# Redis 설치 (옵션)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 환경변수 설정
export REDIS_URL=redis://localhost:6379/0
export CACHE_TTL=3600
```

### 3. Gunicorn 멀티워커
- CPU 코어 × 2 + 1 워커 (기본값)
- 워커당 1,000 연결 처리

```bash
# 개발 모드 (핫 리로드)
DEBUG=true python saju_api.py

# 프로덕션 모드
gunicorn -c gunicorn.conf.py saju_api:app
```

### 4. Rate Limiting (slowapi)
- 분당 100회 요청 제한 (기본값)
- IP 기반 제한

```python
# 환경변수로 설정 가능
export RATE_LIMIT=100/minute
```

### 5. Health Check & 모니터링
| 엔드포인트 | 용도 |
|-----------|------|
| `/health` | 기본 헬스체크 |
| `/health/detailed` | 상세 상태 (Redis, CPU, 메모리) |
| `/health/ready` | K8s Readiness Probe |
| `/health/live` | K8s Liveness Probe |
| `/metrics` | Prometheus 메트릭 |

## 설치 및 실행

### 1. 의존성 설치
```bash
cd c:\AgenticAI_Trainning\ai_saju\api
pip install -r requirements.txt
```

### 2. 개발 모드 실행
```bash
DEBUG=true python saju_api.py
```

### 3. 프로덕션 모드 실행
```bash
# 직접 실행
gunicorn -c gunicorn.conf.py saju_api:app

# Docker Compose (Redis 포함)
docker-compose up -d
```

### 4. 모니터링 스택 실행 (Prometheus + Grafana)
```bash
docker-compose --profile monitoring up -d
```

## 성능 비교

| 항목 | 최적화 전 | 최적화 후 |
|------|----------|----------|
| 동시 연결 | ~10 | 1,000+ |
| LLM 호출 | 블로킹 | 논블로킹 |
| ThreadPool | 4 | CPU×2 |
| 캐싱 | 없음 | Redis |
| Rate Limit | 없음 | 100/분 |
| 모니터링 | 없음 | Prometheus |

## 환경변수

```bash
# 서버 설정
HOST=0.0.0.0
PORT=8000
DEBUG=false
WORKERS=4

# Redis 설정
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600

# Rate Limiting
RATE_LIMIT=100/minute

# ThreadPool
MAX_WORKERS=8
```

## 10,000+ 동시접속 확장 시

1. **Kubernetes 배포**: 10+ 파드로 수평 확장
2. **Redis Cluster**: 분산 캐싱
3. **Load Balancer**: AWS ALB / GCP LB / Nginx
4. **Message Queue**: LLM 호출 비동기 처리 (Celery + RabbitMQ)
5. **CDN**: 프론트엔드 정적 자산 캐싱

## 모니터링 대시보드 메트릭

- `saju_api_requests_total`: 총 요청 수
- `saju_api_request_latency_seconds`: 요청 지연 시간
- `saju_api_active_requests`: 현재 활성 요청
- `saju_api_cache_hits_total`: 캐시 히트 수
- `saju_api_cache_misses_total`: 캐시 미스 수
- `saju_api_llm_calls_total`: LLM API 호출 수
