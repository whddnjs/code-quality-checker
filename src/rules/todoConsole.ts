import * as ts from "typescript";
import { RuleContext } from "../types";

const TODO_RE = /\b(TODO|FIXME|XXX|HACK)\b/;

/**
 * TODO/FIXME 등 주석 마커 탐지.
 * 주석은 AST 노드가 아니므로 소스 텍스트에서 직접 스캔 (파일당 1회).
 */
export function checkTodoComments(sourceFile: ts.SourceFile, ctx: RuleContext): void {
  if (!ctx.config.todoComment) return;
  const text = sourceFile.getFullText();
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, sourceFile.languageVariant, text);

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const start = scanner.getTokenStart();
      const end = scanner.getTokenEnd();
      const commentText = text.slice(start, end);
      const match = TODO_RE.exec(commentText);
      if (match) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start + (match.index ?? 0));
        ctx.issues.push({
          ruleId: "todoComment",
          message: `${match[1]} 주석 남아있음`,
          filePath: ctx.filePath,
          line: line + 1,
          column: character + 1,
          endLine: line + 1,
          endColumn: character + 1 + match[0].length,
          severity: "info",
        });
      }
    }
    token = scanner.scan();
  }
}

/**
 * `console.*` 호출 탐지. AST 기반이라 텍스트 grep 대비 오탐 없음.
 *
 * - `consoleMethods` 배열에 포함된 메소드만 잡음 (기본 ["log"])
 * - 다중 라인 호출의 경우 부모 ExpressionStatement 범위를 사용해
 *   quick-fix가 호출 전체 라인을 안전하게 삭제할 수 있게 함.
 */
export function checkConsoleCall(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.consoleCall) return;
  if (!ts.isCallExpression(node)) return;
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return;
  if (!ts.isIdentifier(expr.expression)) return;
  if (expr.expression.text !== "console") return;

  const methodName = expr.name.text;
  const allowed = ctx.config.consoleMethods ?? ["log"];
  if (!allowed.includes(methodName)) return;

  // 부모 ExpressionStatement(있으면)를 범위로 사용 → 세미콜론까지 포함, 다중 라인 처리
  const target: ts.Node =
    node.parent && ts.isExpressionStatement(node.parent) ? node.parent : node;

  const start = ctx.sourceFile.getLineAndCharacterOfPosition(target.getStart(ctx.sourceFile));
  const end = ctx.sourceFile.getLineAndCharacterOfPosition(target.getEnd());
  ctx.issues.push({
    ruleId: "consoleCall",
    message: `console.${methodName} 호출 남아있음`,
    filePath: ctx.filePath,
    line: start.line + 1,
    column: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
    severity: "warning",
    data: { method: methodName, isStatement: target !== node },
  });
}
