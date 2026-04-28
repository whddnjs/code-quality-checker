import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 함수 단위로 최대 중첩 깊이를 측정.
 * 중첩 기여 노드: if/for/forIn/forOf/while/doWhile/switch/try/catch.
 * 함수 본문 자체는 깊이 0부터 시작.
 *
 * `else if` 체인은 같은 깊이로 처리 — `if (a) {} else if (b) {} else if (c) {}`는
 * 일반적으로 같은 레벨의 분기로 인식되므로 ESLint `max-depth` 등과 동일한 정책을 따름.
 * (`IfStatement.elseStatement`가 `IfStatement`인 경우 깊이 증가 안 함)
 */
const NEST_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.CatchClause,
]);

function isFnLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

export function checkNestingDepth(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.nestingDepth) return;
  if (!isFnLike(node)) return;
  const body = (node as ts.FunctionLikeDeclaration).body;
  if (!body || !ts.isBlock(body)) return;

  let max = 0;
  const walk = (n: ts.Node, depth: number): void => {
    // 내부 함수는 별도 검사 대상이므로 건너뜀 (바깥 함수 깊이 오염 방지)
    if (n !== node && isFnLike(n)) return;
    // `else if` 체인은 같은 깊이로 처리 (parent IfStatement의 elseStatement 자리에 있는 IfStatement)
    const isElseIf =
      ts.isIfStatement(n) &&
      !!n.parent &&
      ts.isIfStatement(n.parent) &&
      n.parent.elseStatement === n;
    const nextDepth = NEST_KINDS.has(n.kind) && !isElseIf ? depth + 1 : depth;
    if (nextDepth > max) max = nextDepth;
    ts.forEachChild(n, (c) => walk(c, nextDepth));
  };
  walk(body, 0);

  const limit = ctx.thresholds.nestingDepth;
  if (max > limit) {
    pushIssue(ctx, "nestingDepth", node, `최대 중첩 깊이 ${max} (임계값 ${limit})`);
  }
}
