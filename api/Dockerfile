# 사주풀이 API 서버 Docker 이미지
# ================================
# 동시접속 1,000+ 대응 최적화 버전

FROM python:3.11-slim

# 환경 변수 설정
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    HOST=0.0.0.0 \
    WORKERS=4 \
    MAX_WORKERS=8 \
    TIMEOUT=120 \
    GRACEFUL_TIMEOUT=30

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# 포트 노출
EXPOSE ${PORT}

# 실행 (Gunicorn + Uvicorn 워커)
CMD ["gunicorn", "-c", "gunicorn.conf.py", "saju_api:app"]
