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
  const facts = { framework: projectType(project.allFiles || project.files), pages: [], components: [], apiEndpoints: [], databaseCalls: [], externalCalls: [], httpRequests: [], imports: [] };
  records.forEach(({ file, text }) => {
    if (/(pages\/|app\/.*page\.|index\.(html|tsx|jsx)$)/i.test(file)) facts.pages.push(file);
    if (/(components\/|\.tsx$|\.jsx$)/i.test(file)) facts.components.push(file);
    if (/(prisma|sequelize|mongoose|database|\.query\(|SELECT\s|INSERT\s|UPDATE\s)/i.test(text)) facts.databaseCalls.push(file);
    if (/(fetch\(|axios\.|urllib|requests\.|https?:\/\/)/i.test(text)) facts.externalCalls.push(file);
    const requests = [...text.matchAll(/(?:fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*["'`]([^"'`\s?#]+)/g)]; requests.forEach(match => facts.httpRequests.push({ file, path: match[1], method: /axios\.post/i.test(match[0]) ? "POST" : "GET" }));
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
  const fileNodeByFile = new Map();
  const fileTitle = (file, role) => {
    const raw = path.basename(file).replace(/\.(jsx?|tsx?|py|java|go|rb|php|html)$/i, "").replace(/[-_]/g, " ");
    if (/^(index|page)$/i.test(raw)) return role;
    if (/login|signin|auth/i.test(raw)) return role === "화면" ? "로그인 화면" : "로그인·인증 처리";
    if (/profile|user/i.test(raw)) return role === "화면" ? "프로필 화면" : "사용자 정보 처리";
    if (/admin/i.test(raw)) return "관리자 기능";
    if (/upload|file/i.test(raw)) return "파일 업로드 처리";
    return `${raw} ${role}`;
  };
  const addDetailNode = (file, role, description) => {
    if (!file || fileNodeByFile.has(file)) return fileNodeByFile.get(file);
    const id = `code-${file.replace(/[^a-zA-Z0-9]/g, "-").slice(-58)}`;
    nodes.push({ id, type: "code-feature", label: fileTitle(file, role), description, sourceFiles: [file], confidence: "CONFIRMED" });
    fileNodeByFile.set(file, id); return id;
  };
  codeFacts.pages.slice(0, 6).forEach(file => addDetailNode(file, "화면", "사용자가 직접 보는 서비스 화면"));
  project.authFiles.slice(0, 5).forEach(file => addDetailNode(file, "권한 확인", "로그인·세션·권한을 확인하는 코드"));
  codeFacts.databaseCalls.slice(0, 5).forEach(file => addDetailNode(file, "데이터 처리", "서비스 데이터를 조회하거나 저장하는 코드"));
  codeFacts.externalCalls.slice(0, 5).forEach(file => addDetailNode(file, "외부 연동", "외부 주소 또는 API와 통신하는 코드"));
  codeFacts.components.filter(file => !fileNodeByFile.has(file)).slice(0, 6).forEach(file => addDetailNode(file, "기능 화면", "화면에서 사용자 입력 또는 결과를 처리하는 코드"));
  const featureRules = [
    [/(login|signin|auth|session|token)/i, "로그인·인증", "인증 정보를 처리하는 기능"], [/(profile|user)/i, "사용자 프로필", "사용자 정보를 조회·처리하는 기능"], [/(admin|dashboard)/i, "관리자·대시보드", "관리자 또는 운영 화면 기능"], [/(payment|billing|checkout)/i, "결제", "결제 정보를 처리하는 기능"], [/(upload|file|media|image)/i, "파일 처리", "파일 업로드 또는 미디어 처리 기능"], [/(route|api|controller|server)/i, "서비스 API", "서비스 요청을 처리하는 기능"], [/(database|repository|model|store|prisma|sequelize|mongoose)/i, "데이터 저장소", "서비스 데이터를 읽고 저장하는 기능"], [/(security|scan|verify|rule|policy)/i, "보안 검증", "보안 규칙 또는 분석을 처리하는 기능"], [/(analy|model|predict|voice|audio)/i, "분석 기능", "입력 데이터를 분석하는 기능"]
  ];
  const fileFeature = new Map();
  source.forEach(({ file, text }) => { const rule = featureRules.find(([pattern]) => pattern.test(`${file}\n${text}`)); if (!rule) return; const [, label, description] = rule, key = label.replace(/[^a-zA-Z0-9가-힣]/g, ""); const id = `feature-${key}`; if (!nodes.some(node => node.id === id)) nodes.push({ id, type: "feature", label, description, sourceFiles: [file], confidence: "CONFIRMED" }); else nodes.find(node => node.id === id).sourceFiles.push(file); fileFeature.set(file, id); });
  const idData = has(/userId|targetId|\/users\/:id|\/users\/\$\{/i) ? ["사용자 ID"] : [];
  const personalFields = ["name", "email", "phone", "address"].filter(field => has(new RegExp(field, "i"))).map(field => ({ name: "이름", email: "이메일", phone: "전화번호", address: "주소" }[field]));
  addEdge("home", "login", "로그인 화면으로 이동", "SAFE"); addEdge("login", "profile", "인증 정보 전달", "SAFE", "로그인 관련 코드가 확인된 경우에만 연결합니다.", idData); addEdge("profile", "personal-data", personalFields.length ? `${personalFields.join(" · ")} 요청` : "개인정보 요청", "SAFE", "프로필 관련 코드에서 확인된 데이터 흐름입니다.", idData); addEdge("profile", "database", "사용자 정보 조회", "SAFE", "데이터 저장소 접근 코드가 확인됐습니다.", idData); addEdge("admin", "database", "관리자 정보 조회", "SAFE"); addEdge("upload", "external", "파일 또는 데이터 전달", "UNKNOWN", "외부 전송 여부를 코드 근거로 추가 확인해야 합니다.");
  const basenameToFeature = new Map([...fileFeature].map(([file, id]) => [path.basename(file).replace(/\.[^.]+$/, ""), id]));
  codeFacts.imports.forEach(link => { const sourceId = fileFeature.get(link.from), targetBase = path.basename(link.to).replace(/\.[^.]+$/, ""), targetId = basenameToFeature.get(targetBase); if (sourceId && targetId && sourceId !== targetId && !edges.some(edge => edge.source === sourceId && edge.target === targetId)) addEdge(sourceId, targetId, "기능 호출", "SAFE", "import 관계에서 직접 확인된 기능 연결입니다."); });
  const endpointNodes = [];
  codeFacts.apiEndpoints.slice(0, 10).forEach((endpoint, index) => {
    const id = `api-${index}`, label = `${endpoint.method} ${endpoint.path}`;
    nodes.push({ id, type: "api", label, description: "코드에서 확인된 API 요청 처리 기능", sourceFiles: [endpoint.file], confidence: "CONFIRMED" }); endpointNodes.push({ ...endpoint, id });
    const owner = fileNodeByFile.get(endpoint.file) || fileFeature.get(endpoint.file) || nodes.find(node => node.id === "profile")?.id || nodes[0].id;
    addEdge(owner, id, endpoint.path.includes("user") ? "사용자 ID 전달" : "서비스 요청", "SAFE", "코드에서 확인된 API endpoint입니다.", endpoint.path.includes("user") ? ["사용자 ID"] : []);
  });
  codeFacts.imports.forEach(link => {
    const from = fileNodeByFile.get(link.from), imported = link.to.replace(/^\.\//, "");
    const to = [...fileNodeByFile.entries()].find(([file]) => file.endsWith(imported) || path.basename(file).replace(/\.[^.]+$/, "") === path.basename(imported).replace(/\.[^.]+$/, ""))?.[1];
    if (from && to && from !== to && !edges.some(edge => edge.source === from && edge.target === to)) addEdge(from, to, "기능 사용", "SAFE", "코드 import 관계에서 확인된 기능 연결입니다.");
  });
  codeFacts.httpRequests.slice(0, 12).forEach(request => {
    const sourceId = fileNodeByFile.get(request.file) || fileFeature.get(request.file);
    const target = endpointNodes.find(endpoint => request.path.includes(endpoint.path.replace(/:\w+/g, "")) || endpoint.path.includes(request.path.replace(/\?.*$/, "")));
    if (sourceId && target && !edges.some(edge => edge.source === sourceId && edge.target === target.id)) addEdge(sourceId, target.id, `${request.method} 요청`, "SAFE", "화면 코드에서 API 요청이 확인됐습니다.");
  });
  endpointNodes.forEach(endpoint => {
    const endpointText = source.find(item => item.file === endpoint.file)?.text || "";
    const authTarget = [...fileNodeByFile.entries()].find(([file]) => project.authFiles.includes(file))?.[1];
    const dbTarget = [...fileNodeByFile.entries()].find(([file]) => codeFacts.databaseCalls.includes(file))?.[1];
    const externalTarget = [...fileNodeByFile.entries()].find(([file]) => codeFacts.externalCalls.includes(file))?.[1];
    if (authTarget && /auth|session|token|permission|role/i.test(endpointText)) addEdge(authTarget, endpoint.id, "권한 확인", "SAFE", "API 처리 코드에서 인증·권한 관련 로직이 확인됐습니다.");
    if (dbTarget && /prisma|sequelize|mongoose|database|\.query\(|select\s|insert\s|update\s/i.test(endpointText)) addEdge(endpoint.id, dbTarget, "데이터 조회·저장", "SAFE", "API 처리 코드에서 데이터 접근이 확인됐습니다.");
    if (externalTarget && /fetch\(|axios\.|https?:\/\//i.test(endpointText)) addEdge(endpoint.id, externalTarget, "외부 API 요청", "SAFE", "API 처리 코드에서 외부 연동이 확인됐습니다.");
  });
  const describeFinding = finding => {
    const signal = `${finding.rule} ${finding.message} ${finding.file}`.toLowerCase();
    const file = path.relative(project.directory, finding.file);
    const details = { file, line: finding.line, rule: finding.rule };
    if (/console\.log|console|print\(/.test(signal)) return { title: "개인정보가 개발자 콘솔에 표시될 수 있음", edge: "⚠ 개인정보가 콘솔에 노출될 수 있음", description: "사용자 정보가 브라우저 또는 서버의 개발자 콘솔에 출력되는 코드가 확인됐습니다.", target: "browser", details };
    if (/secret|api.?key|token|password|credential/.test(signal)) return { title: "비밀 정보가 코드에 포함될 수 있음", edge: "⚠ 비밀 정보가 코드에 포함될 수 있음", description: "API 키·토큰·비밀번호처럼 보호해야 할 값이 코드나 설정 파일에 남아 있는지 확인이 필요합니다.", target: "external", details };
    if (/sql|query|injection/.test(signal)) return { title: "입력값이 데이터 조회에 사용될 수 있음", edge: "⚠ 검증되지 않은 입력값으로 데이터 조회 가능", description: "사용자 입력이 충분한 검증 없이 데이터 조회에 전달될 가능성이 확인됐습니다.", target: "database", details };
    if (/path|file|directory|upload/.test(signal)) return { title: "파일 접근 경로를 확인해야 함", edge: "⚠ 외부 입력으로 파일에 접근할 수 있음", description: "사용자 입력이 파일 경로나 업로드 처리에 사용됩니다. 허용된 위치만 접근하는지 확인이 필요합니다.", target: "filesystem", details };
    if (/url|uri|http|request|fetch|axios|redirect/.test(signal)) return { title: "외부 주소 요청을 확인해야 함", edge: "⚠ 외부 주소로 데이터가 전달될 수 있음", description: "코드가 외부 주소로 요청을 보냅니다. 요청 대상과 전달되는 데이터가 안전한지 확인이 필요합니다.", target: "external", details };
    if (/docker|container|shell|command|exec/.test(signal)) return { title: "실행 환경 권한을 확인해야 함", edge: "⚠ 실행 권한이 넓게 열려 있을 수 있음", description: "명령 실행 또는 컨테이너 설정에서 권한 범위를 확인해야 하는 코드가 발견됐습니다.", target: "runtime", details };
    if (/auth|permission|role|user|access/.test(signal)) return { title: "사용자 권한 확인이 필요함", edge: "⚠ 권한 확인 없이 기능에 접근할 수 있음", description: "사용자·권한과 관련된 코드가 탐지됐습니다. 요청자의 권한을 확인하는지 검토가 필요합니다.", target: "browser", details };
    return { title: "보안 설정을 확인해야 함", edge: "⚠ 보안 설정 확인이 필요함", description: "정적 분석 규칙이 추가 검토가 필요한 코드를 찾았습니다. 상세 근거를 열어 실제 영향을 확인하세요.", target: "browser", details };
  };
  const riskTarget = finding => describeFinding(finding).target;
  const riskMeta = { external: ["외부 서비스 요청", "외부 주소 요청을 확인해야 합니다."], runtime: ["실행 환경", "컨테이너 실행 권한을 확인해야 합니다."], filesystem: ["파일 시스템", "파일 접근 경로를 확인해야 합니다."], database: ["사용자 데이터 저장소", "데이터 조회에 전달되는 입력값을 확인해야 합니다."], browser: ["브라우저 화면", "사용자 입력이 화면에 표시되는 경로를 확인해야 합니다."] };
  const securityFindings = scan.findings.map(describeFinding);
  scan.findings.slice(0, 6).forEach((finding, index) => { const findingSummary = securityFindings[index], target = riskTarget(finding), [label, explanation] = riskMeta[target]; addNode(target, label, explanation, /$^/, "INFERRED"); const relativeFile = path.relative(project.directory, finding.file); const related = fileNodeByFile.get(relativeFile) ? nodes.find(node => node.id === fileNodeByFile.get(relativeFile)) : nodes.find(node => node.sourceFiles.some(file => finding.file.endsWith(file))) || nodes.find(node => node.id === "profile") || nodes[0]; edges.push({ id: `finding-${index}`, source: related.id, target, relation: "SECURITY_CHECK", displayLabel: findingSummary.edge, securityStatus: "WARNING", severity: "MEDIUM", evidenceIds: [`semgrep-${index}`], findingIds: [finding.rule], explanation: findingSummary.description, technicalDetails: findingSummary.details }); });
  return { projectType: type, codeFacts, nodes, edges, securityFindings };
}

module.exports = { analyzeGitHubRepository, buildRepositoryGraph, buildUserSecurityMap };
