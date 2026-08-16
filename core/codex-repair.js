const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const MAX_SOURCE_CHARS = 18000;

function run(command, args, options) {
  return new Promise((resolve, reject) => execFile(command, args, options, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve({ stdout, stderr })));
}

function safeRelativePath(value) {
  const normalized = path.posix.normalize(String(value || "").replace(/\\/g, "/"));
  return normalized && !normalized.startsWith("../") && !path.posix.isAbsolute(normalized) ? normalized : null;
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text;
  return (response.output || []).flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("\n");
}

async function requestCodexRepair({ file, finding, source }) {
  if (!process.env.OPENAI_API_KEY) return { status: "NOT_CONFIGURED", reason: "OPENAI_API_KEY가 설정되지 않았습니다." };
  const model = process.env.VIBECHECK_REPAIR_MODEL || "gpt-5.6-terra";
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["file", "summary", "patch", "recheck"],
    properties: {
      file: { type: "string" },
      summary: { type: "string" },
      patch: { type: "string" },
      recheck: { type: "string" }
    }
  };
  const prompt = [
    "You are a security repair agent. Produce a minimal, reviewable unified diff for exactly one finding.",
    "Never modify files other than the provided file. Do not change dependencies, lockfiles, CI permissions, or introduce network calls.",
    "If a safe patch cannot be inferred from this one file alone, return an empty patch and explain why in Korean.",
    `Finding rule: ${finding.rule}`,
    `Finding message: ${finding.message}`,
    `File: ${file}`,
    "Source:\n```\n" + source.slice(0, MAX_SOURCE_CHARS) + "\n```"
  ].join("\n\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      reasoning: { effort: "medium" },
      input: [{ role: "developer", content: prompt }],
      text: { format: { type: "json_schema", name: "vibecheck_repair", strict: true, schema } }
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Codex API 요청에 실패했습니다.");
  try { return { status: "GENERATED", model, ...JSON.parse(extractOutputText(body)) }; }
  catch { throw new Error("Codex API가 읽을 수 있는 수정 JSON을 반환하지 않았습니다."); }
}

async function applyPatch(project, proposal) {
  const file = safeRelativePath(proposal.file);
  const allowedFiles = new Set(project.allFiles || project.files || []);
  if (!file || !allowedFiles.has(file)) return { status: "REJECTED", reason: "Codex 수정안의 대상 파일이 현재 복제본에 없습니다." };
  const patch = String(proposal.patch || "").trim();
  if (!patch) return { status: "REVIEW_REQUIRED", reason: proposal.summary || "안전한 자동 수정안을 만들지 못했습니다." };
  const changedFiles = [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(match => safeRelativePath(match[1]));
  if (changedFiles.length !== 1 || changedFiles[0] !== file) return { status: "REJECTED", reason: "한 번에 한 파일만 수정하도록 제한되어 있어 수정안을 적용하지 않았습니다." };
  const patchPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-patch-")), "repair.patch");
  try {
    fs.writeFileSync(patchPath, patch, "utf8");
    await run("git", ["apply", "--check", "--whitespace=nowarn", patchPath], { cwd: project.directory, timeout: 12000 });
    await run("git", ["apply", "--whitespace=nowarn", patchPath], { cwd: project.directory, timeout: 12000 });
    return { status: "APPLIED", file, summary: proposal.summary, recheck: proposal.recheck, patch };
  } catch (error) {
    return { status: "REVIEW_REQUIRED", reason: `수정안을 안전하게 적용하지 못했습니다: ${error.message.split("\n")[0]}` };
  } finally { fs.rmSync(path.dirname(patchPath), { recursive: true, force: true }); }
}

async function proposeAndApplyCodexRepairs(project, findings) {
  const max = Math.min(Math.max(Number(process.env.VIBECHECK_REPAIR_MAX_ITEMS || 3), 1), 10);
  if (!process.env.OPENAI_API_KEY) return { status: "NOT_CONFIGURED", model: null, attempted: 0, applied: [], reviewRequired: [], reason: "OPENAI_API_KEY가 없어 Codex API를 호출하지 않았습니다." };
  const selected = [];
  const seenFiles = new Set();
  for (const finding of findings) {
    const file = safeRelativePath(path.relative(project.directory, finding.file));
    if (!file || seenFiles.has(file)) continue;
    seenFiles.add(file); selected.push({ finding, file });
    if (selected.length >= max) break;
  }
  const applied = [], reviewRequired = [];
  for (const { finding, file } of selected) {
    try {
      const source = fs.readFileSync(path.join(project.directory, file), "utf8");
      const proposal = await requestCodexRepair({ file, finding, source });
      if (proposal.status === "NOT_CONFIGURED") return { status: "NOT_CONFIGURED", model: null, attempted: 0, applied, reviewRequired, reason: proposal.reason };
      const outcome = await applyPatch(project, proposal);
      if (outcome.status === "APPLIED") applied.push({ file, line: finding.line, before: finding.snippet?.trim() || "탐지된 코드", after: proposal.summary, source: "Codex API" });
      else reviewRequired.push({ file, line: finding.line, reason: outcome.reason || proposal.summary, source: "Codex API" });
    } catch (error) { reviewRequired.push({ file, line: finding.line, reason: error.message, source: "Codex API" }); }
  }
  return { status: "COMPLETED", model: process.env.VIBECHECK_REPAIR_MODEL || "gpt-5.6-terra", attempted: selected.length, applied, reviewRequired, reason: `Codex API가 파일 ${selected.length}개에 대해 최소 수정안을 생성·검토했습니다.` };
}

module.exports = { proposeAndApplyCodexRepairs };
