import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 빈 catch 블록 탐지. 에러 무시 방지.
 */
export function checkEmptyCatch(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.emptyCatch) return;
  if (!ts.isCatchClause(node)) return;
  if (node.block.statements.length === 0) {
    pushIssue(ctx, "emptyCatch", node, "빈 catch 블록 — 에러를 조용히 삼키고 있음");
  }
}
