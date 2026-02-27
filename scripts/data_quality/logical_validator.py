"""
논리적 일관성 검사기
====================
DeepSeek LLM을 사용하여 고전문헌 데이터의 논리적 일관성을 검사합니다.

검증 항목:
1. 명리학 용어 정확성 (천간/지지/오행/십신 등)
2. 한자-한글 대응 일관성
3. 문맥 적절성 (앞뒤 청크와의 연결)
4. 격국/용신 설명의 논리적 타당성

사용법:
    python scripts/data_quality/logical_validator.py [--sample N]
"""

import os
import sys
import json
import re
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
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


# 명리학 기본 용어 사전
MYEONGRI_TERMS = {
    # 천간 (天干)
    "천간": {
        "甲": "갑", "乙": "을", "丙": "병", "丁": "정", "戊": "무",
        "己": "기", "庚": "경", "辛": "신", "壬": "임", "癸": "계"
    },
    # 지지 (地支)
    "지지": {
        "子": "자", "丑": "축", "寅": "인", "卯": "묘", "辰": "진", "巳": "사",
        "午": "오", "未": "미", "申": "신", "酉": "유", "戌": "술", "亥": "해"
    },
    # 오행 (五行)
    "오행": {
        "木": "목", "火": "화", "土": "토", "金": "금", "水": "수"
    },
    # 십신 (十神)
    "십신": {
        "比肩": "비견", "劫財": "겁재", "食神": "식신", "傷官": "상관",
        "偏財": "편재", "正財": "정재", "偏官": "편관", "正官": "정관",
        "偏印": "편인", "正印": "정인", "七殺": "칠살", "梟神": "효신"
    },
    # 격국 (格局)
    "격국": {
        "正官格": "정관격", "偏官格": "편관격", "正財格": "정재격",
        "偏財格": "편재격", "正印格": "정인격", "偏印格": "편인격",
        "食神格": "식신격", "傷官格": "상관격", "建祿格": "건록격",
        "羊刃格": "양인격", "從格": "종격", "化格": "화격"
    }
}


@dataclass
class LogicalIssue:
    """논리적 검증 이슈"""
    chunk_id: str
    chunk_uid: str
    book_title: str
    issue_type: str  # term_error, translation_mismatch, context_break, logic_error
    severity: str    # critical, warning, info
    message: str
    details: Dict = field(default_factory=dict)
    llm_analysis: str = ""
    suggestion: str = ""


@dataclass
class LogicalReport:
    """논리적 검증 리포트"""
    timestamp: str
    total_checked: int
    issues: List[LogicalIssue] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)
    
    def add_issue(self, issue: LogicalIssue):
        self.issues.append(issue)
    
    def to_dict(self):
        return {
            "timestamp": self.timestamp,
            "total_checked": self.total_checked,
            "issue_count": len(self.issues),
            "summary": self.summary,
            "issues": [asdict(i) for i in self.issues]
        }


class LogicalValidator:
    """논리적 일관성 검사기"""
    
    def __init__(self, use_llm: bool = True):
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase 환경변수가 설정되지 않았습니다.")
        
        self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.use_llm = use_llm
        
        if use_llm:
            if not DEEPSEEK_API_KEY:
                print("  [WARNING] DeepSeek API 키가 없습니다. LLM 검증이 비활성화됩니다.")
                self.use_llm = False
            else:
                self.llm_client = OpenAI(
                    api_key=DEEPSEEK_API_KEY,
                    base_url=DEEPSEEK_BASE_URL
                )
        
        self.chunks = []
        self.books = {}
    
    def load_data(self, sample_size: int = None):
        """데이터 로드"""
        print("  데이터 로드 중...")
        
        # 서적 정보
        books_resp = self.client.table('books').select('*').execute()
        self.books = {b['id']: b for b in books_resp.data}
        
        # 청크 정보
        query = self.client.table('chunks').select(
            'id, chunk_uid, book_id, level, parent_chunk_uid, sequence_num, '
            'title, content, classical_text, translation, metadata'
        )
        
        if sample_size:
            # Level 4 (검색 대상 청크)를 우선 샘플링
            query = query.eq('level', 4).limit(sample_size)
        
        resp = query.execute()
        self.chunks = resp.data
        print(f"    로드된 청크 수: {len(self.chunks)}")
    
    def _get_book_title(self, book_id: int) -> str:
        book = self.books.get(book_id, {})
        return book.get('title_ko', f'Unknown({book_id})')
    
    def validate_terms(self, chunk: Dict) -> List[LogicalIssue]:
        """명리학 용어 정확성 검사"""
        issues = []
        content = chunk.get('content', '')
        
        # 한자-한글 대응 검사
        for category, term_dict in MYEONGRI_TERMS.items():
            for hanja, hangul in term_dict.items():
                # 한자가 있는데 한글 표기가 다른 경우 탐지
                if hanja in content:
                    # 잘못된 한글 변환 패턴 찾기
                    # 예: "甲木" 다음에 "갑"이 아닌 다른 한글이 오는 경우
                    wrong_patterns = []
                    
                    # 간단한 휴리스틱: 한자 다음에 괄호 안 한글이 있는 경우
                    pattern = f'{hanja}[（(]([^）)]+)[）)]'
                    matches = re.findall(pattern, content)
                    for match in matches:
                        if hangul not in match and len(match) <= 3:
                            wrong_patterns.append(f"{hanja}({match}) - 예상: {hangul}")
                    
                    if wrong_patterns:
                        issues.append(LogicalIssue(
                            chunk_id=str(chunk['id']),
                            chunk_uid=chunk['chunk_uid'],
                            book_title=self._get_book_title(chunk['book_id']),
                            issue_type="term_error",
                            severity="warning",
                            message=f"한자-한글 대응 불일치 ({category})",
                            details={
                                "category": category,
                                "patterns": wrong_patterns
                            },
                            suggestion="한자 표기 및 한글 음역 확인 필요"
                        ))
        
        return issues
    
    def validate_with_llm(self, chunk: Dict) -> Optional[LogicalIssue]:
        """LLM을 사용한 논리적 검증"""
        if not self.use_llm:
            return None
        
        content = chunk.get('content', '')
        title = chunk.get('title', '')
        
        # 프롬프트 구성
        prompt = f"""다음은 사주명리학 고전문헌의 일부입니다. 이 텍스트의 품질을 검증해주세요.

제목: {title}
내용:
{content[:2000]}

다음 항목을 확인하고 JSON 형식으로 응답해주세요:
1. has_error: 오류가 있는지 (true/false)
2. error_type: 오류 유형 (term_error, logic_error, incomplete, none)
3. severity: 심각도 (critical, warning, info)
4. description: 오류 설명 (한글)
5. suggestion: 수정 제안 (한글)

검증 기준:
- 명리학 용어가 정확하게 사용되었는지
- 오행 상생상극 관계가 올바른지
- 격국 설명이 논리적으로 타당한지
- 문장이 완결되고 의미가 통하는지

오류가 없으면 has_error: false로 응답하세요.
JSON만 응답해주세요:"""

        try:
            response = self.llm_client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "당신은 사주명리학 전문가입니다. 고전문헌 텍스트의 품질을 엄격하게 검증합니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content
            
            # JSON 파싱
            json_match = re.search(r'\{[^}]+\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                if result.get('has_error', False):
                    return LogicalIssue(
                        chunk_id=str(chunk['id']),
                        chunk_uid=chunk['chunk_uid'],
                        book_title=self._get_book_title(chunk['book_id']),
                        issue_type=result.get('error_type', 'logic_error'),
                        severity=result.get('severity', 'warning'),
                        message=result.get('description', 'LLM이 오류를 감지함'),
                        llm_analysis=result_text,
                        suggestion=result.get('suggestion', '')
                    )
            
            return None
            
        except Exception as e:
            print(f"    [LLM ERROR] {chunk['chunk_uid']}: {e}")
            return None
    
    def validate_context_continuity(self, chunks_group: List[Dict]) -> List[LogicalIssue]:
        """문맥 연속성 검사 (같은 부모 아래 청크들)"""
        issues = []
        
        # 시퀀스 순서로 정렬
        sorted_chunks = sorted(chunks_group, key=lambda c: c.get('sequence_num', 0))
        
        for i in range(len(sorted_chunks) - 1):
            current = sorted_chunks[i]
            next_chunk = sorted_chunks[i + 1]
            
            curr_content = current.get('content', '')
            next_content = next_chunk.get('content', '')
            
            # 갑작스러운 주제 전환 탐지 (간단한 휴리스틱)
            # 실제로는 LLM을 사용하는 것이 더 정확
            
            # 1. 문장이 중간에 끊긴 경우
            if curr_content and not curr_content.rstrip().endswith(('。', '.', '」', ')', '）')):
                # 다음 청크가 소문자나 접속사로 시작하지 않으면 문제
                if next_content and not next_content.lstrip().startswith(('　', ' ', '，', ',')):
                    issues.append(LogicalIssue(
                        chunk_id=str(current['id']),
                        chunk_uid=current['chunk_uid'],
                        book_title=self._get_book_title(current['book_id']),
                        issue_type="context_break",
                        severity="info",
                        message="문장이 완결되지 않은 채로 청크가 종료됨",
                        details={
                            "current_end": curr_content[-50:] if len(curr_content) > 50 else curr_content,
                            "next_start": next_content[:50] if len(next_content) > 50 else next_content
                        },
                        suggestion="청크 경계 재조정 검토"
                    ))
        
        return issues
    
    def validate_all(self, sample_size: int = None) -> LogicalReport:
        """전체 검증 실행"""
        print("\n" + "=" * 60)
        print("  논리적 일관성 검증 시작")
        print("=" * 60)
        
        self.load_data(sample_size)
        
        report = LogicalReport(
            timestamp=datetime.now().isoformat(),
            total_checked=len(self.chunks)
        )
        
        # 1. 용어 검증
        print("\n  [1/3] 명리학 용어 검증...")
        for chunk in self.chunks:
            issues = self.validate_terms(chunk)
            for issue in issues:
                report.add_issue(issue)
        
        # 2. LLM 검증 (샘플)
        if self.use_llm:
            print("  [2/3] LLM 기반 논리 검증...")
            llm_sample = self.chunks[:min(50, len(self.chunks))]  # 최대 50개 샘플
            
            for i, chunk in enumerate(llm_sample):
                if (i + 1) % 10 == 0:
                    print(f"    진행: {i + 1}/{len(llm_sample)}")
                
                issue = self.validate_with_llm(chunk)
                if issue:
                    report.add_issue(issue)
        else:
            print("  [2/3] LLM 검증 건너뜀 (API 키 없음)")
        
        # 3. 문맥 연속성 검증
        print("  [3/3] 문맥 연속성 검증...")
        # 같은 부모 아래 청크들 그룹화
        from collections import defaultdict
        parent_groups = defaultdict(list)
        for chunk in self.chunks:
            key = (chunk['book_id'], chunk.get('parent_chunk_uid', ''))
            parent_groups[key].append(chunk)
        
        for key, group in parent_groups.items():
            if len(group) > 1:
                issues = self.validate_context_continuity(group)
                for issue in issues:
                    report.add_issue(issue)
        
        # 요약 생성
        report.summary = self._generate_summary(report)
        
        return report
    
    def _generate_summary(self, report: LogicalReport) -> Dict:
        """검증 요약 생성"""
        summary = {
            "total_issues": len(report.issues),
            "by_severity": {"critical": 0, "warning": 0, "info": 0},
            "by_type": {},
            "by_book": {}
        }
        
        for issue in report.issues:
            summary["by_severity"][issue.severity] += 1
            
            if issue.issue_type not in summary["by_type"]:
                summary["by_type"][issue.issue_type] = 0
            summary["by_type"][issue.issue_type] += 1
            
            if issue.book_title not in summary["by_book"]:
                summary["by_book"][issue.book_title] = 0
            summary["by_book"][issue.book_title] += 1
        
        return summary


def save_report(report: LogicalReport, output_dir: Path = None):
    """리포트 저장"""
    if output_dir is None:
        output_dir = PROJECT_ROOT / "reports" / "quality"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = output_dir / f"logical_validation_{timestamp}.json"
    
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
    
    return report_file


def print_summary(report: LogicalReport):
    """요약 출력"""
    print("\n" + "=" * 60)
    print("  논리적 검증 결과 요약")
    print("=" * 60)
    
    summary = report.summary
    print(f"\n  검사된 청크 수: {report.total_checked}")
    print(f"  총 이슈 수: {summary['total_issues']}")
    
    print("\n  [심각도별]")
    for severity, count in summary['by_severity'].items():
        icon = "[CRITICAL]" if severity == "critical" else ("[WARNING]" if severity == "warning" else "[INFO]")
        print(f"    {icon} {severity}: {count}")
    
    if summary['by_type']:
        print("\n  [유형별]")
        for issue_type, count in summary['by_type'].items():
            print(f"    - {issue_type}: {count}")
    
    if summary['by_book']:
        print("\n  [서적별]")
        for book, count in summary['by_book'].items():
            print(f"    - {book}: {count}")


def main():
    parser = argparse.ArgumentParser(description='논리적 일관성 검증 도구')
    parser.add_argument('--sample', type=int, help='샘플 크기 (기본: 전체)')
    parser.add_argument('--no-llm', action='store_true', help='LLM 검증 비활성화')
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("  논리적 일관성 검증 도구")
    print("=" * 60)
    print(f"  시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        validator = LogicalValidator(use_llm=not args.no_llm)
        report = validator.validate_all(sample_size=args.sample)
        
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
