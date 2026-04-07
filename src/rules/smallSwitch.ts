import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * switch문에 case가 2개 이하인 경우 경고.
 * 1개 → if로, 2개 → if/else로 충분하다는 신호.
 * default는 카운트에서 제외.
 */
export function checkSmallSwitch(node: ts.Node, ctx: RuleContext): void {
  if (!ctx.config.smallSwitch) return;
  if (!ts.isSwitchStatement(node)) return;
  const caseCount = node.caseBlock.clauses.filter((c) => ts.isCaseClause(c)).length;
  if (caseCount <= 2) {
    pushIssue(
      ctx,
      "smallSwitch",
      node,
      `switch문에 case가 ${caseCount}개뿐 — if문으로 단순화 고려`
    );
  }
}
