// 엣지 케이스 fixture 검증 — 옵션 ON/OFF 두 모드로 돌려서 비교
const path = require("path");
const { scan } = require("../out/scanner");

const fixture = path.resolve(__dirname, "fixtures/edge-cases.ts");

const baseConfig = {
  emptyMethod: true,
  emptyMethodIncludeAnonymous: false,
  emptyMethodIgnoreCommented: false,
  unusedImport: true,
  unusedVariable: true,
  unusedVariableIncludeSpec: false,
  unusedFunction: true,
  todoComment: true,
  consoleCall: true,
  smallSwitch: true,
  emptyCatch: true,
  anyType: true,
  paramCount: true,
  functionLength: true,
  nestingDepth: true,
  mergeConflict: true,
  unusedFile: false,
  consoleMethods: ["log"],
};

const thresholds = { paramCount: 4, functionLength: 50, nestingDepth: 4 };

async function runOnce(label, configOverrides = {}, methods = ["log"]) {
  const config = { ...baseConfig, ...configOverrides, consoleMethods: methods };
  const r = await scan({ files: [fixture], config, thresholds });
  console.log(`\n=== ${label} : ${r.issues.length} issues ===`);
  const byRule = {};
  for (const i of r.issues) byRule[i.ruleId] = (byRule[i.ruleId] || 0) + 1;
  console.log("By rule:", byRule);
  for (const i of r.issues) {
    console.log(`  ${i.line}:${i.column}  [${i.ruleId}]  ${i.message}`);
  }
}

(async () => {
  await runOnce("default options (anonymous=OFF, ignoreCommented=OFF, log only)");
  await runOnce("emptyMethodIncludeAnonymous=ON", { emptyMethodIncludeAnonymous: true });
  await runOnce("consoleMethods=[log,warn,error,info]", {}, ["log", "warn", "error", "info"]);
})();
