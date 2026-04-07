import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

type FnLike =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.ConstructorDeclaration;

function isFnLike(node: ts.Node): node is FnLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function fnName(node: FnLike): string {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
    return ts.isIdentifier(node.name) ? node.name.text : "<computed>";
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  return "<anonymous>";
}

/**
 * 함수 파라미터 개수 / 함수 라인 수 검사.
 */
export function checkFunctionMetrics(node: ts.Node, ctx: RuleContext): void {
  if (!isFnLike(node)) return;

  if (ctx.config.paramCount) {
    const limit = ctx.thresholds.paramCount;
    if (node.parameters.length > limit) {
      pushIssue(
        ctx,
        "paramCount",
        node,
        `${fnName(node)}: 파라미터 ${node.parameters.length}개 (임계값 ${limit})`
      );
    }
  }

  if (ctx.config.functionLength && node.body) {
    const limit = ctx.thresholds.functionLength;
    const start = ctx.sourceFile.getLineAndCharacterOfPosition(node.body.getStart(ctx.sourceFile)).line;
    const end = ctx.sourceFile.getLineAndCharacterOfPosition(node.body.getEnd()).line;
    const lines = end - start + 1;
    if (lines > limit) {
      pushIssue(
        ctx,
        "functionLength",
        node,
        `${fnName(node)}: ${lines}줄 (임계값 ${limit})`
      );
    }
  }
}
