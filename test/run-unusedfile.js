// unusedFile cross-file 분석 검증
const path = require("path");
const fs = require("fs");
const { scan } = require("../out/scanner");

const root = "/tmp/cq-fixture";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (/\.(tsx?|d\.ts)$/.test(entry.name)) files.push(p);
  }
  return files;
}

const files = walk(root);
console.log("스캔 대상:", files.length, "files");
files.forEach((f) => console.log("  -", path.relative(root, f)));

const cfg = {
  emptyMethod: false,
  emptyMethodIncludeAnonymous: false,
  emptyMethodIgnoreCommented: false,
  unusedImport: false,
  unusedVariable: false,
  unusedVariableIncludeSpec: false,
  unusedFunction: false,
  todoComment: false,
  consoleCall: false,
  smallSwitch: false,
  emptyCatch: false,
  anyType: false,
  paramCount: false,
  functionLength: false,
  nestingDepth: false,
  mergeConflict: false,
  unusedFile: true,
  consoleMethods: ["log"],
};

scan({
  files,
  config: cfg,
  thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 },
}).then((r) => {
  console.log(`\n=== ${r.issues.length} issues (${r.durationMs}ms) ===`);
  for (const i of r.issues) {
    console.log(`  [${i.ruleId}]  ${path.relative(root, i.filePath)}  — ${i.message}`);
  }
});
