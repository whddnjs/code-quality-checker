const path = require("path");
const { scan } = require("../out/scanner");

const fixtures = [
  "unusedimport-edge.ts",
  "unusedvar-edge.ts",
  "unusedfn-edge.ts",
];

const cfg = {
  emptyMethod: false,
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

(async () => {
  for (const f of fixtures) {
    const file = path.resolve(__dirname, "fixtures", f);
    const r = await scan({
      files: [file],
      config: cfg,
      thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 },
    });
    console.log(`\n=== ${f} : ${r.issues.length} issues ===`);
    for (const i of r.issues) {
      console.log(`  ${i.line}:${i.column}  [${i.ruleId}]  ${i.message}`);
    }
  }
})();
