# Changelog

## [2.0.0] - 2026-02-27

### 🎯 주요 기능 추가

#### 3단계 분석 모드 시스템
- **일반 모드**: 쉽고 부드러운 표현으로 사주풀이
- **고급 모드**: 명리 전문 용어를 사용한 상세 해석
- **사주가 모드**: 원문 검색, AI Q&A, 고객 관리 기능

#### 전문가(사주가) 모드 전용 기능
- 고전 원문 검색 (저장/즐겨찾기)
- AI 명리 Q&A (대화 저장/즐겨찾기)
- 고객 관리 (검색/그룹핑)
- 데이터 품질검증 대시보드

#### 데이터 품질검증 시스템
- 구조적 검증: 빈 콘텐츠, 중복, 마크업 오류, 계층 구조
- 논리적 검증: 명리학 용어, 한자-한글 대응, 문맥 연속성
- 교차 검증: 9종 고전문헌 간 일관성 비교
- 자동 백업 및 리포트 생성

### 📱 UI/UX 개선

#### 랜딩페이지
- 3단계 모드 선택 UI (일반/고급/사주가)
- 모드별 색상 차별화 (흰색/회색/보라색)
- 호버 시 기능 설명 표시
- 고전문헌 테이블 추가 (9종 상세 정보)

#### 결과페이지
- 모드별 분석 결과 뱃지 표시
- PDF 리포트 저장/다운로드
- 분석 결과 공유 (카카오톡, 복사, Web Share)

#### 기타
- 알림 시스템 (NotificationCenter)
- 토스트 메시지 시스템
- 에러 바운더리 추가
- 이용약관/개인정보처리방침 페이지

### 🗄️ 백엔드/인프라

#### 데이터베이스 테이블 (Supabase)
- `expert_saved_classics`: 저장된 고전 원문
- `expert_ai_conversations`: AI Q&A 대화 기록
- `expert_client_groups`: 고객 그룹
- `expert_clients`: 고객 정보

#### Context API
- `AnalysisModeContext`: 분석 모드 전역 상태
- `NotificationContext`: 알림 상태 관리
- `ToastContext`: 토스트 메시지 관리
- `SubscriptionContext`: 구독 상태 관리

### 📊 품질검증 결과 (2026-02-27)

| 검증 유형 | 검사 대상 | 발견 이슈 | Critical | Warning |
|-----------|-----------|-----------|----------|---------|
| 구조적 | 3,238 청크 | 3,621건 | 0 | 1,042 |
| 논리적 | 50 샘플 | 4건 | 0 | 0 |
| 교차 | 11 개념 | 7건 | 0 | 0 |

**결론**: 심각한 오류 없음. 중복(260건), 마크업(115건) 정리 권장.

### 📁 신규 파일

```
src/
├── app/components/
│   ├── ClassicsInfoPage.tsx      # 고전문헌 상세 정보
│   ├── ClientManagementPage.tsx  # 고객 관리
│   ├── DataQualityDashboard.tsx  # 품질검증 대시보드
│   ├── ErrorBoundary.tsx         # 에러 처리
│   ├── ExpertAiQnA.tsx           # AI 명리 Q&A
│   ├── ExpertClassicsSearch.tsx  # 고전 원문 검색
│   ├── ExpertModePage.tsx        # 전문가 모드 메인
│   ├── NotificationCenter.tsx    # 알림 센터
│   ├── PrivacyPage.tsx           # 개인정보처리방침
│   ├── TermsPage.tsx             # 이용약관
│   └── ... (기타 페이지)
├── contexts/
│   ├── AnalysisModeContext.tsx   # 분석 모드 상태
│   ├── NotificationContext.tsx   # 알림 상태
│   ├── SubscriptionContext.tsx   # 구독 상태
│   └── ToastContext.tsx          # 토스트 상태
├── lib/
│   ├── auth-context.tsx          # 인증 컨텍스트
│   ├── profile-context.tsx       # 프로필 컨텍스트
│   ├── saju-api-client.ts        # API 클라이언트
│   └── supabase.ts               # Supabase 클라이언트
scripts/
└── data_quality/
    ├── backup_data.py            # 데이터 백업
    ├── structural_validator.py   # 구조적 검증
    ├── logical_validator.py      # 논리적 검증
    ├── cross_validator.py        # 교차 검증
    └── run_all_validations.py    # 전체 검증 실행
```

---

## [1.0.0] - 2026-02-XX

### Initial Release
- React 19 + Vite 7 + Tailwind CSS 4 기반 프로젝트 설정
- 기본 사주 분석 기능
- Supabase 연동
