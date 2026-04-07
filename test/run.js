// 수동 검증 스크립트: fixture 파일에 스캐너를 돌려 이슈 목록 출력
const path = require("path");
const { scan } = require("../out/scanner");

const fixture = path.resolve(__dirname, "fixtures/sample.ts");

scan({
  files: [fixture],
  config: {
    emptyMethod: true,
    emptyMethodIncludeAnonymous: false,
    unusedImport: true,
    unusedVariable: true,
    todoComment: true,
    consoleCall: true,
    smallSwitch: true,
    emptyCatch: true,
    anyType: true,
    paramCount: true,
    functionLength: true,
    nestingDepth: true,
    mergeConflict: true,
    consoleMethods: ["log"],
  },
  thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 },
}).then((result) => {
  console.log(`\n=== ${result.issues.length} issues in ${result.fileCount} files (${result.durationMs}ms) ===\n`);
  const byRule = {};
  for (const i of result.issues) byRule[i.ruleId] = (byRule[i.ruleId] || 0) + 1;
  console.log("By rule:", byRule);
  console.log();
  for (const i of result.issues) {
    console.log(`  ${i.line}:${i.column}  [${i.ruleId}]  ${i.message}`);
  }
});
