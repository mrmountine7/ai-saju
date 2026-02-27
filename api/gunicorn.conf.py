"""
Gunicorn 설정 파일 - 사주풀이 API 서버
======================================
동시접속 1,000+ 대응 멀티워커 설정

실행 방법:
  cd c:\AgenticAI_Trainning\ai_saju\api
  gunicorn -c gunicorn.conf.py saju_api:app
  
또는 (프로덕션):
  gunicorn -c gunicorn.conf.py saju_api:app --daemon
"""

import os
import multiprocessing

# ================================================
# 기본 설정
# ================================================

# 바인딩 주소 (환경변수 또는 기본값)
bind = os.getenv("BIND", "0.0.0.0:8000")

# 워커 수 (CPU 코어 * 2 + 1 권장)
workers = int(os.getenv("WORKERS", multiprocessing.cpu_count() * 2 + 1))

# 워커 클래스 (비동기 처리를 위한 uvicorn)
worker_class = "uvicorn.workers.UvicornWorker"

# 워커당 스레드 수
threads = int(os.getenv("THREADS", 2))

# 최대 동시 연결 수 (워커당)
worker_connections = int(os.getenv("WORKER_CONNECTIONS", 1000))

# ================================================
# 타임아웃 설정
# ================================================

# 워커 타임아웃 (LLM 응답 대기 고려)
timeout = int(os.getenv("TIMEOUT", 120))  # 2분

# Graceful 타임아웃
graceful_timeout = int(os.getenv("GRACEFUL_TIMEOUT", 30))

# Keep-Alive 타임아웃
keepalive = int(os.getenv("KEEPALIVE", 5))

# ================================================
# 프로세스 관리
# ================================================

# 최대 요청 수 후 워커 재시작 (메모리 누수 방지)
max_requests = int(os.getenv("MAX_REQUESTS", 1000))
max_requests_jitter = int(os.getenv("MAX_REQUESTS_JITTER", 50))

# 워커 재시작 간격
worker_tmp_dir = "/dev/shm" if os.path.exists("/dev/shm") else None

# PID 파일
pidfile = os.getenv("PIDFILE", None)

# ================================================
# 로깅 설정
# ================================================

# 로그 레벨
loglevel = os.getenv("LOG_LEVEL", "info")

# 액세스 로그
accesslog = os.getenv("ACCESS_LOG", "-")  # "-" = stdout
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 에러 로그
errorlog = os.getenv("ERROR_LOG", "-")  # "-" = stderr

# ================================================
# 보안 설정
# ================================================

# 요청 본문 최대 크기 (10MB)
limit_request_body = int(os.getenv("LIMIT_REQUEST_BODY", 10 * 1024 * 1024))

# 요청 헤더 최대 필드 수
limit_request_fields = 100

# 요청 헤더 최대 라인 크기
limit_request_field_size = 8190

# ================================================
# Preload 설정 (메모리 절약)
# ================================================

# 앱 코드 미리 로드 (워커 간 메모리 공유)
preload_app = True

# ================================================
# 후크 (Hooks)
# ================================================

def on_starting(server):
    """서버 시작 시 호출"""
    print(f"[Gunicorn] 서버 시작: {bind}")
    print(f"[Gunicorn] 워커 수: {workers}")
    print(f"[Gunicorn] 워커당 연결: {worker_connections}")

def on_reload(server):
    """서버 리로드 시 호출"""
    print("[Gunicorn] 서버 리로드")

def worker_int(worker):
    """워커 종료 시 호출"""
    print(f"[Gunicorn] 워커 {worker.pid} 종료")

def worker_abort(worker):
    """워커 강제 종료 시 호출"""
    print(f"[Gunicorn] 워커 {worker.pid} 강제 종료")

def pre_fork(server, worker):
    """워커 fork 전 호출"""
    pass

def post_fork(server, worker):
    """워커 fork 후 호출"""
    print(f"[Gunicorn] 워커 {worker.pid} 시작")

def post_worker_init(worker):
    """워커 초기화 완료 후 호출"""
    pass

def worker_exit(server, worker):
    """워커 종료 완료 후 호출"""
    print(f"[Gunicorn] 워커 {worker.pid} 종료 완료")

# ================================================
# 환경별 설정 오버라이드
# ================================================

# 개발 환경 (DEBUG=true)
if os.getenv("DEBUG", "").lower() == "true":
    reload = True
    reload_engine = "auto"
    workers = 1
    loglevel = "debug"
    print("[Gunicorn] 개발 모드: 핫 리로드 활성화, 워커 1개")

# 프로덕션 환경 (PRODUCTION=true)
if os.getenv("PRODUCTION", "").lower() == "true":
    preload_app = True
    daemon = False  # Docker/Kubernetes에서는 False
    print(f"[Gunicorn] 프로덕션 모드: 워커 {workers}개, 타임아웃 {timeout}초")
