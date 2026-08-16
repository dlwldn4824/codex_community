const originalCallForProject = call;
call = async function(url) {
  const value = document.querySelector("#project-url")?.value?.trim();
  const isGitHubRepository = value && (() => { try { return new URL(value).hostname === "github.com"; } catch { return false; } })();
  if (url === "/api/run-attack" && isGitHubRepository) {
    const response = await fetch("/api/analyze-project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
  }
  return originalCallForProject(url);
};

const securityHarnessResult = showResult;
showResult = function(data) {
  if (!data.projectAnalysis) return securityHarnessResult(data);
  lastData = data; dashboard.hidden = true; workflow.hidden = true; constitution.hidden = true; resultPage.hidden = false; solutionPage.hidden = true;
  const analysis = data.projectAnalysis, scan = analysis.staticScan;
  document.querySelector("#result-status").textContent = "REPOSITORY ANALYSIS COMPLETE";
  document.querySelector("#result-headline").innerHTML = "저장소 구조를<br/><em>실제로 분석했습니다.</em>";
  document.querySelector("#result-sub").textContent = "저장소 코드에서 서비스 기능, 데이터 흐름, 그리고 확인이 필요한 보안 연결을 정리했습니다.";
  document.querySelector(".attack-path-block .result-section-head span").textContent = "프로젝트 보안 지도";
  document.querySelector("#open-full-kg").textContent = "분석 파일 보기";
  document.querySelector("#attack-path-summary").textContent = "저장소 안에서 API와 인증·인가 관련 파일을 찾아 관계를 정리했습니다.";
  document.querySelector("#result-kg").className = "attack-path";
  document.querySelector("#result-kg").innerHTML = `<button class="path-node"><span>프로젝트</span><b>${analysis.name}</b><small>파일 ${analysis.fileCount}개 분석</small></button><div class="path-edge"><span>FINDS</span></div><button class="path-node"><span>API / Route</span><b>${analysis.routes.length}개</b><small>${analysis.routes[0] || "탐지된 경로 없음"}</small></button><div class="path-edge"><span>CHECKS</span></div><button class="path-node policy"><span>인증 / 권한</span><b>${analysis.authFiles.length}개</b><small>${analysis.authFiles[0] || "탐지된 파일 없음"}</small></button>`;
  document.querySelector("#graph-detail").textContent = "빨간 연결을 누르면 어떤 기능 사이에서 어떤 보안 확인이 필요한지 볼 수 있습니다.";
  const findings = analysis.userSecurityMap?.securityFindings || [];
  const findingSummary = findings.slice(0, 3).map(item => `<b>${item.title}</b><br/><small>${item.description}</small>`).join("<hr/>") || "현재 규칙에서 추가 확인이 필요한 코드를 찾지 못했습니다.";
  document.querySelector("#result-report-cards").innerHTML = `<article class="report-card"><span>서비스 구조</span><h3>${analysis.fileCount}개 파일 분석</h3><p>화면·API·데이터 처리 기능을 묶어 서비스 지도로 정리했습니다.</p></article><article class="report-card"><span>기능 연결</span><h3>${analysis.routes.length}개 API 확인</h3><p>기능 사이의 요청과 데이터 이동을 코드 근거로 연결했습니다.</p></article><article class="report-card"><span>보안 확인 항목</span><h3>${scan.findings.length}개</h3><p>${findingSummary}</p></article>`;
  document.querySelector("#replay-result").innerHTML = `<div class="replay-side after"><span>실제 수행</span><b>CLONE + SEMGREP</b><small>외부 저장소 코드에 대한 읽기 전용 정적 분석</small></div>`;
  document.querySelector("#result-sources").innerHTML = [`GitHub 공개 저장소 · ${analysis.name}`, `Semgrep ${scan.version || ""} · 실제 정적 분석 ${scan.findings.length}건`].map(source => `<div class="source-chip"><b>분석 근거</b>${source}</div>`).join("");
  document.querySelector("#result-build-log").innerHTML = data.logs.map(log => `<div><b>${log.status === "failed" ? "FAIL" : "DONE"}</b><span>${log.step} · ${log.detail}</span></div>`).join("");
  document.querySelector("#open-solution").hidden = true;
};
