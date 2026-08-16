const speedResult = showResult;

showResult = function(data) {
  speedResult(data);
  const notice = document.querySelector("#attack-speed");
  if (!notice) return;
  if (data.projectAnalysis) {
    const findings = data.projectAnalysis.staticScan?.findings || [];
    const risks = data.projectAnalysis.userSecurityMap?.edges?.filter(edge => edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL") || [];
    const logs = data.logs || [];
    const startedAt = logs[0]?.at ? new Date(logs[0].at).getTime() : null;
    const endedAt = logs.at(-1)?.at ? new Date(logs.at(-1).at).getTime() : null;
    const seconds = startedAt && endedAt ? Math.max(1, Math.round((endedAt - startedAt) / 1000)) : null;
    notice.hidden = false;
    notice.textContent = `보안 위험 추정 · 실제 정적 분석 ${findings.length}건을 바탕으로 ${risks.length}개 연결을 우선 확인해야 합니다.${seconds ? ` Codex가 ${seconds}초 만에 위험 흐름을 정리했어요.` : ""}`;
    return;
  }
  if (data.evidence?.status === 200 && data.verification?.verdict === "VIOLATION") {
    notice.hidden = false;
    notice.textContent = "Codex가 5초 만에 보안 침투에 성공했어요.";
    return;
  }
  notice.hidden = true;
};
