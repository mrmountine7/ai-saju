"""
구조적 오류 검출기
==================
고전문헌 청크 데이터의 구조적 오류를 검출합니다.

검출 항목:
1. 빈 콘텐츠 / 누락 필드
2. 중복 청크
3. 깨진 위키 마크업 (}}, {{, __TOC__ 등)
4. 비정상 문자 (깨진 인코딩)
5. 계층 구조 무결성 (parent-child 관계)
6. 청크 순서 누락/중복

사용법:
    python scripts/data_quality/structural_validator.py
"""

import os
import sys
import json
import re
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Set
from collections import Counter, defaultdict

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


@dataclass
class ValidationIssue:
    """검증 이슈"""
    chunk_id: str
    chunk_uid: str
    book_title: str
    issue_type: str  # empty_content, duplicate, broken_markup, invalid_chars, hierarchy, sequence
    severity: str    # critical, warning, info
    message: str
    details: Dict = field(default_factory=dict)
    suggestion: str = ""


@dataclass
class ValidationReport:
    """검증 리포트"""
    timestamp: str
    total_chunks: int
    issues: List[ValidationIssue] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)
    
    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)
    
    def to_dict(self):
        return {
            "timestamp": self.timestamp,
            "total_chunks": self.total_chunks,
            "issue_count": len(self.issues),
            "summary": self.summary,
            "issues": [asdict(i) for i in self.issues]
        }


class StructuralValidator:
    """구조적 오류 검출기"""
    
    # 깨진 위키 마크업 패턴
    BROKEN_MARKUP_PATTERNS = [
        (r'\}\}+', "닫는 괄호만 있음"),
        (r'\{\{+', "여는 괄호만 있음"),
        (r'__TOC__', "목차 마커 잔여"),
        (r'\[\[(?![^\]]*\]\])', "닫히지 않은 링크"),
        (r'(?<!\[\[)[^\[]*\]\]', "여는 없이 닫는 링크"),
        (r'<[^>]*$', "닫히지 않은 HTML 태그"),
        (r'^[^<]*>', "여는 없이 닫는 HTML 태그"),
    ]
    
    # 비정상 문자 패턴 (깨진 인코딩 등)
    INVALID_CHAR_PATTERNS = [
        (r'[\x00-\x08\x0b\x0c\x0e-\x1f]', "제어 문자"),
        (r'[\ufffd]', "대체 문자 (깨진 인코딩)"),
        (r'[\ufffe\uffff]', "비문자 코드포인트"),
    ]
    
    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase 환경변수가 설정되지 않았습니다.")
        self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.chunks = []
        self.books = {}
    
    def load_data(self):
        """Supabase에서 데이터 로드"""
        import time
        print("  데이터 로드 중...")
        
        # 서적 정보
        books_resp = self.client.table('books').select('*').execute()
        self.books = {b['id']: b for b in books_resp.data}
        print(f"    서적 수: {len(self.books)}")
        
        # 청크 정보 (embedding 제외) - 타임아웃 방지를 위해 작은 페이지 사용
        all_chunks = []
        page_size = 500
        offset = 0
        
        while True:
            try:
                resp = self.client.table('chunks').select(
                    'id, chunk_uid, book_id, level, parent_chunk_uid, sequence_num, '
                    'title, content, classical_text, translation, metadata'
                ).range(offset, offset + page_size - 1).execute()
                
                if not resp.data:
                    break
                
                all_chunks.extend(resp.data)
                print(f"    로드 진행: {len(all_chunks)}")
                offset += page_size
                
                if len(resp.data) < page_size:
                    break
                    
                time.sleep(0.5)  # 타임아웃 방지
                
            except Exception as e:
                print(f"    [WARNING] 로드 중 오류: {e}")
                break
        
        self.chunks = all_chunks
        print(f"    청크 수: {len(self.chunks)}")
    
    def validate_all(self) -> ValidationReport:
        """전체 검증 실행"""
        print("\n" + "=" * 60)
        print("  구조적 오류 검증 시작")
        print("=" * 60)
        
        self.load_data()
        
        report = ValidationReport(
            timestamp=datetime.now().isoformat(),
            total_chunks=len(self.chunks)
        )
        
        # 각 검증 수행
        print("\n  [1/6] 빈 콘텐츠 검사...")
        self._validate_empty_content(report)
        
        print("  [2/6] 중복 청크 검사...")
        self._validate_duplicates(report)
        
        print("  [3/6] 깨진 마크업 검사...")
        self._validate_broken_markup(report)
        
        print("  [4/6] 비정상 문자 검사...")
        self._validate_invalid_chars(report)
        
        print("  [5/6] 계층 구조 검사...")
        self._validate_hierarchy(report)
        
        print("  [6/6] 시퀀스 번호 검사...")
        self._validate_sequences(report)
        
        # 요약 생성
        report.summary = self._generate_summary(report)
        
        return report
    
    def _get_book_title(self, book_id: int) -> str:
        """서적 제목 반환"""
        book = self.books.get(book_id, {})
        return book.get('title_ko', f'Unknown({book_id})')
    
    def _validate_empty_content(self, report: ValidationReport):
        """빈 콘텐츠 검사"""
        for chunk in self.chunks:
            content = chunk.get('content', '')
            
            # 완전 비어있음
            if not content or not content.strip():
                report.add_issue(ValidationIssue(
                    chunk_id=str(chunk['id']),
                    chunk_uid=chunk['chunk_uid'],
                    book_title=self._get_book_title(chunk['book_id']),
                    issue_type="empty_content",
                    severity="critical",
                    message="콘텐츠가 비어있습니다",
                    suggestion="해당 청크 삭제 또는 원본에서 재수집"
                ))
            
            # 너무 짧음 (의미 없는 단편)
            elif len(content.strip()) < 10:
                report.add_issue(ValidationIssue(
                    chunk_id=str(chunk['id']),
                    chunk_uid=chunk['chunk_uid'],
                    book_title=self._get_book_title(chunk['book_id']),
                    issue_type="empty_content",
                    severity="warning",
                    message=f"콘텐츠가 너무 짧습니다 ({len(content.strip())}자)",
                    details={"content_preview": content[:50]},
                    suggestion="상위/하위 청크와 병합 검토"
                ))
    
    def _validate_duplicates(self, report: ValidationReport):
        """중복 청크 검사"""
        # 콘텐츠 해시 기반 중복 검사
        content_map = defaultdict(list)
        
        for chunk in self.chunks:
            content = chunk.get('content', '').strip()
            if content:
                # 정규화 (공백/줄바꿈 통일)
                normalized = re.sub(r'\s+', ' ', content)
                content_map[normalized].append(chunk)
        
        # 중복 그룹 식별
        for content, chunks in content_map.items():
            if len(chunks) > 1:
                # 첫 번째는 원본으로 간주
                for dup_chunk in chunks[1:]:
                    report.add_issue(ValidationIssue(
                        chunk_id=str(dup_chunk['id']),
                        chunk_uid=dup_chunk['chunk_uid'],
                        book_title=self._get_book_title(dup_chunk['book_id']),
                        issue_type="duplicate",
                        severity="warning",
                        message=f"중복 콘텐츠 발견 (원본: {chunks[0]['chunk_uid']})",
                        details={
                            "original_chunk_uid": chunks[0]['chunk_uid'],
                            "content_preview": content[:100]
                        },
                        suggestion="중복 청크 삭제 검토"
                    ))
    
    def _validate_broken_markup(self, report: ValidationReport):
        """깨진 마크업 검사"""
        for chunk in self.chunks:
            content = chunk.get('content', '')
            
            for pattern, desc in self.BROKEN_MARKUP_PATTERNS:
                matches = re.findall(pattern, content)
                if matches:
                    report.add_issue(ValidationIssue(
                        chunk_id=str(chunk['id']),
                        chunk_uid=chunk['chunk_uid'],
                        book_title=self._get_book_title(chunk['book_id']),
                        issue_type="broken_markup",
                        severity="warning",
                        message=f"깨진 마크업: {desc}",
                        details={
                            "pattern": pattern,
                            "matches": matches[:5],  # 최대 5개
                            "match_count": len(matches)
                        },
                        suggestion="마크업 제거 또는 수정 필요"
                    ))
    
    def _validate_invalid_chars(self, report: ValidationReport):
        """비정상 문자 검사"""
        for chunk in self.chunks:
            content = chunk.get('content', '')
            
            for pattern, desc in self.INVALID_CHAR_PATTERNS:
                matches = re.findall(pattern, content)
                if matches:
                    report.add_issue(ValidationIssue(
                        chunk_id=str(chunk['id']),
                        chunk_uid=chunk['chunk_uid'],
                        book_title=self._get_book_title(chunk['book_id']),
                        issue_type="invalid_chars",
                        severity="critical",
                        message=f"비정상 문자 발견: {desc}",
                        details={
                            "char_codes": [hex(ord(c)) for c in matches[:10]],
                            "count": len(matches)
                        },
                        suggestion="문자 인코딩 확인 및 정리 필요"
                    ))
    
    def _validate_hierarchy(self, report: ValidationReport):
        """계층 구조 검사"""
        # chunk_uid로 인덱싱
        uid_map = {c['chunk_uid']: c for c in self.chunks}
        
        for chunk in self.chunks:
            parent_uid = chunk.get('parent_chunk_uid')
            
            # 부모가 지정되었지만 존재하지 않음
            if parent_uid and parent_uid not in uid_map:
                report.add_issue(ValidationIssue(
                    chunk_id=str(chunk['id']),
                    chunk_uid=chunk['chunk_uid'],
                    book_title=self._get_book_title(chunk['book_id']),
                    issue_type="hierarchy",
                    severity="warning",
                    message=f"부모 청크가 존재하지 않음: {parent_uid}",
                    details={"missing_parent": parent_uid},
                    suggestion="부모 참조 수정 또는 삭제"
                ))
            
            # 레벨 불일치 (부모가 있으면 부모 레벨 + 1이어야 함)
            if parent_uid and parent_uid in uid_map:
                parent = uid_map[parent_uid]
                expected_level = parent['level'] + 1
                if chunk['level'] != expected_level:
                    report.add_issue(ValidationIssue(
                        chunk_id=str(chunk['id']),
                        chunk_uid=chunk['chunk_uid'],
                        book_title=self._get_book_title(chunk['book_id']),
                        issue_type="hierarchy",
                        severity="info",
                        message=f"레벨 불일치: 현재 {chunk['level']}, 예상 {expected_level}",
                        details={
                            "current_level": chunk['level'],
                            "expected_level": expected_level,
                            "parent_level": parent['level']
                        },
                        suggestion="레벨 값 검토"
                    ))
    
    def _validate_sequences(self, report: ValidationReport):
        """시퀀스 번호 검사"""
        # 서적별, 부모별 그룹화
        groups = defaultdict(list)
        
        for chunk in self.chunks:
            key = (chunk['book_id'], chunk.get('parent_chunk_uid', ''), chunk['level'])
            groups[key].append(chunk)
        
        for key, chunks in groups.items():
            # 시퀀스 번호로 정렬
            sorted_chunks = sorted(chunks, key=lambda c: c.get('sequence_num', 0))
            seq_nums = [c.get('sequence_num', 0) for c in sorted_chunks]
            
            # 중복 시퀀스
            seq_counts = Counter(seq_nums)
            for seq, count in seq_counts.items():
                if count > 1:
                    dup_chunks = [c for c in sorted_chunks if c.get('sequence_num', 0) == seq]
                    for chunk in dup_chunks[1:]:
                        report.add_issue(ValidationIssue(
                            chunk_id=str(chunk['id']),
                            chunk_uid=chunk['chunk_uid'],
                            book_title=self._get_book_title(chunk['book_id']),
                            issue_type="sequence",
                            severity="info",
                            message=f"중복 시퀀스 번호: {seq}",
                            details={"sequence_num": seq, "level": chunk['level']},
                            suggestion="시퀀스 번호 재정렬 필요"
                        ))
            
            # 시퀀스 갭 (0, 1, 2, 5 처럼 3, 4가 빠진 경우)
            if seq_nums:
                expected = set(range(min(seq_nums), max(seq_nums) + 1))
                actual = set(seq_nums)
                gaps = expected - actual
                
                if gaps and len(gaps) <= 10:  # 갭이 너무 많으면 의도적일 수 있음
                    book_id, parent_uid, level = key
                    report.add_issue(ValidationIssue(
                        chunk_id="N/A",
                        chunk_uid=f"book_{book_id}_level_{level}",
                        book_title=self._get_book_title(book_id),
                        issue_type="sequence",
                        severity="info",
                        message=f"시퀀스 갭 발견: {sorted(gaps)}",
                        details={
                            "level": level,
                            "parent": parent_uid,
                            "missing_sequences": sorted(gaps)
                        },
                        suggestion="누락된 청크 확인 또는 시퀀스 재정렬"
                    ))
    
    def _generate_summary(self, report: ValidationReport) -> Dict:
        """검증 요약 생성"""
        summary = {
            "total_issues": len(report.issues),
            "by_severity": {
                "critical": 0,
                "warning": 0,
                "info": 0
            },
            "by_type": {},
            "by_book": {}
        }
        
        for issue in report.issues:
            # 심각도별
            summary["by_severity"][issue.severity] += 1
            
            # 유형별
            if issue.issue_type not in summary["by_type"]:
                summary["by_type"][issue.issue_type] = 0
            summary["by_type"][issue.issue_type] += 1
            
            # 서적별
            if issue.book_title not in summary["by_book"]:
                summary["by_book"][issue.book_title] = 0
            summary["by_book"][issue.book_title] += 1
        
        return summary


def save_report(report: ValidationReport, output_dir: Path = None):
    """리포트 저장"""
    if output_dir is None:
        output_dir = PROJECT_ROOT / "reports" / "quality"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = output_dir / f"structural_validation_{timestamp}.json"
    
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
    
    return report_file


def print_summary(report: ValidationReport):
    """요약 출력"""
    print("\n" + "=" * 60)
    print("  검증 결과 요약")
    print("=" * 60)
    
    summary = report.summary
    print(f"\n  총 청크 수: {report.total_chunks}")
    print(f"  총 이슈 수: {summary['total_issues']}")
    
    print("\n  [심각도별]")
    for severity, count in summary['by_severity'].items():
        icon = "[CRITICAL]" if severity == "critical" else ("[WARNING]" if severity == "warning" else "[INFO]")
        print(f"    {icon} {severity}: {count}")
    
    print("\n  [유형별]")
    for issue_type, count in summary['by_type'].items():
        print(f"    - {issue_type}: {count}")
    
    print("\n  [서적별]")
    for book, count in summary['by_book'].items():
        print(f"    - {book}: {count}")


def main():
    print("\n" + "=" * 60)
    print("  구조적 오류 검증 도구")
    print("=" * 60)
    print(f"  시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        validator = StructuralValidator()
        report = validator.validate_all()
        
        # 요약 출력
        print_summary(report)
        
        # 리포트 저장
        report_file = save_report(report)
        print(f"\n  리포트 저장: {report_file}")
        
        # 심각한 이슈가 있으면 경고
        critical_count = report.summary['by_severity']['critical']
        if critical_count > 0:
            print(f"\n  [WARNING] {critical_count}개의 심각한 이슈가 발견되었습니다!")
            print("  리포트를 확인하고 수정 조치를 취하세요.")
        
        return 0
        
    except Exception as e:
        print(f"\n  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
