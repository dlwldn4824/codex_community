const attack = document.querySelector("#attack"), fix = document.querySelector("#fix");
const dashboard = document.querySelector("#dashboard"), empty = document.querySelector("#empty");
async function call(url) { const r = await fetch(url, { method: "POST" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }
function statusClass(code) { return code === 200 ? "bad" : "good"; }
function render(data) {
  empty.hidden = true; dashboard.hidden = false;
  const { evidence, facts, verification, kg, logs } = data, vulnerable = verification.verdict === "VIOLATION";
  document.querySelector("#http").className = `http ${statusClass(evidence.status)}`; document.querySelector("#http").textContent = `HTTP ${evidence.status} ${evidence.status === 200 ? "OK" : "FORBIDDEN"}`;
  document.querySelector("#headline").textContent = vulnerable ? "💥 다른 회원의 개인 정보가 노출됐습니다." : "✓ 동일한 공격을 차단했습니다.";
  document.querySelector("#timeline").innerHTML = [`00:00  일반 회원으로 로그인`, `00:02  ${evidence.request} 요청`, `00:04  실제 응답: HTTP ${evidence.status}`].map(x => `<li>${x}</li>`).join("");
  document.querySelector("#impact").textContent = vulnerable ? "member02의 이메일과 프로필이 응답에 포함되었습니다." : "서버가 소유권을 확인하여 데이터 접근을 거부했습니다.";
  document.querySelector("#facts").innerHTML = [["역할", facts.actorRole], ["행동", facts.action], ["관계", facts.relationship], ["관측", facts.observedResult]].map(([a,b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");
  const v = document.querySelector("#verdict"); v.className = `verdict ${vulnerable ? "bad" : "good"}`; v.innerHTML = `<b>${vulnerable ? "✕ 위반" : "✓ 통과"}</b><span>BAC-001 · 예상 ${verification.expected} / 관측 ${verification.observed}</span>`;
  document.querySelector("#graph").innerHTML = kg.nodes.map(n => `<div class="node ${n.type}">${n.label}</div>`).join("") + kg.edges.map(e => `<div class="edge">${e.from} <i>— ${e.label} →</i> ${e.to}</div>`).join("");
  document.querySelector("#reasoning").textContent = `추론: ${kg.reasoning}`;
  document.querySelector("#logs").innerHTML = logs.map(l => `<div class="log-row"><b class="${l.status}">${l.status === "failed" ? "✕" : l.status === "running" ? "…" : "✓"}</b><span>${l.step}</span><small>${l.detail}</small></div>`).join("");
  document.querySelector("#decision-title").textContent = vulnerable ? "결정이 필요합니다" : "방어가 증명되었습니다";
  document.querySelector("#decision-copy").textContent = vulnerable ? "BAC-001: 일반 회원이 다른 회원의 프로필을 읽었습니다. Codex는 서버 측 소유권 검사를 추가하는 최소 수정안을 준비했습니다." : "같은 요청 GET /api/users/2가 HTTP 403을 반환했고, 결정적 검증도 통과했습니다.";
  document.querySelector("#diff").hidden = !vulnerable; fix.hidden = !vulnerable; attack.textContent = vulnerable ? "다시 공격 실행" : "공격 재실행";
}
async function run(endpoint, button) { button.disabled = true; button.textContent = "실제 요청 실행 중…"; try { render(await call(endpoint)); } catch (e) { alert(e.message); } finally { button.disabled = false; button.textContent = endpoint.includes("approve") ? "Codex 수정안 승인 및 검증" : "공격 재실행"; } }
attack.addEventListener("click", () => run("/api/run-attack", attack)); fix.addEventListener("click", () => { if (confirm("제안된 서버 측 권한 패치를 적용하고, 동일 공격을 재실행할까요?")) run("/api/approve-fix", fix); });
