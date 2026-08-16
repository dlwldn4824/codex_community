const http = require("http");
const fs = require("fs");
const path = require("path");
const { extractSecurityFacts } = require("./core/facts");
const { verify } = require("./core/verifier");
const { buildKnowledgeGraph } = require("./core/kg");
const { syncFinding } = require("./core/atlassian-demo");
const { scanStaticCode } = require("./core/static-scan");

const PORT = Number(process.env.PORT || 3000);
const targetFile = path.join(__dirname, "target-app/users.js");
const state = { lastRun: null, patched: false, logs: [] };
const log = (step, status, detail) => state.logs.push({ step, status, detail, at: new Date().toISOString() });
const usersModule = () => { delete require.cache[require.resolve("./target-app/users")]; return require("./target-app/users"); };

function json(res, status, data) { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); }
function serveFile(res, file, type) { res.writeHead(200, { "content-type": type }); res.end(fs.readFileSync(file)); }

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
    response.on("end", () => {
      const target = usersModule().users["2"];
      const evidence = { attackId: "Attack-001", request: "GET /api/users/2", status: response.statusCode, response: body ? JSON.parse(body) : null, actor: { id: "1", name: "member01", role: "MEMBER" }, targetId: "2", resourceOwner: target, executedAt: new Date().toISOString() };
      const facts = extractSecurityFacts(evidence); const verification = verify(facts); const kg = buildKnowledgeGraph(evidence, facts, verification);
      const staticScan = state.staticScan || scanStaticCode();
      state.staticScan = staticScan;
      state.lastRun = { evidence, facts, verification, kg, staticScan, patched: state.patched, logs: state.logs };
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

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (handleTarget(req, res, pathname)) return;
  if (pathname === "/api/run-attack" && req.method === "POST") {
    state.logs = []; log("01 프로젝트 이해", "done", "로컬 API와 사용자 정책을 확인했습니다."); const scan = state.staticScan || scanStaticCode(); state.staticScan = scan; log("02 Semgrep 정적 분석", scan.status === "COMPLETED" ? "done" : "failed", scan.status === "COMPLETED" ? `실제 오픈소스 규칙 ${scan.findings.length}건을 확인했습니다.` : "Semgrep 실행에 실패했습니다."); log("03 보안 지식 검색", "done", "BAC-001 / OWASP 접근 제어 규칙을 선택했습니다."); log("04 공격 실행", "running", "GET /api/users/2 를 실제 HTTP로 실행합니다.");
    return runRealAttack(result => { log("04 NeSy 검증", result.verification.verdict === "VIOLATION" ? "failed" : "done", `관측: ${result.evidence.status}, 판정: ${result.verification.verdict}`); json(res, 200, result); });
  }
  if (pathname === "/api/approve-fix" && req.method === "POST") {
    try { applyAuthorizationPatch(); log("05 사람 승인", "done", "서버 측 최소 권한 패치를 적용했습니다."); log("06 동일 공격 재실행", "running", "원래 공격 요청을 그대로 재생합니다."); return runRealAttack(result => { log("07 재검증", result.verification.verdict === "PASS" ? "done" : "failed", `관측: ${result.evidence.status}, 판정: ${result.verification.verdict}`); json(res, 200, result); }); } catch (error) { return json(res, 409, { error: error.message }); }
  }
  if (pathname === "/api/state") return json(res, 200, state);
  if (pathname === "/") return serveFile(res, path.join(__dirname, "public/index.html"), "text/html; charset=utf-8");
  if (pathname === "/app.js") return serveFile(res, path.join(__dirname, "public/app.js"), "text/javascript; charset=utf-8");
  if (pathname === "/styles.css") return serveFile(res, path.join(__dirname, "public/styles.css"), "text/css; charset=utf-8");
  if (pathname === "/integration.css") return serveFile(res, path.join(__dirname, "public/integration.css"), "text/css; charset=utf-8");
  if (pathname === "/onboarding.css") return serveFile(res, path.join(__dirname, "public/onboarding.css"), "text/css; charset=utf-8");
  if (pathname === "/analysis.css") return serveFile(res, path.join(__dirname, "public/analysis.css"), "text/css; charset=utf-8");
  if (pathname === "/results.css") return serveFile(res, path.join(__dirname, "public/results.css"), "text/css; charset=utf-8");
  if (pathname === "/result-layout.css") return serveFile(res, path.join(__dirname, "public/result-layout.css"), "text/css; charset=utf-8");
  if (pathname === "/result-simple.css") return serveFile(res, path.join(__dirname, "public/result-simple.css"), "text/css; charset=utf-8");
  if (pathname === "/result-override.css") return serveFile(res, path.join(__dirname, "public/result-override.css"), "text/css; charset=utf-8");
  json(res, 404, { error: "Not found" });
});

if (require.main === module) server.listen(PORT, () => console.log(`VibeCheck running at http://localhost:${PORT}`));
module.exports = { server, runRealAttack, applyAuthorizationPatch };
