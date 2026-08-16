const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
process.env.PORT = "3107";
const { server } = require("../runtime");

const target = path.join(__dirname, "../target-app/users.js");
const original = fs.readFileSync(target, "utf8");
const guard = '  if (requester.role !== "ADMIN" && requester.id !== targetId) {\n    return { status: 403, body: { error: "다른 회원의 프로필은 볼 수 없습니다." } };\n  }\n';
const vulnerableSource = original.replace(guard, "");

test("Golden Demo: real attack → violation → approval patch → replay pass", async (t) => {
  fs.writeFileSync(target, vulnerableSource);
  await new Promise(resolve => server.listen(3107, resolve));
  t.after(() => { server.close(); fs.writeFileSync(target, original); try { fs.unlinkSync(`${target}.before-vibecheck`); } catch {} });
  const run = async route => (await fetch(`http://127.0.0.1:3107${route}`, { method: "POST" })).json();
  const upload = await fetch("http://127.0.0.1:3107/api/company-policy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "company-policy.md", text: "일반 회원은 본인의 개인정보와 프로필만 조회할 수 있습니다." }) });
  assert.equal(upload.status, 201);
  const before = await run("/api/run-attack");
  assert.equal(before.evidence.status, 200);
  assert.equal(before.verification.verdict, "VIOLATION");
  assert.equal(before.kg.reasoning.includes("VIOLATION"), true);
  assert.equal(before.integration.jira.status, "수정 대기");
  assert.equal(before.integration.progress.percent, 50);
  assert.equal(before.staticScan.engine, "Semgrep");
  assert.equal(before.staticScan.status, "COMPLETED");
  assert.equal(before.policyRag.source, "company-policy.md");
  assert.equal(before.policyRag.matched, true);
  const after = await run("/api/approve-fix");
  assert.equal(after.evidence.status, 403);
  assert.equal(after.verification.verdict, "PASS");
  assert.equal(after.integration.jira.status, "완료");
  assert.equal(after.integration.progress.percent, 100);
  assert.equal(fs.readFileSync(target, "utf8").includes('requester.role !== "ADMIN"'), true);
});
