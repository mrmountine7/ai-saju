"""
전체 품질검증 실행 스크립트
==========================
모든 검증을 순차적으로 실행하고 통합 리포트를 생성합니다.

사용법:
    python scripts/data_quality/run_all_validations.py [--backup] [--sample N]
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

# 프로젝트 루트 설정
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts" / "data_quality"))

from backup_data import main as run_backup
from structural_validator import StructuralValidator, save_report as save_structural
from logical_validator import LogicalValidator, save_report as save_logical
from cross_validator import CrossValidator, save_report as save_cross


def generate_integrated_report(structural_report, logical_report, cross_report, output_dir: Path):
    """통합 리포트 생성"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 통합 요약
    integrated = {
        "timestamp": datetime.now().isoformat(),
        "validation_modules": {
            "structural": {
                "total_chunks": structural_report.total_chunks,
                "issues_found": len(structural_report.issues),
                "critical": structural_report.summary['by_severity']['critical'],
                "warning": structural_report.summary['by_severity']['warning'],
            },
            "logical": {
                "total_checked": logical_report.total_checked,
                "issues_found": len(logical_report.issues),
                "critical": logical_report.summary['by_severity']['critical'],
                "warning": logical_report.summary['by_severity']['warning'],
            },
            "cross_validation": {
                "patterns_checked": cross_report.patterns_checked,
                "issues_found": len(cross_report.issues),
                "critical": cross_report.summary['by_severity']['critical'],
                "warning": cross_report.summary['by_severity']['warning'],
            }
        },
        "total_summary": {
            "total_issues": (
                len(structural_report.issues) + 
                len(logical_report.issues) + 
                len(cross_report.issues)
            ),
            "total_critical": (
                structural_report.summary['by_severity']['critical'] +
                logical_report.summary['by_severity']['critical'] +
                cross_report.summary['by_severity']['critical']
            ),
            "total_warning": (
                structural_report.summary['by_severity']['warning'] +
                logical_report.summary['by_severity']['warning'] +
                cross_report.summary['by_severity']['warning']
            ),
        },
        "recommendations": []
    }
    
    # 권장 조치 생성
    if integrated['total_summary']['total_critical'] > 0:
        integrated['recommendations'].append({
            "priority": "high",
            "action": "심각한 이슈 즉시 수정",
            "count": integrated['total_summary']['total_critical'],
            "details": "빈 콘텐츠, 비정상 문자, 깨진 인코딩 등 즉시 수정 필요"
        })
    
    if integrated['validation_modules']['structural']['warning'] > 10:
        integrated['recommendations'].append({
            "priority": "medium",
            "action": "중복 청크 정리",
            "details": "중복 콘텐츠를 제거하여 검색 품질 향상"
        })
    
    if integrated['validation_modules']['cross_validation']['issues_found'] > 0:
        integrated['recommendations'].append({
            "priority": "low",
            "action": "서적간 일관성 검토",
            "details": "전문가 검토를 통한 해석 차이 확인"
        })
    
    # 파일 저장
    report_file = output_dir / f"integrated_report_{timestamp}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(integrated, f, ensure_ascii=False, indent=2)
    
    # 마크다운 요약 생성
    md_content = generate_markdown_summary(integrated)
    md_file = output_dir / f"quality_report_{timestamp}.md"
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    return report_file, md_file, integrated


def generate_markdown_summary(integrated: dict) -> str:
    """마크다운 형식 요약 생성"""
    timestamp = datetime.fromisoformat(integrated['timestamp'])
    
    md = f"""# 데이터 품질검증 리포트

생성일시: {timestamp.strftime('%Y년 %m월 %d일 %H:%M:%S')}

## 📊 전체 요약

| 항목 | 수치 |
|------|------|
| 총 이슈 수 | {integrated['total_summary']['total_issues']} |
| 심각 (Critical) | {integrated['total_summary']['total_critical']} |
| 경고 (Warning) | {integrated['total_summary']['total_warning']} |

## 📋 모듈별 결과

### 1. 구조적 검증

- 검사 청크 수: {integrated['validation_modules']['structural']['total_chunks']}
- 발견된 이슈: {integrated['validation_modules']['structural']['issues_found']}
- 심각: {integrated['validation_modules']['structural']['critical']} / 경고: {integrated['validation_modules']['structural']['warning']}

검출 항목:
- 빈 콘텐츠 / 누락 필드
- 중복 청크
- 깨진 위키 마크업
- 비정상 문자 (인코딩 오류)
- 계층 구조 무결성
- 시퀀스 번호 오류

### 2. 논리적 검증

- 검사 청크 수: {integrated['validation_modules']['logical']['total_checked']}
- 발견된 이슈: {integrated['validation_modules']['logical']['issues_found']}
- 심각: {integrated['validation_modules']['logical']['critical']} / 경고: {integrated['validation_modules']['logical']['warning']}

검출 항목:
- 명리학 용어 정확성
- 한자-한글 대응 일관성
- 문맥 연속성
- LLM 기반 논리 오류 검사

### 3. 교차 검증 (서적간 비교)

- 검증 개념 수: {integrated['validation_modules']['cross_validation']['patterns_checked']}
- 발견된 이슈: {integrated['validation_modules']['cross_validation']['issues_found']}
- 심각: {integrated['validation_modules']['cross_validation']['critical']} / 경고: {integrated['validation_modules']['cross_validation']['warning']}

검출 항목:
- 서적간 모순
- 용어 사용 차이
- 해석 차이
- 커버리지 누락

## 🔧 권장 조치

"""
    
    for i, rec in enumerate(integrated.get('recommendations', []), 1):
        priority_emoji = "🔴" if rec['priority'] == 'high' else ("🟡" if rec['priority'] == 'medium' else "🔵")
        md += f"""### {i}. {priority_emoji} {rec['action']}

- 우선순위: {rec['priority'].upper()}
- 설명: {rec['details']}

"""
    
    md += """## 📝 다음 단계

1. **심각한 이슈 수정**: Critical 등급 이슈부터 순차 수정
2. **중복 제거**: 동일 콘텐츠 청크 통합 또는 삭제
3. **마크업 정리**: 깨진 위키 문법 제거
4. **전문가 검토**: 모순/해석 차이에 대한 수동 확인

---

*이 리포트는 AI 품질검증 도구에 의해 자동 생성되었습니다.*
"""
    
    return md


def main():
    parser = argparse.ArgumentParser(description='전체 품질검증 실행')
    parser.add_argument('--backup', action='store_true', help='검증 전 백업 수행')
    parser.add_argument('--sample', type=int, default=100, help='논리 검증 샘플 크기')
    parser.add_argument('--no-llm', action='store_true', help='LLM 검증 비활성화')
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("  전체 품질검증 실행")
    print("=" * 60)
    print(f"  시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    output_dir = PROJECT_ROOT / "reports" / "quality"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. 백업 (선택)
    if args.backup:
        print("\n" + "-" * 60)
        print("  [STEP 0] 데이터 백업")
        print("-" * 60)
        backup_result = run_backup()
        if backup_result != 0:
            print("  [ERROR] 백업 실패. 검증을 중단합니다.")
            return 1
    
    # 2. 구조적 검증
    print("\n" + "-" * 60)
    print("  [STEP 1] 구조적 검증")
    print("-" * 60)
    try:
        struct_validator = StructuralValidator()
        structural_report = struct_validator.validate_all()
        save_structural(structural_report, output_dir)
    except Exception as e:
        print(f"  [ERROR] 구조적 검증 실패: {e}")
        return 1
    
    # 3. 논리적 검증
    print("\n" + "-" * 60)
    print("  [STEP 2] 논리적 검증")
    print("-" * 60)
    try:
        logic_validator = LogicalValidator(use_llm=not args.no_llm)
        logical_report = logic_validator.validate_all(sample_size=args.sample)
        save_logical(logical_report, output_dir)
    except Exception as e:
        print(f"  [ERROR] 논리적 검증 실패: {e}")
        return 1
    
    # 4. 교차 검증
    print("\n" + "-" * 60)
    print("  [STEP 3] 교차 검증")
    print("-" * 60)
    try:
        cross_validator = CrossValidator(use_llm=not args.no_llm)
        cross_report = cross_validator.validate_all()
        save_cross(cross_report, output_dir)
    except Exception as e:
        print(f"  [ERROR] 교차 검증 실패: {e}")
        return 1
    
    # 5. 통합 리포트 생성
    print("\n" + "-" * 60)
    print("  [STEP 4] 통합 리포트 생성")
    print("-" * 60)
    
    json_file, md_file, integrated = generate_integrated_report(
        structural_report, logical_report, cross_report, output_dir
    )
    
    # 최종 요약 출력
    print("\n" + "=" * 60)
    print("  품질검증 완료")
    print("=" * 60)
    
    total = integrated['total_summary']
    print(f"\n  총 이슈 수: {total['total_issues']}")
    print(f"    🔴 심각 (Critical): {total['total_critical']}")
    print(f"    🟡 경고 (Warning): {total['total_warning']}")
    
    print(f"\n  리포트 저장:")
    print(f"    JSON: {json_file}")
    print(f"    마크다운: {md_file}")
    
    if integrated['recommendations']:
        print(f"\n  권장 조치:")
        for rec in integrated['recommendations']:
            priority_emoji = "🔴" if rec['priority'] == 'high' else ("🟡" if rec['priority'] == 'medium' else "🔵")
            print(f"    {priority_emoji} {rec['action']}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
