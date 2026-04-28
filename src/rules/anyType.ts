import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 명시적 `any` 타입 사용 탐지.
 * 노드 카인드가 AnyKeyword인 경우만 잡음 (implicit any는 타입체커 필요 → 제외).
 *
 * 위치별 메시지:
 *   - 타입 단언:     `as any` / `<any>x` / `satisfies any`
 *   - 제네릭 인자:   `Array<any>`, `Record<string, any>`, `Promise<any>`
 *   - 일반 위치:     변수/파라미터/리턴/프로퍼티 타입
 */
export function checkAnyType(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.anyType) return;
  if (node.kind !== ts.SyntaxKind.AnyKeyword) return;

  pushIssue(ctx, "anyType", node, describeAnyLocation(node));
}

function describeAnyLocation(node: ts.Node): string {
  // 부모 체인을 따라 가장 가까운 의미 있는 컨테이너를 찾음
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (ts.isAsExpression(cur) || ts.isTypeAssertionExpression(cur)) {
      return "any 타입 단언 (as any)";
    }
    if (ts.isSatisfiesExpression(cur)) {
      return "any satisfies 표현식";
    }
    if (ts.isTypeReferenceNode(cur)) {
      // Array<any> / Record<string, any> / Promise<any> 같은 제네릭 인자 위치
      const name = ts.isIdentifier(cur.typeName) ? cur.typeName.text : "<generic>";
      return `제네릭 인자에 any 사용 (${name}<...any...>)`;
    }
    if (ts.isParameter(cur)) return "파라미터 타입에 any 사용";
    if (ts.isPropertySignature(cur) || ts.isPropertyDeclaration(cur)) {
      return "프로퍼티 타입에 any 사용";
    }
    if (ts.isVariableDeclaration(cur)) return "변수 타입에 any 사용";
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isMethodDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur)
    ) {
      // 함수 선언 노드까지 도달했다면 리턴 타입 자리
      return "리턴 타입에 any 사용";
    }
    cur = cur.parent;
  }
  return "명시적 any 타입 사용";
}
