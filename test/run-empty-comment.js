// emptyMethodIgnoreCommented ON/OFF 비교
const path = require("path");
const { scan } = require("../out/scanner");

const fixture = path.resolve(__dirname, "fixtures/empty-method-comment.ts");

const baseConfig = {
  emptyMethod: true,
  emptyMethodIncludeAnonymous: false,
  emptyMethodIgnoreCommented: false,
  unusedImport: true,
  unusedVariable: true,
  unusedVariableIncludeSpec: false,
  unusedFunction: true,
  todoComment: false,
  consoleCall: false,
  smallSwitch: false,
  emptyCatch: false,
  anyType: false,
  paramCount: false,
  functionLength: false,
  nestingDepth: false,
  mergeConflict: false,
  unusedFile: false,
  consoleMethods: ["log"],
};

async function runOnce(label, configOverrides = {}) {
  const config = { ...baseConfig, ...configOverrides };
  const r = await scan({
    files: [fixture],
    config,
    thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 },
  });
  console.log(`\n=== ${label} : ${r.issues.length} issues ===`);
  for (const i of r.issues) {
    console.log(`  ${i.line}:${i.column}  [${i.ruleId}]  ${i.message}`);
  }
}

(async () => {
  await runOnce("ignoreCommented=OFF (기본)");
  await runOnce("ignoreCommented=ON", { emptyMethodIgnoreCommented: true });
})();
