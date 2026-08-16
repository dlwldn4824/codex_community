# 통합 경계

| 경계 | 현재 구현 | 향후 교체/확장 |
|---|---|---|
| Fact extractor | HTTP 증거 기반 fallback | 학습된 Neural Security Fact 모델 |
| 지식 검색(RAG) | `.vibecheck` 정책/OWASP 출처 표시 | 임베딩 검색/프로젝트 문서 인덱스 |
| KG | 메모리 JSON 그래프 | 그래프 DB 또는 CI 증거 저장소 |
| Target | `localhost` 데모 앱 | 명시적으로 승인된 개발/테스트 URL |
| 실행 | Node HTTP | 격리 런타임/AWS sandbox |

활성 테스트는 소유자가 승인한 `localhost` 데모 대상으로만 제한합니다.
