# VibeCheck 아키텍처

## 폐쇄 루프 보안 하네스

```mermaid
flowchart LR
  U["사용자: 내 앱 공격하기"] --> H["VibeCheck Harness\n목표 · 범위 · 세션 · 로그"]
  H --> R["RAG 경계\n프로젝트 정책 + OWASP 지식"]
  R --> B["🔴 Codex Breaker\n공격 계획 / 실행"]
  B --> T["로컬 데모 대상\nGET /api/users/2"]
  T --> E["실제 HTTP 증거\n200 또는 403"]
  E --> N["Neural Fact Extractor\nSecurityFacts"]
  N --> KG["Security Knowledge Graph\n행위자 · 리소스 · 정책 · 증거"]
  KG --> S["Symbolic Verifier\nBAC-001 결정적 비교"]
  S --> D{"위반?"}
  D -->|"예"| P["사람 검토\n증거 / 규칙 / 영향"]
  P -->|"승인"| BL["🔵 Codex Builder\n최소 서버 패치"]
  BL --> T
  D -->|"아니오"| OK["방어 증명"]
```

## NeSy 책임 분리

```mermaid
flowchart TB
  Raw["Raw: 코드 · HTTP · 로그"] --> Neural["Neural / Fact 경계\n비정형 실행 결과를 구조화"]
  Neural --> Facts["SecurityFacts\nMEMBER · READ · OTHER_USER · ALLOW"]
  Facts --> Graph["KG\n관계와 공격 후보 연결"]
  Graph --> Symbolic["Symbolic\n조건 일치 + 기대값 비교"]
  Rules["승인된 Constitution / BAC-001"] --> Symbolic
  Symbolic --> Verdict["VIOLATION / PASS / UNKNOWN"]
```

`core/facts.js`는 향후 학습된 사실 추출 모델로 교체할 수 있는 경계입니다. 현재는 실제 HTTP 증거를 안전하게 구조화하는 결정적 fallback입니다. 최종 판정은 절대 모델이 아닌 `core/verifier.js`의 규칙 비교가 수행합니다.

## KG가 하는 일

```mermaid
graph LR
  M1["member01"] -->|"HAS_ROLE"| Member["MEMBER"]
  M1 -->|"REQUESTED"| Endpoint["/api/users/2"]
  Endpoint -->|"ACCESSES"| Profile["member02 프로필"]
  Profile -->|"OWNED_BY"| M2["member02"]
  Attack["Attack-001"] -->|"PERFORMED_BY"| M1
  Attack -->|"RETURNED"| HTTP["HTTP 200 / 403"]
  Member -->|"PROHIBITED_FROM"| Rule["BAC-001"]
  Attack -->|"검증 결과"| Rule
```

그래프는 화면용 장식이 아닙니다. `core/kg.js`는 사실과 실제 HTTP 결과를 결합해 `MEMBER ∧ OTHER_USER ∧ READ ∧ HTTP 200 → BAC-001 VIOLATION`이라는 공격 우선순위/판단 근거를 만들고, 이 결과가 대시보드와 하네스 결과에 사용됩니다.

## 패치와 재실행

```mermaid
sequenceDiagram
  participant Human as 사람
  participant UI as VibeCheck UI
  participant Harness as Harness
  participant Target as target-app/users.js
  Human->>UI: 수정안 승인 및 검증
  UI->>Harness: POST /api/approve-fix
  Harness->>Target: 실제 파일에 소유권 검사 기록
  Harness->>Target: 동일 요청 GET /api/users/2
  Target-->>Harness: HTTP 403
  Harness->>Harness: Facts → KG → Symbolic PASS
  Harness-->>UI: 방어 증거 + 실행 로그
```
