import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 명시적 `any` 타입 사용 탐지.
 * 노드 카인드가 AnyKeyword인 경우만 잡음 (implicit any는 타입체커 필요 → 제외).
 */
export function checkAnyType(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.anyType) return;
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    pushIssue(ctx, "anyType", node, "명시적 any 타입 사용");
  }
}
