const originalCallForProject = call;
const repairViewStyle = document.createElement("style");
repairViewStyle.textContent = `body:has(#solution-page:not([hidden])){background:#dcecff;color:#07101d}body:has(#solution-page:not([hidden])) .shell{margin:0;background:linear-gradient(90deg,#e6f2ff8c,#d5e7ff70),url('/assets/cover-background.png') center/cover fixed}body:has(#solution-page:not([hidden])) .topbar,body:has(#solution-page:not([hidden])) .workflow,body:has(#solution-page:not([hidden])) footer{display:none}body:has(#solution-page:not([hidden])) main{max-width:1160px;padding:70px 30px}body:has(#solution-page:not([hidden])) .solution-page{max-width:1000px;margin:0 auto;font-family:'HiKR',sans-serif}body:has(#solution-page:not([hidden])) .solution-page h2{margin:8px 0 16px;color:#05070b;font-family:'Distort','HiKR',sans-serif;font-size:clamp(40px,6vw,74px);line-height:.98}body:has(#solution-page:not([hidden])) .repair-intro{max-width:730px;color:#314969;line-height:1.7;word-break:keep-all!important;overflow-wrap:normal!important}.repair-file-list{display:grid;gap:18px;margin-top:38px}.repair-file-card{padding:25px;border:1px solid #9bb8df;border-radius:14px;background:#ffffffdc}.repair-file-card>span,.repair-recheck>span{color:#1558f5;font-size:11px}.repair-file-card h3{margin:10px 0 4px;font-size:21px}.repair-location{margin:0;color:#526a8c;font-size:13px}.repair-reason{margin:22px 0 16px;padding-left:14px;border-left:3px solid #1558f5}.repair-reason p,.repair-check p{margin:6px 0 0;color:#405a78;line-height:1.6}.repair-evidence{margin:16px 0;padding:13px 15px;border-radius:9px;background:#f2f6fd;color:#405a78}.repair-evidence b{color:#123a75}.repair-evidence p{margin:6px 0 0;line-height:1.55}.repair-diff{display:grid;grid-template-columns:1fr 1fr;gap:10px}.repair-diff>div{padding:13px;border-radius:9px;background:#fff1f2}.repair-diff>div+div{background:#eefbf4}.repair-diff small{display:block;margin-bottom:7px;color:#526a8c}.repair-diff pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.6 ui-monospace,SFMono-Regular,monospace}.repair-check{margin-top:14px;padding:14px;border:1px solid #b4d4c1;border-radius:9px;background:#f0faf4}.repair-recheck{margin:28px 0;padding:25px;border:1px solid #9bb8df;border-radius:14px;background:#fff}.repair-recheck h3{margin:8px 0}.repair-recheck p{margin:0;color:#405a78;line-height:1.7}.recheck-list{display:grid;gap:12px;margin-top:36px}.recheck-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:16px;align-items:start;padding:21px 22px;border:1px solid #9bb8df;border-radius:14px;background:#ffffffdc}.recheck-row>b{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#1558f5;color:#fff;font-size:13px}.recheck-row>div{min-width:0}.recheck-row strong{display:block;margin:1px 0 10px;color:#07101d;font-size:17px;line-height:1.45;word-break:keep-all!important;overflow-wrap:normal!important}.recheck-row p{display:block;margin:7px 0 0;color:#405a78;font-size:13px;line-height:1.6;word-break:keep-all!important;overflow-wrap:normal!important}.recheck-row em{padding:7px 10px;border:1px solid #e0b752;border-radius:100px;background:#fff8df;color:#9b6c00;font-size:11px;font-style:normal;white-space:nowrap}.solution-actions{display:flex;gap:10px;margin-top:30px}.solution-actions .quiet-btn,.solution-actions .about-cta{min-width:240px;padding:15px 22px;border:2px solid #123a75;border-radius:10px;background:#fff;color:#123a75!important;font:700 16px 'HiKR',sans-serif;cursor:pointer}.solution-actions .about-cta{border-color:#1558f5;background:#1558f5;color:#fff!important}.solution-actions .quiet-btn:hover{background:#123a75;color:#fff!important}@media(max-width:720px){body:has(#solution-page:not([hidden])) main{padding:38px 18px}.repair-diff{grid-template-columns:1fr}.recheck-row{grid-template-columns:38px minmax(0,1fr)}.recheck-row em{grid-column:2;justify-self:start}.solution-actions{flex-direction:column}.solution-actions .quiet-btn,.solution-actions .about-cta{min-width:0}}`;
document.head.append(repairViewStyle);
const repairSpacingStyle = document.createElement("style");
repairSpacingStyle.textContent = `body:has(#solution-page:not([hidden])) .solution-page h2{margin:16px 0 38px!important;line-height:1.08!important}body:has(#solution-page:not([hidden])) .repair-intro{max-width:none!important;margin-top:0!important;margin-bottom:42px!important;white-space:nowrap;font-size:12px}@media(max-width:720px){body:has(#solution-page:not([hidden])) .solution-page h2{margin-bottom:26px!important}.repair-intro{margin-bottom:30px!important;white-space:normal;font-size:inherit}}`;
document.head.append(repairSpacingStyle);
const resultReadabilityStyle = document.createElement("style");
resultReadabilityStyle.textContent = `body:has(#result-page:not([hidden])) .result-section-head:has(+ #result-report-cards){margin-top:54px;margin-bottom:18px}body:has(#result-page:not([hidden])) .result-section-head:has(+ #result-report-cards) span{color:#07101d;font-size:22px;letter-spacing:-.03em}body:has(#result-page:not([hidden])) #result-report-cards .report-card>span{display:inline-block;padding:5px 8px;border-radius:6px;background:#e7f0ff;color:#123a75;font-size:11px}body:has(#result-page:not([hidden])) #result-report-cards .report-card h3{color:#07101d}body:has(#result-page:not([hidden])) #result-report-cards .report-card{border-color:#86a8d5}body:has(#result-page:not([hidden])) #result-report-cards .report-card:last-child{border-color:#e16b76;background:#fff8f8}body:has(#result-page:not([hidden])) #result-report-cards .report-card:last-child>span{background:#ffeaec;color:#c92f3c}body:has(#result-page:not([hidden])) #result-report-cards .report-card:last-child h3,body:has(#result-page:not([hidden])) #result-report-cards .report-card:last-child b{color:#c92f3c}`;
document.head.append(resultReadabilityStyle);
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
  document.querySelector("#replay-result").innerHTML = "";
  document.querySelector("#result-sources").innerHTML = "";
  document.querySelector("#result-build-log").innerHTML = "";
  document.querySelector("#open-solution").hidden = false;
  document.querySelector("#open-solution").textContent = "수정안과 재점검 보기 →";
};

const externalProjectSolution = showSolution;
showSolution = function(data) {
  if (!data?.projectAnalysis) return externalProjectSolution(data);
  const plan = data.projectAnalysis.repairPlan || [];
  dashboard.hidden = true; workflow.hidden = true; constitution.hidden = true; resultPage.hidden = true; solutionPage.hidden = false;
  const escape = value => String(value || "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const reviewTargets = data.projectAnalysis.userSecurityMap?.edges?.filter(edge => edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL") || [];
  const fallbackPlan = reviewTargets.slice(0, 3).map((edge, index) => ({
    file: edge.sourceFiles?.[0] || "연결된 기능 코드",
    line: "확인 필요",
    title: edge.displayLabel || "데이터·권한 흐름 검토",
    reason: edge.explanation || "이 기능 연결에서 전달 데이터와 접근 권한을 코드에서 직접 확인해야 합니다.",
    before: "현재 연결의 권한 검사와 전달 데이터를 코드에서 확인",
    after: "요청자 권한 확인과 필요한 데이터만 전달하는 조건을 추가",
    recheck: "수정 대상 파일을 다시 정적 분석하고, 연결된 기능의 접근 권한과 전달 데이터를 재점검"
  }));
  const visiblePlan = plan.length ? plan : fallbackPlan;
  const cards = visiblePlan.length ? visiblePlan.map((item, index) => `<article class="repair-file-card"><span>${plan.length ? "수정 제안" : "검토 제안"} ${String(index + 1).padStart(2, "0")}</span><h3>${escape(item.file)}</h3><p class="repair-location">${escape(item.line)}번째 줄 근처 · ${escape(item.title)}</p><div class="repair-reason"><b>왜 수정하나요?</b><p>${escape(item.reason)}</p></div><div class="repair-evidence"><b>분석 근거</b><p>${escape(item.evidence || item.message || item.rule || "정적 분석 결과")}</p></div><div class="repair-diff"><div><small>현재 코드의 위험 지점</small><pre>- ${escape(item.before)}</pre></div><div><small>Codex 수정 제안</small><pre>+ ${escape(item.after)}</pre></div></div><div class="repair-check"><b>수정 뒤 다시 확인</b><p>${escape(item.recheck)}</p></div></article>`).join("") : `<article class="repair-file-card"><span>분석 완료</span><h3>현재 결과에서는 수정이 필요한 위험 흐름을 확인하지 못했습니다.</h3><p class="repair-location">정적 분석 결과와 보안 지도에서 위험 표시가 없을 때만 표시됩니다.</p><div class="repair-check"><b>다음 점검</b><p>새 분석 결과가 추가되면 해당 파일과 근거를 바탕으로 수정 검토안을 생성합니다.</p></div></article>`;
  const showReverify = result => {
    if (!result) return;
    const applied = result.applied.map((item, index) => `<article class="recheck-row"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escape(item.file)} · ${escape(item.line)}번째 줄</strong><p>수정 전: ${escape(item.before)}</p><p>수정 후: ${escape(item.after)}</p></div><em>실제 반영</em></article>`).join("") || `<article class="recheck-row"><b>—</b><div><strong>이번 재점검에서 실제로 바뀐 코드는 없습니다.</strong><p>자동 적용이 가능한 규칙이 아니었거나, 수정에는 프로젝트별 권한·동작 판단이 필요합니다.</p></div><em>수정 없음</em></article>`;
    const remaining = (result.remaining || []).slice(0, 6).map((item, index) => `<article class="recheck-row"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escape(item.file)} · ${escape(item.line)}번째 줄</strong><p>${escape(item.title)}</p><p>${escape(item.reason)}</p></div><em>남은 검토</em></article>`).join("") || `<article class="recheck-row"><b>✓</b><div><strong>남은 Semgrep 검토 항목이 없습니다.</strong><p>재분석 결과가 0건이므로 PASS로 표시합니다.</p></div><em>PASS</em></article>`;
    const passed = result.verdict === "PASS";
    const codexStatus = result.codexRepair?.status === "API_UNAVAILABLE"
      ? `<section class="repair-recheck repair-warning"><span>01 · Codex 수정안 생성</span><h3>Codex API를 호출하지 못했습니다</h3><p>${escape(result.codexRepair?.reason || "OpenAI API 사용 한도 또는 결제 설정을 확인해 주세요.")}</p></section>`
      : `<section class="repair-recheck"><span>01 · Codex 수정안 적용</span><h3>${result.applied.length}개 실제 적용 · ${result.proposed?.length || 0}개 제안</h3><p>원격 GitHub 저장소는 바꾸지 않았습니다. 새 로컬 복제본에서 실제로 적용된 파일만 아래에 표시합니다.</p></section>`;
    solutionPage.innerHTML = `<p class="eyebrow">반영 후 재검증</p><h2>${passed ? "수정 사본이<br/>검증을 통과했습니다." : "수정 후에도<br/>검토 항목이 남았습니다."}</h2><p class="repair-intro">${escape(result.note)}</p>${codexStatus}<section class="repair-recheck"><span>02 · 빌드·테스트</span><h3>${result.verification?.buildAndTest === "PASS" ? "PASS" : "격리 실행 환경 필요"}</h3><p>${escape(result.verification?.buildAndTestReason || "빌드와 테스트 결과를 확인했습니다.")}</p></section><section class="repair-recheck"><span>03 · Semgrep 재실행</span><h3>${result.before.findings}건 → ${result.after.findings}건 · ${passed ? "PASS" : "남은 검토"}</h3><p>${passed ? "동일 규칙으로 다시 분석한 결과, 남은 항목이 없어 PASS입니다." : "실제로 적용된 수정이 없거나 일부 항목만 수정되어, 아래 항목은 프로젝트 맥락을 확인한 뒤 별도 수정안이 필요합니다."}</p></section><section class="recheck-list"><p class="eyebrow">실제 적용된 수정</p>${applied}</section><section class="recheck-list"><p class="eyebrow">남은 검토 항목</p>${remaining}</section><div class="solution-actions"><button class="quiet-btn" id="back-to-recheck">← 재점검 리스트</button><button class="about-cta" id="reanalyze-project">새 분석 시작 →</button></div>`;
    document.querySelector("#back-to-recheck").addEventListener("click", () => window.vibeNavigate?.("recheck"));
    document.querySelector("#reanalyze-project").addEventListener("click", () => window.vibeNavigate?.("home"));
  };
  window.vibeShowReverify = () => showReverify(window.vibeReverifyResult);
  const openRecheck = () => {
    const rows = visiblePlan.map((item, index) => `<article class="recheck-row"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escape(item.file)} · ${escape(item.title)}</strong><p>수정 전: Semgrep이 ${escape(item.line)}번째 줄 근처를 확인했습니다.</p><p>수정 후 확인: ${escape(item.recheck)}</p></div><em>검토 대기</em></article>`).join("") || `<p>재점검할 수정 항목이 없습니다.</p>`;
    solutionPage.innerHTML = `<p class="eyebrow">재점검 리스트</p><h2>반영할 수정안을<br/>확인하세요.</h2><p class="repair-intro">원격 GitHub 저장소는 그대로 두고, 새 로컬 사본에 Codex 수정안을 적용한 뒤 Semgrep을 다시 실행합니다.</p><div class="solution-actions repair-action-top"><button class="about-cta" data-run-recheck>Codex 수정안 적용 후 재점검 →</button></div><section class="recheck-list">${rows}</section><section class="repair-recheck"><span>검증 순서</span><h3>수정 사본 생성 → 정적 분석 재실행</h3><p>원본 저장소에는 어떤 변경도 전송하지 않습니다. 수정 가능한 항목은 새로 복제한 사본에만 적용하고, 수정 전·후 결과를 비교합니다.</p></section><div class="solution-actions"><button class="quiet-btn" id="back-to-repairs">← 재점검</button><button class="about-cta" data-run-recheck>Codex 수정안 적용 후 재점검 →</button></div>`;
    document.querySelector("#back-to-repairs").addEventListener("click", () => window.vibeNavigate?.("solution"));
    document.querySelectorAll("[data-run-recheck]").forEach(runButton => runButton.addEventListener("click", async event => {
      const button = event.currentTarget; button.disabled = true; button.textContent = "수정 사본을 만들고 재점검 중…";
      document.querySelectorAll("[data-run-recheck]").forEach(item => { if (item !== button) item.disabled = true; });
      try {
        const response = await fetch("/api/recheck-project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: data.projectAnalysis.sourceUrl }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);
        window.vibeReverifyResult = result;
        window.vibeNavigate?.("reverify");
      } catch (error) { alert(error.message); document.querySelectorAll("[data-run-recheck]").forEach(item => { item.disabled = false; item.textContent = "Codex 수정안 적용 후 재점검 →"; }); }
    }));
  };
  window.vibeShowRecheck = openRecheck;
  solutionPage.innerHTML = `<p class="eyebrow">재점검 · ${visiblePlan.length} ITEMS</p><h2>${visiblePlan.length}개 수정 지점을<br/>하나씩 검토하세요.</h2><p class="repair-intro">Semgrep이 확인한 ${visiblePlan.length}개 코드 위치를 빠짐없이 보여줍니다. 원격 GitHub 저장소에는 아무것도 수정하거나 반영하지 않습니다.</p><div class="solution-actions repair-action-top"><button class="about-cta" data-open-recheck>재점검 리스트 보기 →</button></div><section class="repair-file-list">${cards}</section><div class="solution-actions"><button class="quiet-btn" id="back-to-map">← 보안 지도 돌아가기</button><button class="about-cta" data-open-recheck>재점검 리스트 보기 →</button></div>`;
  document.querySelector("#back-to-map").addEventListener("click", () => window.vibeNavigate?.("result"));
  document.querySelectorAll("[data-open-recheck]").forEach(button => button.addEventListener("click", () => window.vibeNavigate?.("recheck")));
};
