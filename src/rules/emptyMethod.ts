import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 빈 메소드/함수 본문 탐지.
 *
 * 기본 동작 (emptyMethodIncludeAnonymous=false):
 *   - 이름이 명시된 함수만 검사 → FunctionDeclaration, MethodDeclaration
 *   - 콜백/익명 함수, 생성자, getter/setter는 의도적으로 비워두는 경우가 흔하므로 제외
 *
 * 상세 옵션 (emptyMethodIncludeAnonymous=true):
 *   - 추가로 ConstructorDeclaration, GetAccessor, SetAccessor,
 *     FunctionExpression, ArrowFunction까지 검사
 *
 * 상세 옵션 (emptyMethodIgnoreCommented=true):
 *   - 본문에 주석(`//` 또는 `/* *\/`)이 들어있으면 검사 제외.
 *     상속 훅(`afterInitForm() { // 자식에서 override 용 }`) 같은 의도된 빈 본문을 봐주기 위함.
 *
 * 공통 제외:
 *   - abstract / declare modifier
 *   - body가 없는 오버로드 시그니처
 */
export function checkEmptyMethod(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.emptyMethod) return;

  const includeAnonymous = ctx.config.emptyMethodIncludeAnonymous;

  // 항상 검사: 이름 있는 함수/메소드
  const isNamed =
    (ts.isFunctionDeclaration(node) && !!node.name) ||
    (ts.isMethodDeclaration(node) && !!node.name);

  // 옵션 시 추가 검사: 익명/특수
  const isAnonymousLike =
    includeAnonymous &&
    (ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node));

  if (!isNamed && !isAnonymousLike) return;

  // abstract/declare 제외
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (
    modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AbstractKeyword || m.kind === ts.SyntaxKind.DeclareKeyword
    )
  ) {
    return;
  }

  const body = (node as ts.FunctionLikeDeclaration).body;
  if (!body) return; // 오버로드 시그니처 제외
  if (!ts.isBlock(body)) return; // arrow expression body는 비어있을 수 없음

  if (body.statements.length === 0) {
    // 옵션: 본문에 주석이 있으면 의도된 빈 본문으로 보고 건너뜀
    if (ctx.config.emptyMethodIgnoreCommented && hasCommentInsideBody(body, ctx.sourceFile)) {
      return;
    }
    pushIssue(ctx, "emptyMethod", node, "빈 함수/메소드 본문");
  }
}

/**
 * 빈 Block의 `{` 와 `}` 사이에 주석 trivia가 하나라도 있는지 확인.
 * statements가 비어있다는 전제이므로 그 사이엔 공백/주석만 존재 가능.
 */
function hasCommentInsideBody(body: ts.Block, sourceFile: ts.SourceFile): boolean {
  const open = body.getStart(sourceFile) + 1; // `{` 다음 위치
  const close = body.getEnd() - 1; // `}` 이전 위치
  if (close <= open) return false;
  const inner = sourceFile.text.substring(open, close);
  return /\/\/|\/\*/.test(inner);
}
