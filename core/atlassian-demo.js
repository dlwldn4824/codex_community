// 실제 VibeCheck 결과를 Jira·Confluence 데모 형태로 정리합니다.
// 외부 Atlassian 계정이나 네트워크에는 절대 접근하지 않습니다.
function syncFinding(run) {
  const isViolation = run.verification.verdict === "VIOLATION";
  return {
    mode: "DEMO · 외부 Jira/Confluence 전송 없음",
    progress: isViolation ? { percent: 50, label: "증거 문서와 대응 티켓 준비 완료" } : { percent: 100, label: "수정과 동일 공격 재검증까지 완료" },
    jira: {
      key: "VIBE-101",
      status: isViolation ? "수정 대기" : "완료",
      title: "[BAC-001] 일반 회원의 다른 회원 프로필 접근",
      evidence: `${run.evidence.request} → HTTP ${run.evidence.status}`
    },
    confluence: {
      status: isViolation ? "증거 문서 생성" : "재검증 결과 반영",
      title: "VibeCheck 공격 증거 · Attack-001",
      summary: isViolation
        ? "실제 HTTP 200 응답으로 다른 회원 정보 노출을 확인했습니다."
        : "동일 공격이 HTTP 403으로 차단된 것을 확인했습니다."
    }
  };
}

module.exports = { syncFinding };
