const speedResult = showResult;

showResult = function(data) {
  speedResult(data);
  const notice = document.querySelector("#attack-speed");
  if (!notice) return;
  if (data.projectAnalysis) {
    notice.hidden = true;
    return;
  }
  if (data.evidence?.status === 200 && data.verification?.verdict === "VIOLATION") {
    notice.hidden = false;
    notice.textContent = "Codex가 5초 만에 보안 침투에 성공했어요.";
    return;
  }
  notice.hidden = true;
};
