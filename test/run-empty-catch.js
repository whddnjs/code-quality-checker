// emptyCatchIgnoreCommented 옵션 ON/OFF 검증
const path = require("path");
const { scan } = require("../out/scanner");

const fixture = path.resolve(__dirname, "fixtures/edge-cases.ts");
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
  emptyCatch: true,
  emptyCatchIgnoreCommented: false,
  anyType: false,
  paramCount: false,
  functionLength: false,
  nestingDepth: false,
  mergeConflict: false,
  unusedFile: false,
  consoleMethods: ["log"],
};

(async () => {
  for (const ignore of [false, true]) {
    const r = await scan({
      files: [fixture],
      config: { ...cfg, emptyCatchIgnoreCommented: ignore },
      thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 },
    });
    console.log(`\n=== emptyCatchIgnoreCommented=${ignore} : ${r.issues.length} issues ===`);
    for (const i of r.issues) console.log(`  ${i.line}:${i.column}  [${i.ruleId}]  ${i.message}`);
  }
})();
