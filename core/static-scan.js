const { execFile, execFileSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const toolRoot = path.join(root, ".tools/semgrep");
const semgrep = path.join(toolRoot, "bin/semgrep");

function scanStaticCode(targets = ["target-app", "core", "server.js"]) {
  try {
    const output = execFileSync(semgrep, ["scan", "--config", "auto", ...targets, "--json", "--quiet"], {
      cwd: root,
      encoding: "utf8",
      timeout: 45000,
      env: { ...process.env, PATH: `${path.join(toolRoot, "bin")}:${process.env.PATH}`, PYTHONPATH: toolRoot }
    });
    const report = JSON.parse(output);
    return {
      engine: "Semgrep",
      version: "1.173.0",
      status: "COMPLETED",
      findings: report.results.map(result => ({
        rule: result.check_id,
        file: result.path,
        line: result.start.line,
        message: result.extra.message
      }))
    };
  } catch (error) {
    return { engine: "Semgrep", status: "UNAVAILABLE", findings: [], error: error.message.split("\n")[0] };
  }
}

function scanStaticCodeAsync(targets = ["target-app", "core", "server.js"]) {
  return new Promise(resolve => {
    execFile(semgrep, ["scan", "--config", "auto", ...targets, "--json", "--quiet"], {
      cwd: root,
      encoding: "utf8",
      timeout: 45000,
      env: { ...process.env, PATH: `${path.join(toolRoot, "bin")}:${process.env.PATH}`, PYTHONPATH: toolRoot }
    }, (error, stdout) => {
      if (error) return resolve({ engine: "Semgrep", status: "UNAVAILABLE", findings: [], error: error.message.split("\n")[0] });
      try {
        const report = JSON.parse(stdout);
        resolve({ engine: "Semgrep", version: "1.173.0", status: "COMPLETED", findings: report.results.map(result => ({ rule: result.check_id, file: result.path, line: result.start.line, message: result.extra.message })) });
      } catch (parseError) {
        resolve({ engine: "Semgrep", status: "UNAVAILABLE", findings: [], error: parseError.message });
      }
    });
  });
}

module.exports = { scanStaticCode, scanStaticCodeAsync };
