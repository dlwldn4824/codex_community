const http = require("http");
const fs = require("fs");
const path = require("path");
const { extractSecurityFactsWithModel } = require("./core/facts");
const { verify } = require("./core/verifier");
const { buildKnowledgeGraph } = require("./core/kg");
const { syncFinding } = require("./core/atlassian-demo");
const { scanStaticCode, scanStaticCodeAsync } = require("./core/static-scan");
const { indexCompanyPolicy, retrievePolicy } = require("./core/policy-rag");
const { analyzeGitHubRepository, applySafeRepairProposals, buildRepositoryGraph, buildUserSecurityMap, buildRepairPlan } = require("./core/project-analysis");
const { proposeAndApplyCodexRepairs } = require("./core/codex-repair");

// .env는 Git에 포함하지 않습니다. 개발 환경에서 OPENAI_API_KEY만 읽습니다.
if (fs.existsSync(path.join(__dirname, ".env"))) process.loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const targetFile = path.join(__dirname, "target-app/users.js");
const state = { lastRun: null, patched: false, logs: [], companyPolicy: null, analysis: { percent: 0, stages: [0, 0, 0, 0] } };
const log = (step, status, detail) => state.logs.push({ step, status, detail, at: new Date().toISOString() });
const setAnalysisProgress = (percent, stages) => { state.analysis = { percent, stages, updatedAt: new Date().toISOString() }; };
const usersModule = () => { delete require.cache[require.resolve("./target-app/users")]; return require("./target-app/users"); };

function json(res, status, data) { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); }
function serveFile(res, file, type) {
  // 개발 데모에서는 최신 UI/분석 로직을 즉시 받아야 합니다.
  // 이전 JavaScript가 캐시되면 과거 분석의 1개 수정안 화면이 남을 수 있습니다.
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(fs.readFileSync(file));
}
function readJson(req, callback) { let body = ""; req.on("data", chunk => { body += chunk; if (body.length > 500000) req.destroy(); }); req.on("end", () => { try { callback(JSON.parse(body || "{}")); } catch { callback(null); } }); }

function handleTarget(req, res, pathname) {
  const match = pathname.match(/^\/api\/users\/(\d+)$/);
  if (!match) return false;
  const actor = req.headers["x-demo-user"] === "admin01" ? { id: "99", name: "admin01", role: "ADMIN" } : { id: "1", name: "member01", role: "MEMBER" };
  const output = usersModule().getUserProfile(actor, match[1]);
  json(res, output.status, output.body); return true;
}

function runRealAttack(callback) {
  const options = { hostname: "127.0.0.1", port: PORT, path: "/api/users/2", headers: { "x-demo-user": "member01" } };
  const request = http.get(options, (response) => {
    let body = ""; response.on("data", chunk => body += chunk);
    response.on("end", async () => {
      const target = usersModule().users["2"];
      const evidence = { attackId: "Attack-001", request: "GET /api/users/2", status: response.statusCode, response: body ? JSON.parse(body) : null, actor: { id: "1", name: "member01", role: "MEMBER" }, targetId: "2", resourceOwner: target, executedAt: new Date().toISOString() };
      const facts = await extractSecurityFactsWithModel(evidence); const verification = verify(facts); const kg = buildKnowledgeGraph(evidence, facts, verification);
      const staticScan = state.staticScan || scanStaticCode();
      state.staticScan = staticScan;
      const policyRag = retrievePolicy(state.companyPolicy);
      state.lastRun = { evidence, facts, verification, kg, staticScan, policyRag, patched: state.patched, logs: state.logs };
      state.lastRun.integration = syncFinding(state.lastRun);
      callback(state.lastRun);
    });
  });
  request.on("error", error => callback({ error: error.message }));
}

function applyAuthorizationPatch() {
  const original = fs.readFileSync(targetFile, "utf8");
  if (original.includes("requester.role !== \"ADMIN\" && requester.id !== targetId")) return false;
  const vulnerable = 'if (!requester) return { status: 401, body: { error: "로그인이 필요합니다." } };\n  return { status: 200, body: target };';
  const fixed = 'if (!requester) return { status: 401, body: { error: "로그인이 필요합니다." } };\n  if (requester.role !== "ADMIN" && requester.id !== targetId) {\n    return { status: 403, body: { error: "다른 회원의 프로필은 볼 수 없습니다." } };\n  }\n  return { status: 200, body: target };';
  if (!original.includes(vulnerable)) throw new Error("패치할 취약 코드가 예상 위치에 없습니다.");
  fs.writeFileSync(`${targetFile}.before-vibecheck`, original);
  fs.writeFileSync(targetFile, original.replace(vulnerable, fixed));
  state.patched = true; return true;
}

function handleRequest(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (handleTarget(req, res, pathname)) return;
  if (pathname === "/api/run-attack" && req.method === "POST") {
    state.logs = []; setAnalysisProgress(8, [8, 0, 0, 0]); log("VibeCheck", "running", "프로젝트 구조를 읽는 중...");
    setTimeout(async () => {
      state.logs[0].status = "done"; setAnalysisProgress(25, [100, 0, 0, 0]);
      if (state.companyPolicy) { log("Policy", "done", "회사 보안 정책 문서를 검색했습니다."); setAnalysisProgress(35, [100, 20, 100, 0]); } else { setAnalysisProgress(30, [100, 15, 100, 0]); }
      log("Semgrep", "running", "실제 오픈소스 규칙을 실행 중..."); setAnalysisProgress(40, [100, 35, 100, 0]);
      const scan = state.staticScan || await scanStaticCodeAsync(); state.staticScan = scan;
      const semgrepLog = state.logs.at(-1); semgrepLog.status = scan.status === "COMPLETED" ? "done" : "failed"; semgrepLog.detail = scan.status === "COMPLETED" ? `실제 오픈소스 규칙 ${scan.findings.length}건을 확인했습니다.` : "Semgrep 실행에 실패했습니다."; setAnalysisProgress(65, [100, 100, 100, 0]);
      log("KG", "done", "사용자 · 권한 · API 관계를 구성했습니다."); setAnalysisProgress(78, [100, 100, 100, 35]); log("Breaker", "running", "다른 사용자 프로필 요청을 준비 중..."); setAnalysisProgress(85, [100, 100, 100, 65]);
      runRealAttack(result => { const breakerLog = state.logs.find(entry => entry.step === "Breaker"); if (breakerLog) breakerLog.status = "done"; setAnalysisProgress(93, [100, 100, 100, 90]); log("Evidence", "done", `실제 HTTP ${result.evidence.status} 응답을 수집했습니다.`); log("NeSy", result.verification.verdict === "VIOLATION" ? "failed" : "done", `관측: ${result.evidence.status}, 판정: ${result.verification.verdict}`); setAnalysisProgress(100, [100, 100, 100, 100]); json(res, 200, result); });
    }, 250);
    return;
  }
  if (pathname === "/api/company-policy" && req.method === "POST") return readJson(req, payload => {
    if (!payload || typeof payload.text !== "string" || !payload.text.trim()) return json(res, 400, { error: "텍스트 문서만 업로드할 수 있습니다." });
    const name = String(payload.name || "company-policy.txt").replace(/[^a-zA-Z0-9가-힣._ -]/g, "_").slice(0, 100);
    const directory = path.join(__dirname, "data/company-policies"); fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, `${Date.now()}-${name}`), payload.text.slice(0, 500000), "utf8");
    state.companyPolicy = indexCompanyPolicy({ name, text: payload.text });
    json(res, 201, { name, chunks: state.companyPolicy.chunks.length, method: state.companyPolicy.method });
  });
  if (pathname === "/api/analyze-project" && req.method === "POST") return readJson(req, async payload => {
    try {
      state.logs = []; setAnalysisProgress(8, [8, 0, 0, 0]); log("VibeCheck", "running", "GitHub 저장소를 연결하는 중...");
      const project = await analyzeGitHubRepository(payload?.url || ""); state.logs[0].status = "done"; setAnalysisProgress(35, [100, 20, 0, 0]);
      log("Semgrep", "running", "연결된 저장소에 실제 오픈소스 규칙을 실행 중..."); setAnalysisProgress(48, [100, 55, 100, 0]);
      const scan = await scanStaticCodeAsync([project.directory]); const graph = buildRepositoryGraph(project, scan), userSecurityMap = buildUserSecurityMap(project, scan), repairPlan = buildRepairPlan(project, scan); fs.rmSync(project.directory, { recursive: true, force: true }); const scanLog = state.logs.at(-1); scanLog.status = scan.status === "COMPLETED" ? "done" : "failed"; scanLog.detail = scan.status === "COMPLETED" ? `실제 정적 분석 ${scan.findings.length}건을 확인했습니다.` : "Semgrep 실행에 실패했습니다."; setAnalysisProgress(78, [100, 100, 100, 30]);
      log("KG", "done", "파일 구조 · API · 인증 관련 파일 관계를 정리했습니다."); setAnalysisProgress(100, [100, 100, 100, 100]);
      const output = { projectAnalysis: { sourceUrl: payload?.url || "", name: `${project.owner}/${project.repository}`, fileCount: project.fileCount, files: project.files, routes: project.routes, authFiles: project.authFiles, staticScan: scan, graph, userSecurityMap, repairPlan }, logs: state.logs }; state.lastRun = output; json(res, 200, output);
    } catch (error) { log("VibeCheck", "failed", error.message); json(res, 400, { error: error.message }); }
  });
  if (pathname === "/api/recheck-project" && req.method === "POST") return readJson(req, async payload => {
    const sourceUrl = payload?.url || state.lastRun?.projectAnalysis?.sourceUrl;
    if (!sourceUrl) return json(res, 400, { error: "재점검할 GitHub 저장소 분석 결과가 없습니다." });
    let project;
    try {
      project = await analyzeGitHubRepository(sourceUrl);
      const before = await scanStaticCodeAsync([project.directory]);
      const proposed = buildRepairPlan(project, before);
      const deterministicRepair = await applySafeRepairProposals(project);
      const codexRepair = await proposeAndApplyCodexRepairs(project, before.findings);
      const repair = {
        applied: [...deterministicRepair.applied, ...codexRepair.applied],
        unresolved: [...deterministicRepair.unresolved, ...codexRepair.reviewRequired]
      };
      const after = await scanStaticCodeAsync([project.directory]);
      const remaining = buildRepairPlan(project, after);
      const fullyResolved = after.status === "COMPLETED" && after.findings.length === 0;
      json(res, 200, {
        sourceUrl,
        before: { findings: before.findings.length, status: before.status },
        after: { findings: after.findings.length, status: after.status },
        proposed,
        applied: repair.applied,
        unresolved: repair.unresolved,
        codexRepair: {
          status: codexRepair.status,
          model: codexRepair.model,
          attempted: codexRepair.attempted,
          reason: codexRepair.reason
        },
        remaining,
        verdict: fullyResolved ? "PASS" : "REVIEW_REQUIRED",
        verification: {
          semgrep: fullyResolved ? "PASS" : "REVIEW_REQUIRED",
          buildAndTest: "NOT_RUN",
          buildAndTestReason: "공개 저장소 코드는 격리 실행 환경 없이 이 서버에서 실행하지 않습니다."
        },
        note: repair.applied.length
          ? "원격 GitHub 저장소에는 변경을 보내지 않았습니다. 새 로컬 복제본에서 실제 적용된 수정만 다시 정적 분석했습니다."
          : "이 재점검에서는 안전하게 자동 적용할 수 있는 수정이 없었습니다. 따라서 새 로컬 복제본의 코드가 바뀌지 않아 Semgrep 결과도 그대로 남았습니다."
      });
    } catch (error) { json(res, 400, { error: error.message }); }
    finally { if (project?.directory) fs.rmSync(project.directory, { recursive: true, force: true }); }
  });
  if (pathname === "/api/approve-fix" && req.method === "POST") {
    try { applyAuthorizationPatch(); log("05 사람 승인", "done", "서버 측 최소 권한 패치를 적용했습니다."); log("06 동일 공격 재실행", "running", "원래 공격 요청을 그대로 재생합니다."); return runRealAttack(result => { log("07 재검증", result.verification.verdict === "PASS" ? "done" : "failed", `관측: ${result.evidence.status}, 판정: ${result.verification.verdict}`); json(res, 200, result); }); } catch (error) { return json(res, 409, { error: error.message }); }
  }
  if (pathname === "/api/state") return json(res, 200, state);
  if (pathname === "/") return serveFile(res, path.join(__dirname, "public/index.html"), "text/html; charset=utf-8");
  if (pathname === "/app.js") return serveFile(res, path.join(__dirname, "public/app.js"), "text/javascript; charset=utf-8");
  if (pathname === "/service-map.js") return serveFile(res, path.join(__dirname, "public/service-map.js"), "text/javascript; charset=utf-8");
  if (pathname === "/analysis-tweaks.js") return serveFile(res, path.join(__dirname, "public/analysis-tweaks.js"), "text/javascript; charset=utf-8");
  if (pathname === "/external-project.js") return serveFile(res, path.join(__dirname, "public/external-project.js"), "text/javascript; charset=utf-8");
  if (pathname === "/repository-graph.js") return serveFile(res, path.join(__dirname, "public/repository-graph.js"), "text/javascript; charset=utf-8");
  if (pathname === "/result-cover.js") return serveFile(res, path.join(__dirname, "public/result-cover.js"), "text/javascript; charset=utf-8");
  if (pathname === "/force-graph.js") return serveFile(res, path.join(__dirname, "public/force-graph.js"), "text/javascript; charset=utf-8");
  if (pathname === "/about.js") return serveFile(res, path.join(__dirname, "public/about.js"), "text/javascript; charset=utf-8");
  if (pathname === "/attack-speed.js") return serveFile(res, path.join(__dirname, "public/attack-speed.js"), "text/javascript; charset=utf-8");
  if (pathname === "/vendor/cytoscape.min.js") return serveFile(res, path.join(__dirname, "node_modules/cytoscape/dist/cytoscape.min.js"), "text/javascript; charset=utf-8");
  if (pathname === "/styles.css") return serveFile(res, path.join(__dirname, "public/styles.css"), "text/css; charset=utf-8");
  if (pathname === "/integration.css") return serveFile(res, path.join(__dirname, "public/integration.css"), "text/css; charset=utf-8");
  if (pathname === "/onboarding.css") return serveFile(res, path.join(__dirname, "public/onboarding.css"), "text/css; charset=utf-8");
  if (pathname === "/analysis.css") return serveFile(res, path.join(__dirname, "public/analysis.css"), "text/css; charset=utf-8");
  if (pathname === "/results.css") return serveFile(res, path.join(__dirname, "public/results.css"), "text/css; charset=utf-8");
  if (pathname === "/result-layout.css") return serveFile(res, path.join(__dirname, "public/result-layout.css"), "text/css; charset=utf-8");
  if (pathname === "/result-simple.css") return serveFile(res, path.join(__dirname, "public/result-simple.css"), "text/css; charset=utf-8");
  if (pathname === "/result-override.css") return serveFile(res, path.join(__dirname, "public/result-override.css"), "text/css; charset=utf-8");
  if (pathname === "/result-redesign.css") return serveFile(res, path.join(__dirname, "public/result-redesign.css"), "text/css; charset=utf-8");
  if (pathname === "/cover.css") return serveFile(res, path.join(__dirname, "public/cover.css"), "text/css; charset=utf-8");
  if (pathname === "/analysis-view.css") return serveFile(res, path.join(__dirname, "public/analysis-view.css"), "text/css; charset=utf-8");
  if (pathname === "/cover-adjust.css") return serveFile(res, path.join(__dirname, "public/cover-adjust.css"), "text/css; charset=utf-8");
  if (pathname === "/cover-form.css") return serveFile(res, path.join(__dirname, "public/cover-form.css"), "text/css; charset=utf-8");
  if (pathname === "/about.css") return serveFile(res, path.join(__dirname, "public/about.css"), "text/css; charset=utf-8");
  if (pathname.startsWith("/assets/")) return serveFile(res, path.join(__dirname, "public", pathname), pathname.endsWith(".ttf") ? "font/ttf" : "image/png");
  json(res, 404, { error: "Not found" });
}

const server = http.createServer(handleRequest);

if (require.main === module) server.listen(PORT, () => console.log(`VibeCheck running at http://localhost:${PORT}`));
module.exports = { server, handleRequest, runRealAttack, applyAuthorizationPatch };
