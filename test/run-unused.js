// 파일 단위 분석 규칙 (unusedImport / unusedVariable / unusedFunction) fixture 일괄 검증
const path = require("path");
const { scan } = require("../out/scanner");

const fixtures = [
  "unusedvar-cases.ts",       // 사용 중인 변수 모음 — 0 issue 기대
  "unusedvar-advanced.ts",    // 사용 중인 변수 (고급) — 0 issue 기대
  "unusedvar-rest.ts",        // rest 패턴 — 0 issue 기대 (line 28의 x,y는 검출 기대)
  "unusedvar-jsx.tsx",        // JSX 사용 — 0 issue 기대
  "unusedfn.ts",              // 미사용 함수 — unusedHelper, deadCode 검출 기대
];

const baseConfig = {
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
      config: baseConfig,
      thresholds: { paramCount: 4, functionLength: 50, nestingDepth: 4 },
    });
    console.log(`\n=== ${f} : ${r.issues.length} issues ===`);
    for (const i of r.issues) {
      console.log(`  ${i.line}:${i.column}  [${i.ruleId}]  ${i.message}`);
    }
  }
})();
