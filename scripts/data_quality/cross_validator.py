"""
교차 검증기 (서적간 비교)
=========================
5대 고전 간의 교차 검증을 수행하여 일관성을 확인합니다.

검증 항목:
1. 동일 개념의 서로 다른 설명 비교
2. 격국별 설명의 일관성
3. 용어 사용의 통일성
4. 인용/참조 관계 검증

사용법:
    python scripts/data_quality/cross_validator.py [--pattern 정관격]
"""

import os
import sys
import json
import re
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import argparse

# 프로젝트 루트 설정
PROJECT_ROOT = Path(__file__).parent.parent.parent
PIPELINE_PATH = Path(r"C:\AgenticAI_Trainning\그래프DB(고전문헌)구축\saju-classics-pipeline")
sys.path.insert(0, str(PIPELINE_PATH))

from dotenv import load_dotenv
load_dotenv(PIPELINE_PATH / ".env")

from supabase import create_client
from openai import OpenAI

# 환경 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


@dataclass
class CrossValidationIssue:
    """교차 검증 이슈"""
    pattern_name: str
    issue_type: str  # contradiction, terminology_diff, interpretation_diff, missing_coverage
    severity: str
    message: str
    books_involved: List[str] = field(default_factory=list)
    details: Dict = field(default_factory=dict)
    llm_analysis: str = ""
    suggestion: str = ""


@dataclass
class CrossValidationReport:
    """교차 검증 리포트"""
    timestamp: str
    patterns_checked: int
    books_compared: List[str] = field(default_factory=list)
    issues: List[CrossValidationIssue] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)
    comparisons: List[Dict] = field(default_factory=list)
    
    def add_issue(self, issue: CrossValidationIssue):
        self.issues.append(issue)
    
    def to_dict(self):
        return {
            "timestamp": self.timestamp,
            "patterns_checked": self.patterns_checked,
            "books_compared": self.books_compared,
            "issue_count": len(self.issues),
            "summary": self.summary,
            "issues": [asdict(i) for i in self.issues],
            "comparisons": self.comparisons
        }


class CrossValidator:
    """서적간 교차 검증기"""
    
    # 비교 대상 핵심 개념들
    CORE_CONCEPTS = [
        # 기본 10격
        {"name_ko": "정관격", "name_zh": "正官格", "keywords": ["正官", "官星", "以官為用"]},
        {"name_ko": "편관격", "name_zh": "偏官格", "keywords": ["偏官", "七殺", "殺星"]},
        {"name_ko": "정재격", "name_zh": "正財格", "keywords": ["正財", "財星"]},
        {"name_ko": "편재격", "name_zh": "偏財格", "keywords": ["偏財"]},
        {"name_ko": "정인격", "name_zh": "正印格", "keywords": ["正印", "印星", "印綬"]},
        {"name_ko": "편인격", "name_zh": "偏印格", "keywords": ["偏印", "梟神", "梟印"]},
        {"name_ko": "식신격", "name_zh": "食神格", "keywords": ["食神", "食神吐秀"]},
        {"name_ko": "상관격", "name_zh": "傷官格", "keywords": ["傷官"]},
        
        # 핵심 이론
        {"name_ko": "용신론", "name_zh": "用神論", "keywords": ["用神", "喜神", "忌神"]},
        {"name_ko": "격국론", "name_zh": "格局論", "keywords": ["格局", "成格", "破格"]},
        {"name_ko": "합충형해", "name_zh": "合沖刑害", "keywords": ["合", "沖", "刑", "害"]},
    ]
    
    def __init__(self, use_llm: bool = True):
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase 환경변수가 설정되지 않았습니다.")
        
        self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.use_llm = use_llm
        
        if use_llm and DEEPSEEK_API_KEY:
            self.llm_client = OpenAI(
                api_key=DEEPSEEK_API_KEY,
                base_url=DEEPSEEK_BASE_URL
            )
        elif use_llm and OPENAI_API_KEY:
            self.llm_client = OpenAI(api_key=OPENAI_API_KEY)
        else:
            self.use_llm = False
            print("  [WARNING] LLM API 키가 없습니다. 기본 비교만 수행합니다.")
        
        # 벡터 검색용
        if OPENAI_API_KEY:
            self.embed_client = OpenAI(api_key=OPENAI_API_KEY)
        else:
            self.embed_client = None
        
        self.books = {}
        self.patterns = []
    
    def load_data(self):
        """데이터 로드"""
        print("  데이터 로드 중...")
        
        # 서적 정보
        books_resp = self.client.table('books').select('*').execute()
        self.books = {b['id']: b for b in books_resp.data}
        print(f"    서적 수: {len(self.books)}")
        
        # 패턴 정보
        patterns_resp = self.client.table('patterns').select('*').execute()
        self.patterns = patterns_resp.data
        print(f"    패턴 수: {len(self.patterns)}")
    
    def search_chunks_by_keywords(self, keywords: List[str], limit: int = 50) -> Dict[str, List[Dict]]:
        """키워드로 청크 검색 (서적별 그룹화)"""
        results_by_book = defaultdict(list)
        
        for keyword in keywords:
            # 텍스트 검색 (content에서 키워드 포함)
            resp = self.client.table('chunks').select(
                'id, chunk_uid, book_id, title, content, level'
            ).ilike('content', f'%{keyword}%').eq('level', 4).limit(limit).execute()
            
            for chunk in resp.data:
                book_id = chunk['book_id']
                book_title = self.books.get(book_id, {}).get('title_ko', f'Unknown({book_id})')
                
                # 중복 방지
                existing_ids = [c['id'] for c in results_by_book[book_title]]
                if chunk['id'] not in existing_ids:
                    results_by_book[book_title].append(chunk)
        
        return dict(results_by_book)
    
    def search_chunks_by_vector(self, query: str, limit: int = 10) -> Dict[str, List[Dict]]:
        """벡터 검색으로 관련 청크 찾기"""
        if not self.embed_client:
            return {}
        
        try:
            # 쿼리 임베딩
            emb_resp = self.embed_client.embeddings.create(
                model="text-embedding-3-large",
                input=query
            )
            query_embedding = emb_resp.data[0].embedding
            
            # 벡터 검색
            search_resp = self.client.rpc('match_chunks', {
                'query_embedding': query_embedding,
                'match_threshold': 0.3,
                'match_count': limit
            }).execute()
            
            results_by_book = defaultdict(list)
            for result in search_resp.data:
                book_id = result.get('book_id')
                book_title = self.books.get(book_id, {}).get('title_ko', f'Unknown({book_id})')
                results_by_book[book_title].append(result)
            
            return dict(results_by_book)
            
        except Exception as e:
            print(f"    [벡터 검색 오류] {e}")
            return {}
    
    def compare_concept_across_books(self, concept: Dict) -> Tuple[Dict, List[CrossValidationIssue]]:
        """하나의 개념에 대해 서적간 비교"""
        issues = []
        comparison = {
            "concept": concept['name_ko'],
            "concept_zh": concept['name_zh'],
            "books": {}
        }
        
        # 키워드 검색
        chunks_by_book = self.search_chunks_by_keywords(concept['keywords'])
        
        # 벡터 검색 추가
        vector_query = f"{concept['name_ko']} {concept['name_zh']} 해석 설명"
        vector_results = self.search_chunks_by_vector(vector_query)
        
        # 결과 병합
        for book, chunks in vector_results.items():
            if book not in chunks_by_book:
                chunks_by_book[book] = []
            existing_ids = [c['id'] for c in chunks_by_book[book]]
            for chunk in chunks:
                if chunk['id'] not in existing_ids:
                    chunks_by_book[book].append(chunk)
        
        # 서적별 정리
        for book_title, chunks in chunks_by_book.items():
            if chunks:
                # 대표 청크 선택 (가장 긴 것)
                main_chunk = max(chunks, key=lambda c: len(c.get('content', '')))
                comparison["books"][book_title] = {
                    "chunk_count": len(chunks),
                    "main_chunk_uid": main_chunk['chunk_uid'],
                    "main_content_preview": main_chunk.get('content', '')[:500]
                }
        
        # 커버리지 검사
        all_books = set(b['title_ko'] for b in self.books.values())
        covered_books = set(chunks_by_book.keys())
        missing_books = all_books - covered_books
        
        if missing_books and len(covered_books) > 0:
            issues.append(CrossValidationIssue(
                pattern_name=concept['name_ko'],
                issue_type="missing_coverage",
                severity="info",
                message=f"일부 서적에서 '{concept['name_ko']}' 관련 내용을 찾지 못함",
                books_involved=list(missing_books),
                details={"found_in": list(covered_books)},
                suggestion="해당 서적에 관련 내용이 없는지 수동 확인 필요"
            ))
        
        # LLM 비교 분석
        if self.use_llm and len(covered_books) >= 2:
            llm_issues = self._llm_compare_interpretations(concept, chunks_by_book)
            issues.extend(llm_issues)
        
        return comparison, issues
    
    def _llm_compare_interpretations(self, concept: Dict, chunks_by_book: Dict) -> List[CrossValidationIssue]:
        """LLM을 사용한 해석 비교"""
        issues = []
        
        # 서적별 대표 텍스트 추출
        book_texts = {}
        for book_title, chunks in chunks_by_book.items():
            if chunks:
                combined_text = "\n".join([c.get('content', '')[:1000] for c in chunks[:3]])
                book_texts[book_title] = combined_text[:2000]
        
        if len(book_texts) < 2:
            return issues
        
        # 비교 프롬프트
        books_content = "\n\n".join([
            f"[{book}]\n{text}" for book, text in book_texts.items()
        ])
        
        prompt = f"""다음은 사주명리학 5대 고전에서 '{concept['name_ko']}({concept['name_zh']})'에 대한 설명입니다.
각 서적의 설명을 비교 분석해주세요.

{books_content}

다음 항목을 확인하고 JSON 형식으로 응답해주세요:
1. has_contradiction: 서적간 모순이 있는지 (true/false)
2. has_terminology_diff: 용어 사용이 다른 부분이 있는지 (true/false)  
3. has_interpretation_diff: 해석의 차이가 있는지 (true/false)
4. contradictions: 모순되는 내용 목록 (배열, 각 항목은 "서적A vs 서적B: 내용" 형식)
5. terminology_diffs: 용어 차이 목록 (배열)
6. interpretation_diffs: 해석 차이 목록 (배열)
7. synthesis: 종합 분석 (한글 문장)

JSON만 응답해주세요:"""

        try:
            response = self.llm_client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "당신은 사주명리학 전문가입니다. 여러 고전 문헌의 해석을 비교 분석합니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            result_text = response.choices[0].message.content
            
            # JSON 파싱
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # 모순 이슈
                if result.get('has_contradiction') and result.get('contradictions'):
                    for contradiction in result['contradictions']:
                        issues.append(CrossValidationIssue(
                            pattern_name=concept['name_ko'],
                            issue_type="contradiction",
                            severity="warning",
                            message=f"서적간 모순 발견",
                            books_involved=list(book_texts.keys()),
                            details={"contradiction": contradiction},
                            llm_analysis=result.get('synthesis', ''),
                            suggestion="전문가 검토 필요"
                        ))
                
                # 용어 차이
                if result.get('has_terminology_diff') and result.get('terminology_diffs'):
                    issues.append(CrossValidationIssue(
                        pattern_name=concept['name_ko'],
                        issue_type="terminology_diff",
                        severity="info",
                        message="서적간 용어 사용 차이 발견",
                        books_involved=list(book_texts.keys()),
                        details={"differences": result['terminology_diffs']},
                        suggestion="용어 통일 여부 검토"
                    ))
                
                # 해석 차이 (참고용)
                if result.get('has_interpretation_diff') and result.get('interpretation_diffs'):
                    issues.append(CrossValidationIssue(
                        pattern_name=concept['name_ko'],
                        issue_type="interpretation_diff",
                        severity="info",
                        message="서적간 해석 차이 발견 (정상적일 수 있음)",
                        books_involved=list(book_texts.keys()),
                        details={"differences": result['interpretation_diffs']},
                        llm_analysis=result.get('synthesis', ''),
                        suggestion="해석 다양성으로 데이터 품질에 영향 없음"
                    ))
        
        except Exception as e:
            print(f"    [LLM 비교 오류] {concept['name_ko']}: {e}")
        
        return issues
    
    def validate_all(self, target_pattern: str = None) -> CrossValidationReport:
        """전체 교차 검증 실행"""
        print("\n" + "=" * 60)
        print("  서적간 교차 검증 시작")
        print("=" * 60)
        
        self.load_data()
        
        report = CrossValidationReport(
            timestamp=datetime.now().isoformat(),
            patterns_checked=0,
            books_compared=[b['title_ko'] for b in self.books.values()]
        )
        
        # 검증 대상 개념 선정
        concepts_to_check = self.CORE_CONCEPTS
        if target_pattern:
            concepts_to_check = [c for c in self.CORE_CONCEPTS if target_pattern in c['name_ko']]
            if not concepts_to_check:
                print(f"  [WARNING] '{target_pattern}' 패턴을 찾을 수 없습니다.")
                return report
        
        print(f"\n  검증 대상 개념: {len(concepts_to_check)}개")
        
        for i, concept in enumerate(concepts_to_check):
            print(f"\n  [{i+1}/{len(concepts_to_check)}] {concept['name_ko']} ({concept['name_zh']}) 비교 중...")
            
            comparison, issues = self.compare_concept_across_books(concept)
            report.comparisons.append(comparison)
            
            for issue in issues:
                report.add_issue(issue)
            
            report.patterns_checked += 1
        
        # 요약 생성
        report.summary = self._generate_summary(report)
        
        return report
    
    def _generate_summary(self, report: CrossValidationReport) -> Dict:
        """검증 요약 생성"""
        summary = {
            "total_issues": len(report.issues),
            "by_severity": {"critical": 0, "warning": 0, "info": 0},
            "by_type": {},
            "coverage_analysis": {}
        }
        
        for issue in report.issues:
            summary["by_severity"][issue.severity] += 1
            
            if issue.issue_type not in summary["by_type"]:
                summary["by_type"][issue.issue_type] = 0
            summary["by_type"][issue.issue_type] += 1
        
        # 커버리지 분석
        for comparison in report.comparisons:
            concept = comparison['concept']
            covered_books = list(comparison['books'].keys())
            summary["coverage_analysis"][concept] = {
                "books_with_content": covered_books,
                "coverage_rate": len(covered_books) / len(report.books_compared) if report.books_compared else 0
            }
        
        return summary


def save_report(report: CrossValidationReport, output_dir: Path = None):
    """리포트 저장"""
    if output_dir is None:
        output_dir = PROJECT_ROOT / "reports" / "quality"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = output_dir / f"cross_validation_{timestamp}.json"
    
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
    
    return report_file


def print_summary(report: CrossValidationReport):
    """요약 출력"""
    print("\n" + "=" * 60)
    print("  교차 검증 결과 요약")
    print("=" * 60)
    
    summary = report.summary
    print(f"\n  비교 서적: {', '.join(report.books_compared)}")
    print(f"  검증 개념 수: {report.patterns_checked}")
    print(f"  총 이슈 수: {summary['total_issues']}")
    
    print("\n  [심각도별]")
    for severity, count in summary['by_severity'].items():
        icon = "[CRITICAL]" if severity == "critical" else ("[WARNING]" if severity == "warning" else "[INFO]")
        print(f"    {icon} {severity}: {count}")
    
    if summary['by_type']:
        print("\n  [유형별]")
        for issue_type, count in summary['by_type'].items():
            print(f"    - {issue_type}: {count}")
    
    print("\n  [개념별 커버리지]")
    for concept, coverage in summary.get('coverage_analysis', {}).items():
        rate = coverage.get('coverage_rate', 0) * 100
        books = coverage.get('books_with_content', [])
        print(f"    - {concept}: {rate:.0f}% ({len(books)}개 서적)")


def main():
    parser = argparse.ArgumentParser(description='서적간 교차 검증 도구')
    parser.add_argument('--pattern', type=str, help='특정 패턴만 검증 (예: 정관격)')
    parser.add_argument('--no-llm', action='store_true', help='LLM 검증 비활성화')
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("  서적간 교차 검증 도구")
    print("=" * 60)
    print(f"  시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        validator = CrossValidator(use_llm=not args.no_llm)
        report = validator.validate_all(target_pattern=args.pattern)
        
        print_summary(report)
        
        report_file = save_report(report)
        print(f"\n  리포트 저장: {report_file}")
        
        return 0
        
    except Exception as e:
        print(f"\n  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
