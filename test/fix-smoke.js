// fix 탐색 로직이 hint 라인과 가장 가까운 대상을 올바르게 선택하는지 검증.
// VSCode API는 쓰지 않고 TS scanner/parser만 사용.
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "fixtures/sample.ts");
const text = fs.readFileSync(file, "utf8");
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function nearestLine(items, hint, keyFn) {
  return items.reduce((best, c) =>
    Math.abs(keyFn(c) - hint) < Math.abs(keyFn(best) - hint) ? c : best
  );
}

// TODO 후보 수집
function findTodos() {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, sf.languageVariant, text);
  const out = [];
  const re = /\b(TODO|FIXME|XXX|HACK)\b/;
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const s = scanner.getTokenStart();
      const e = scanner.getTokenEnd();
      if (re.test(text.slice(s, e))) {
        const sl = sf.getLineAndCharacterOfPosition(s).line;
        const el = sf.getLineAndCharacterOfPosition(e).line;
        out.push({ startLine: sl, endLine: el });
      }
    }
    token = scanner.scan();
  }
  return out;
}

// console 후보 수집
function findConsoles(method) {
  const out = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const ex = node.expression;
      if (
        ts.isPropertyAccessExpression(ex) &&
        ts.isIdentifier(ex.expression) &&
        ex.expression.text === "console" &&
        (!method || ex.name.text === method)
      ) {
        const target =
          node.parent && ts.isExpressionStatement(node.parent) ? node.parent : node;
        const sl = sf.getLineAndCharacterOfPosition(target.getStart(sf)).line;
        const el = sf.getLineAndCharacterOfPosition(target.getEnd()).line;
        out.push({ startLine: sl, endLine: el });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const todos = findTodos();
const consoles = findConsoles("log");

console.log("TODO candidates (0-based lines):", todos);
console.log("console.log candidates (0-based lines):", consoles);

// 시뮬레이션: hint가 TODO 위치면 TODO, console 위치면 console을 집어야 함 (1-based input)
const todoHint = todos[0].startLine + 1; // 1-based
const consoleHint = consoles[0].startLine + 1;

const pickedForTodo = nearestLine(todos, todoHint - 1, (c) => c.startLine);
const pickedForConsole = nearestLine(consoles, consoleHint - 1, (c) => c.startLine);

console.log(`TODO hint ${todoHint} → picked`, pickedForTodo);
console.log(`console hint ${consoleHint} → picked`, pickedForConsole);

// 크로스 체크: TODO 리스트에서 console 힌트로 탐색하면 → 가장 가까운 TODO 골라야 하고,
// 그게 실제 console 라인이 아니어야 함 (서로 다른 라인)
const crossed = nearestLine(todos, consoles[0].startLine, (c) => c.startLine);
console.log(
  `TODO list with console hint → picked TODO at line ${crossed.startLine} (should not match any console line)`
);

const allConsoleLines = new Set(consoles.map((c) => c.startLine));
if (allConsoleLines.has(crossed.startLine)) {
  console.error("FAIL: TODO search hit a console line!");
  process.exit(1);
}
console.log("OK: TODO/console 대상이 서로 섞이지 않음");
