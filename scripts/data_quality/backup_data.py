"""
데이터 백업 스크립트
====================
Supabase chunks 테이블과 원본 JSON 파일을 백업합니다.

사용법:
    python scripts/data_quality/backup_data.py
"""

import os
import sys
import json
import shutil
from datetime import datetime
from pathlib import Path

# 프로젝트 루트 설정
PROJECT_ROOT = Path(__file__).parent.parent.parent
PIPELINE_PATH = Path(r"C:\AgenticAI_Trainning\그래프DB(고전문헌)구축\saju-classics-pipeline")
sys.path.insert(0, str(PIPELINE_PATH))

from dotenv import load_dotenv
load_dotenv(PIPELINE_PATH / ".env")

from supabase import create_client

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")


def get_timestamp():
    """백업용 타임스탬프 생성"""
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def create_backup_dir():
    """백업 디렉토리 생성"""
    backup_dir = PROJECT_ROOT / "backups" / f"backup_{get_timestamp()}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def backup_supabase_chunks(backup_dir: Path):
    """Supabase chunks 테이블 백업"""
    print("=" * 60)
    print("  Supabase Chunks 테이블 백업")
    print("=" * 60)
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("  [ERROR] Supabase 환경변수가 설정되지 않았습니다.")
        print("  SUPABASE_URL과 SUPABASE_SERVICE_KEY를 확인하세요.")
        return False
    
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # 전체 청크 수 확인
        count_resp = client.table('chunks').select('id', count='exact').limit(0).execute()
        total_count = count_resp.count
        print(f"\n  총 청크 수: {total_count}")
        
        # 페이지네이션으로 전체 데이터 가져오기
        all_chunks = []
        page_size = 1000
        offset = 0
        
        while True:
            resp = client.table('chunks').select('*').range(offset, offset + page_size - 1).execute()
            
            if not resp.data:
                break
                
            all_chunks.extend(resp.data)
            offset += page_size
            print(f"  가져온 청크: {len(all_chunks)}/{total_count}")
            
            if len(resp.data) < page_size:
                break
        
        # JSON 파일로 저장 (embedding 제외 - 용량 절약)
        chunks_backup = []
        for chunk in all_chunks:
            chunk_copy = {k: v for k, v in chunk.items() if k != 'embedding'}
            chunk_copy['has_embedding'] = chunk.get('embedding') is not None
            chunks_backup.append(chunk_copy)
        
        chunks_file = backup_dir / "supabase_chunks.json"
        with open(chunks_file, 'w', encoding='utf-8') as f:
            json.dump(chunks_backup, f, ensure_ascii=False, indent=2)
        
        print(f"\n  저장 완료: {chunks_file}")
        print(f"  저장된 청크 수: {len(chunks_backup)}")
        
        # 서적별 통계
        books_backup = client.table('books').select('*').execute()
        books_file = backup_dir / "supabase_books.json"
        with open(books_file, 'w', encoding='utf-8') as f:
            json.dump(books_backup.data, f, ensure_ascii=False, indent=2)
        print(f"  서적 메타데이터: {books_file}")
        
        # 패턴 데이터 백업
        patterns_backup = client.table('patterns').select('*').execute()
        patterns_file = backup_dir / "supabase_patterns.json"
        with open(patterns_file, 'w', encoding='utf-8') as f:
            json.dump(patterns_backup.data, f, ensure_ascii=False, indent=2)
        print(f"  패턴 데이터: {patterns_file}")
        
        return True
        
    except Exception as e:
        print(f"  [ERROR] Supabase 백업 실패: {e}")
        return False


def backup_raw_json_files(backup_dir: Path):
    """원본 JSON 파일 백업"""
    print("\n" + "=" * 60)
    print("  원본 JSON 파일 백업")
    print("=" * 60)
    
    raw_data_dir = PIPELINE_PATH / "data" / "raw"
    
    if not raw_data_dir.exists():
        print(f"  [ERROR] 원본 데이터 디렉토리가 없습니다: {raw_data_dir}")
        return False
    
    try:
        # 백업 대상 디렉토리 생성
        backup_raw_dir = backup_dir / "raw_data"
        
        # 전체 raw 디렉토리 복사
        shutil.copytree(raw_data_dir, backup_raw_dir)
        
        # 파일 수 확인
        json_files = list(backup_raw_dir.rglob("*.json"))
        print(f"\n  복사된 JSON 파일 수: {len(json_files)}")
        
        # 서적별 파일 수
        for subdir in backup_raw_dir.iterdir():
            if subdir.is_dir():
                files = list(subdir.glob("*.json"))
                print(f"    {subdir.name}: {len(files)} files")
        
        print(f"\n  저장 위치: {backup_raw_dir}")
        return True
        
    except Exception as e:
        print(f"  [ERROR] 원본 파일 백업 실패: {e}")
        return False


def create_backup_summary(backup_dir: Path, supabase_ok: bool, raw_ok: bool):
    """백업 요약 정보 생성"""
    summary = {
        "backup_time": datetime.now().isoformat(),
        "backup_dir": str(backup_dir),
        "supabase_backup": {
            "success": supabase_ok,
            "files": ["supabase_chunks.json", "supabase_books.json", "supabase_patterns.json"] if supabase_ok else []
        },
        "raw_data_backup": {
            "success": raw_ok,
            "source": str(PIPELINE_PATH / "data" / "raw")
        }
    }
    
    summary_file = backup_dir / "backup_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    return summary_file


def main():
    print("\n" + "=" * 60)
    print("  데이터 품질검증 전 백업 시작")
    print("=" * 60)
    print(f"  시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 백업 디렉토리 생성
    backup_dir = create_backup_dir()
    print(f"  백업 위치: {backup_dir}")
    
    # Supabase 백업
    supabase_ok = backup_supabase_chunks(backup_dir)
    
    # 원본 JSON 백업
    raw_ok = backup_raw_json_files(backup_dir)
    
    # 요약 생성
    summary_file = create_backup_summary(backup_dir, supabase_ok, raw_ok)
    
    # 결과 출력
    print("\n" + "=" * 60)
    print("  백업 완료")
    print("=" * 60)
    print(f"  Supabase 백업: {'성공' if supabase_ok else '실패'}")
    print(f"  원본 JSON 백업: {'성공' if raw_ok else '실패'}")
    print(f"  요약 파일: {summary_file}")
    print(f"\n  전체 백업 위치: {backup_dir}")
    
    if supabase_ok and raw_ok:
        print("\n  [SUCCESS] 모든 백업이 완료되었습니다.")
        print("  이제 품질검증을 안전하게 실행할 수 있습니다.")
    else:
        print("\n  [WARNING] 일부 백업이 실패했습니다.")
        print("  품질검증 전에 문제를 해결하세요.")
    
    return 0 if (supabase_ok and raw_ok) else 1


if __name__ == "__main__":
    sys.exit(main())
