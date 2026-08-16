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
  document.querySelector("#result-sub").textContent = `${analysis.name}을 clone한 뒤 파일 구조와 Semgrep 정적 분석을 실행했습니다. 외부 서비스에 공격 요청은 보내지 않았습니다.`;
  document.querySelector(".attack-path-block .result-section-head span").textContent = "프로젝트 보안 지도";
  document.querySelector("#open-full-kg").textContent = "분석 파일 보기";
  document.querySelector("#attack-path-summary").textContent = "저장소 안에서 API와 인증·인가 관련 파일을 찾아 관계를 정리했습니다.";
  document.querySelector("#result-kg").className = "attack-path";
  document.querySelector("#result-kg").innerHTML = `<button class="path-node"><span>프로젝트</span><b>${analysis.name}</b><small>파일 ${analysis.fileCount}개 분석</small></button><div class="path-edge"><span>FINDS</span></div><button class="path-node"><span>API / Route</span><b>${analysis.routes.length}개</b><small>${analysis.routes[0] || "탐지된 경로 없음"}</small></button><div class="path-edge"><span>CHECKS</span></div><button class="path-node policy"><span>인증 / 권한</span><b>${analysis.authFiles.length}개</b><small>${analysis.authFiles[0] || "탐지된 파일 없음"}</small></button>`;
  document.querySelector("#graph-detail").textContent = "공개 GitHub 저장소를 실제 clone해 분석한 결과입니다. 외부 URL에 공격 요청은 보내지 않았습니다.";
  document.querySelector("#result-report-cards").innerHTML = `<article class="report-card"><span>파일 구조</span><h3>${analysis.fileCount}개 파일</h3><p>${analysis.files.slice(0, 4).join("<br/>") || "분석 가능한 파일을 찾지 못했습니다."}</p></article><article class="report-card"><span>API / Route</span><h3>${analysis.routes.length}개 탐지</h3><p>${analysis.routes.slice(0, 4).join("<br/>") || "일반 규칙으로 탐지된 API 파일이 없습니다."}</p></article><article class="report-card"><span>Semgrep</span><h3>${scan.findings.length}개 결과</h3><p>${scan.findings.slice(0, 3).map(item => `${item.file}:${item.line}`).join("<br/>") || "현재 규칙에서 발견된 결과가 없습니다."}</p></article>`;
  document.querySelector("#replay-result").innerHTML = `<div class="replay-side after"><span>실제 수행</span><b>CLONE + SEMGREP</b><small>외부 저장소 코드에 대한 읽기 전용 정적 분석</small></div>`;
  document.querySelector("#result-sources").innerHTML = [`GitHub 공개 저장소 · ${analysis.name}`, `Semgrep ${scan.version || ""} · 실제 정적 분석 ${scan.findings.length}건`].map(source => `<div class="source-chip"><b>분석 근거</b>${source}</div>`).join("");
  document.querySelector("#result-build-log").innerHTML = data.logs.map(log => `<div><b>${log.status === "failed" ? "FAIL" : "DONE"}</b><span>${log.step} · ${log.detail}</span></div>`).join("");
  document.querySelector("#open-solution").hidden = true;
};
