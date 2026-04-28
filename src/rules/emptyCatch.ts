import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 빈 catch 블록 탐지. 에러 무시 방지.
 *
 * 상세 옵션 (emptyCatchIgnoreCommented=true):
 *   본문이 비어있어도 안에 주석이 있으면 검사 제외. `catch { /* 의도적 무시 *\/ }` 같은
 *   "이 에러는 일부러 삼킨다"는 의사 표현이 있는 경우를 봐주기 위함.
 */
export function checkEmptyCatch(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.emptyCatch) return;
  if (!ts.isCatchClause(node)) return;
  if (node.block.statements.length === 0) {
    if (ctx.config.emptyCatchIgnoreCommented && hasCommentInsideBlock(node.block, ctx.sourceFile)) {
      return;
    }
    pushIssue(ctx, "emptyCatch", node, "빈 catch 블록 — 에러를 조용히 삼키고 있음");
  }
}

function hasCommentInsideBlock(block: ts.Block, sourceFile: ts.SourceFile): boolean {
  const open = block.getStart(sourceFile) + 1;
  const close = block.getEnd() - 1;
  if (close <= open) return false;
  const inner = sourceFile.text.substring(open, close);
  return /\/\/|\/\*/.test(inner);
}
