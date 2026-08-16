# VibeCheck는 어떻게 안전을 확인하나요?

VibeCheck는 “안전해 보입니다”라고 말하는 도구가 아닙니다. 실제로 다른 사람의 정보를 요청해 보고, 결과를 규칙과 비교한 뒤, 사람이 승인한 수정만 적용하고, 같은 요청으로 다시 확인합니다.

## 처음부터 끝까지 흐름

```mermaid
flowchart LR
  U["사용자: 내 앱 공격해보기"] --> H["검증 진행 관리\n목표·범위·기록"]
  H --> R["관련 규칙 찾기\n프로젝트 약속 + 보안 상식"]
  R --> B["🔴 공격 담당 Codex\n공격 계획 만들기"]
  B --> T["내 로컬 데모 앱\nGET /api/users/2"]
  T --> E["실제 서버 응답\n200 또는 403"]
  E --> N["응답 내용 정리\n누가·무엇을·결과"]
  N --> KG["관계도 만들기\n사람·데이터·규칙·증거"]
  KG --> S["보안 규칙과 비교\nBAC-001"]
  S --> D{"규칙이 깨졌나요?"}
  D -->|"예"| P["사람이 증거 확인\n수정할지 결정"]
  P -->|"승인"| BL["🔵 수정 담당 Codex\n서버 코드 고치기"]
  BL --> T
  D -->|"아니오"| OK["안전하게 막힘"]
```

## AI가 하는 일과 규칙이 하는 일

```mermaid
flowchart TB
  Raw["코드 · 실제 요청 · 실행 기록"] --> Neural["AI가 상황을 읽음\n누가 무엇을 했는지 정리"]
  Neural --> Facts["정리된 사실\n일반회원 · 읽기 · 다른사람 · 허용"]
  Facts --> Graph["관계도\n사람과 데이터의 연결"]
  Graph --> Symbolic["정해진 규칙과 비교\n예상 결과와 실제 결과"]
  Rules["사람이 승인한 약속\nBAC-001"] --> Symbolic
  Symbolic --> Verdict["규칙 위반 / 통과 / 판단 불가"]
```

현재 AI 역할은 실제 요청 결과를 “일반 회원이 다른 회원 정보를 읽었고, 서버가 허용했다”처럼 정리하는 것입니다. 최종 결론은 AI가 내리지 않습니다. `core/verifier.js`가 승인된 규칙과 실제 결과를 기계적으로 비교해 판단합니다.

## 관계도는 무엇을 보여주나요?

```mermaid
graph LR
  M1["member01"] -->|"역할"| Member["일반 회원"]
  M1 -->|"요청"| Endpoint["/api/users/2"]
  Endpoint -->|"접근"| Profile["member02 프로필"]
  Profile -->|"주인"| M2["member02"]
  Attack["공격 기록"] -->|"공격자"| M1
  Attack -->|"서버 응답"| HTTP["HTTP 200 또는 403"]
  Member -->|"보면 안 됨"| Rule["BAC-001"]
  Attack -->|"규칙 비교 결과"| Rule
```

이 그림은 장식이 아닙니다. 시스템은 `member01`과 `member02`가 다른 사람인지, 일반 회원이 다른 회원 정보를 읽었는지, 서버가 허용했는지를 연결해 보안 규칙을 비교합니다.

## 수정 후에는 꼭 같은 공격을 다시 합니다

```mermaid
sequenceDiagram
  participant Human as 사람
  participant Screen as VibeCheck 화면
  participant System as 검증 시스템
  participant App as 데모 앱
  Human->>Screen: 수정 승인
  Screen->>System: 수정 요청
  System->>App: 본인·관리자만 허용하도록 코드 수정
  System->>App: 똑같이 GET /api/users/2 요청
  App-->>System: HTTP 403 접근 금지
  System->>System: 규칙과 다시 비교: 통과
  System-->>Screen: 공격이 막혔다는 증거 표시
```
