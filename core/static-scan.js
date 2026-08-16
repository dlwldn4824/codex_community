const { execFileSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const toolRoot = path.join(root, ".tools/semgrep");
const semgrep = path.join(toolRoot, "bin/semgrep");

function scanStaticCode() {
  try {
    const output = execFileSync(semgrep, ["scan", "--config", "auto", "target-app", "core", "server.js", "--json", "--quiet"], {
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

module.exports = { scanStaticCode };
