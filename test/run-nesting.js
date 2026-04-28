const path = require("path");
const { scan } = require("../out/scanner");
const file = path.resolve(__dirname, "fixtures/nesting-elseif.ts");
const cfg = {
  emptyMethod: false, emptyMethodIncludeAnonymous: false, emptyMethodIgnoreCommented: false,
  unusedImport: false, unusedVariable: false, unusedVariableIncludeSpec: false, unusedFunction: false,
  todoComment: false, consoleCall: false, smallSwitch: false, emptyCatch: false,
  emptyCatchIgnoreCommented: false, anyType: false, paramCount: false, functionLength: false,
  nestingDepth: true, mergeConflict: false, unusedFile: false, consoleMethods: ["log"],
};
scan({ files: [file], config: cfg, thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 } })
  .then((r) => {
    console.log(`${r.issues.length} issues (임계값 4)`);
    for (const i of r.issues) console.log(`  ${i.line}:${i.column}  ${i.message}`);
  });
