const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");

function parseGitHubUrl(value) {
  const parsed = new URL(value);
  if (parsed.hostname !== "github.com") throw new Error("현재는 공개 GitHub 저장소 URL만 실제 분석할 수 있습니다.");
  const [owner, repository] = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  if (!owner || !repository || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repository)) throw new Error("GitHub 저장소 URL 형식을 확인해 주세요.");
  return { owner, repository, cloneUrl: `https://github.com/${owner}/${repository}.git` };
}

function run(command, args, options) {
  return new Promise((resolve, reject) => execFile(command, args, options, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout)));
}

function walk(directory, files = [], depth = 0) {
  if (depth > 7 || files.length >= 500) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "vendor", "dist", "build"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, files, depth + 1);
    else files.push(full);
    if (files.length >= 500) break;
  }
  return files;
}

async function analyzeGitHubRepository(url) {
  const repo = parseGitHubUrl(url);
  const directory = path.join(os.tmpdir(), `vibecheck-${crypto.randomUUID()}`);
  try {
    await run("git", ["clone", "--depth", "1", "--filter=blob:none", repo.cloneUrl, directory], { timeout: 45000 });
    const files = walk(directory);
    const relative = files.map(file => path.relative(directory, file));
    const routes = relative.filter(file => /(\/api\/|routes?\/|route\.|controller)/i.test(file)).slice(0, 30);
    const authFiles = relative.filter(file => /(auth|login|logout|middleware|guard|permission|session)/i.test(file)).slice(0, 30);
    return { ...repo, directory, fileCount: relative.length, files: relative.slice(0, 100), allFiles: relative, routes, authFiles };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function buildRepositoryGraph(project, scan) {
  const routeFiles = (project.routes.length ? project.routes : project.files.filter(file => /\.(js|ts|tsx|py|java)$/i.test(file)).slice(0, 3)).slice(0, 5);
  const authFiles = project.authFiles.slice(0, 4);
  const nodes = [{ id: "repository", label: project.repository, type: "repository", detail: `${project.fileCount}개 파일` }];
  routeFiles.forEach((file, index) => nodes.push({ id: `route-${index}`, label: path.basename(file), type: "route", detail: file }));
  authFiles.forEach((file, index) => nodes.push({ id: `auth-${index}`, label: path.basename(file), type: "auth", detail: file }));
  const findings = scan.findings.slice(0, 5).map((finding, index) => ({ ...finding, file: path.relative(project.directory, finding.file), id: `finding-${index}` }));
  findings.forEach(finding => nodes.push({ id: finding.id, label: "보안 점검 결과", type: "finding", detail: `${finding.file}:${finding.line}` }));
  const edges = routeFiles.map((file, index) => ({ from: "repository", to: `route-${index}`, label: "API / 기능 파일", risk: false }));
  authFiles.forEach((file, index) => edges.push({ from: "repository", to: `auth-${index}`, label: "인증·권한 파일", risk: false }));
  findings.forEach(finding => { const source = routeFiles.findIndex(file => file === finding.file); edges.push({ from: source >= 0 ? `route-${source}` : "repository", to: finding.id, label: "⚠ Semgrep 점검 필요", risk: true, message: finding.message }); });
  return { nodes, edges, findings };
}

function projectType(files) {
  if (files.some(file => /(electron|tauri)/i.test(file))) return "DESKTOP";
  if (files.some(file => /^bin\//.test(file))) return "CLI";
  if (files.some(file => /(train|model|notebook|\.ipynb$)/i.test(file))) return "ML";
  if (files.some(file => /^(public\/|src\/|app\/|pages\/)/.test(file))) return "WEB";
  if (files.some(file => /(server|controller|routes?|api)\./i.test(file))) return "BACKEND";
  return "UNKNOWN";
}

function extractCodeFacts(project) {
  const files = (project.allFiles || project.files).filter(file => /\.(js|jsx|ts|tsx|py|java|go|rb|php|html)$/i.test(file)).slice(0, 220);
  const records = files.map(file => { try { return { file, text: fs.readFileSync(path.join(project.directory, file), "utf8").slice(0, 50000) }; } catch { return { file, text: "" }; } });
  const facts = { framework: projectType(project.allFiles || project.files), pages: [], components: [], apiEndpoints: [], databaseCalls: [], externalCalls: [], imports: [] };
  records.forEach(({ file, text }) => {
    if (/(pages\/|app\/.*page\.|index\.(html|tsx|jsx)$)/i.test(file)) facts.pages.push(file);
    if (/(components\/|\.tsx$|\.jsx$)/i.test(file)) facts.components.push(file);
    if (/(prisma|sequelize|mongoose|database|\.query\(|SELECT\s|INSERT\s|UPDATE\s)/i.test(text)) facts.databaseCalls.push(file);
    if (/(fetch\(|axios\.|urllib|requests\.|https?:\/\/)/i.test(text)) facts.externalCalls.push(file);
    const importMatches = [...text.matchAll(/(?:import.+?from\s+|require\()\s*["']([^"']+)["']/g)].slice(0, 20); importMatches.forEach(match => facts.imports.push({ from: file, to: match[1] }));
    const routeMatches = [...text.matchAll(/(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)/g)]; routeMatches.forEach(match => facts.apiEndpoints.push({ file, method: match[1].toUpperCase(), path: match[2] }));
    if (/app\/api\/(.+?)\/route\.(js|ts)$/i.test(file)) facts.apiEndpoints.push({ file, method: "API", path: `/api/${file.match(/app\/api\/(.+?)\/route\.(js|ts)/i)[1]}` });
  });
  return facts;
}

function buildUserSecurityMap(project, scan) {
  const files = project.allFiles || project.files;
  const readable = files.filter(file => /\.(js|jsx|ts|tsx|py|java|go|rb|php|html|css|md)$/i.test(file)).slice(0, 220);
  const source = readable.map(file => { try { return { file, text: fs.readFileSync(path.join(project.directory, file), "utf8").slice(0, 50000) }; } catch { return { file, text: "" }; } });
  const has = expression => source.some(item => expression.test(`${item.file}\n${item.text}`));
  const sourcesFor = expression => source.filter(item => expression.test(`${item.file}\n${item.text}`)).slice(0, 8).map(item => item.file);
  const codeFacts = extractCodeFacts(project), nodes = [], edges = [];
  const addNode = (id, label, description, matcher, confidence = "CONFIRMED") => { if (nodes.some(node => node.id === id)) return; nodes.push({ id, type: "service", label, description, sourceFiles: sourcesFor(matcher), confidence }); };
  const addEdge = (sourceId, targetId, displayLabel, securityStatus = "SAFE", explanation = "", data = []) => { if (nodes.some(node => node.id === sourceId) && nodes.some(node => node.id === targetId)) edges.push({ id: `${sourceId}-${targetId}-${edges.length}`, source: sourceId, target: targetId, relation: "DATA_FLOW", displayLabel, data, sourceFiles: [...new Set([...nodes.find(node => node.id === sourceId).sourceFiles, ...nodes.find(node => node.id === targetId).sourceFiles])], securityStatus, severity: securityStatus === "CRITICAL" ? "HIGH" : securityStatus === "WARNING" ? "MEDIUM" : "NONE", explanation }); };
  const type = projectType(files);
  if (has(/index\.html|app\/(page|layout)\.|pages\//i)) addNode("home", "홈 화면", "사용자가 서비스를 시작하는 화면", /index\.html|app\/(page|layout)\.|pages\//i);
  if (has(/login|signin|auth|session|token/i)) addNode("login", "로그인", "사용자 인증을 처리하는 기능", /login|signin|auth|session|token/i);
  if (has(/profile|userProfile|getUser|users\//i)) addNode("profile", "프로필 조회", "사용자 프로필 정보를 조회하는 기능", /profile|userProfile|getUser|users\//i);
  if (has(/users|profile|email|personal.?data/i)) addNode("personal-data", "사용자 개인정보", "프로필·회원 정보 데이터", /users|profile|email|personal.?data/i);
  if (has(/admin|administrator/i)) addNode("admin", "관리자 기능", "관리자 전용 기능", /admin|administrator/i);
  if (has(/prisma|sequelize|mongoose|database|sql|users\s*[:=]/i)) addNode("database", "사용자 데이터 저장소", "사용자 데이터를 읽고 저장하는 영역", /prisma|sequelize|mongoose|database|sql|users\s*[:=]/i);
  if (has(/upload|multer|file input|formdata/i)) addNode("upload", "파일 업로드", "사용자 파일을 받는 기능", /upload|multer|file input|formdata/i);
  if (has(/fetch\(|axios|urllib|requests\.|https?:\/\//i)) addNode("external", "외부 서비스 요청", "외부 API 또는 URL로 데이터를 보내는 기능", /fetch\(|axios|urllib|requests\.|https?:\/\//i);
  if (!nodes.length) addNode("project", type === "CLI" ? "명령 실행 기능" : type === "DESKTOP" ? "데스크톱 앱 기능" : "프로젝트 기능", "코드에서 직접 확인된 프로젝트 진입 기능", /./);
  const idData = has(/userId|targetId|\/users\/:id|\/users\/\$\{/i) ? ["사용자 ID"] : [];
  const personalFields = ["name", "email", "phone", "address"].filter(field => has(new RegExp(field, "i"))).map(field => ({ name: "이름", email: "이메일", phone: "전화번호", address: "주소" }[field]));
  addEdge("home", "login", "로그인 화면으로 이동", "SAFE"); addEdge("login", "profile", "인증 정보 전달", "SAFE", "로그인 관련 코드가 확인된 경우에만 연결합니다.", idData); addEdge("profile", "personal-data", personalFields.length ? `${personalFields.join(" · ")} 요청` : "개인정보 요청", "SAFE", "프로필 관련 코드에서 확인된 데이터 흐름입니다.", idData); addEdge("profile", "database", "사용자 정보 조회", "SAFE", "데이터 저장소 접근 코드가 확인됐습니다.", idData); addEdge("admin", "database", "관리자 정보 조회", "SAFE"); addEdge("upload", "external", "파일 또는 데이터 전달", "UNKNOWN", "외부 전송 여부를 코드 근거로 추가 확인해야 합니다.");
  const riskTarget = finding => /urllib|url|http/i.test(`${finding.rule} ${finding.message}`) ? "external" : /docker|container|user/i.test(`${finding.rule} ${finding.message}`) ? "runtime" : /path|file/i.test(`${finding.rule} ${finding.message}`) ? "filesystem" : "browser";
  const riskMeta = { external: ["외부 서비스 요청", "외부 주소 요청을 확인해야 합니다."], runtime: ["실행 환경", "컨테이너 실행 권한을 확인해야 합니다."], filesystem: ["파일 시스템", "파일 접근 경로를 확인해야 합니다."], browser: ["브라우저 화면", "사용자 입력이 화면에 표시되는 경로를 확인해야 합니다."] };
  scan.findings.slice(0, 6).forEach((finding, index) => { const target = riskTarget(finding), [label, explanation] = riskMeta[target]; addNode(target, label, explanation, /$^/, "INFERRED"); const related = nodes.find(node => node.sourceFiles.some(file => finding.file.endsWith(file))) || nodes.find(node => node.id === "profile") || nodes[0]; edges.push({ id: `finding-${index}`, source: related.id, target, relation: "SECURITY_CHECK", displayLabel: "⚠ 확인이 필요한 보안 흐름", securityStatus: "WARNING", severity: "MEDIUM", evidenceIds: [`semgrep-${index}`], findingIds: [finding.rule], explanation: finding.message, technicalDetails: { file: path.relative(project.directory, finding.file), line: finding.line, rule: finding.rule } }); });
  return { projectType: type, codeFacts, nodes, edges };
}

module.exports = { analyzeGitHubRepository, buildRepositoryGraph, buildUserSecurityMap };
