import * as ts from "typescript";
import { RuleContext } from "../types";
import { checkEmptyMethod } from "./emptyMethod";
import { checkUnusedImports } from "./unusedImport";
import { checkUnusedVariables } from "./unusedVariable";
import { checkUnusedFunctions } from "./unusedFunction";
import { checkTodoComments, checkConsoleCall } from "./todoConsole";
import { checkSmallSwitch } from "./smallSwitch";
import { checkEmptyCatch } from "./emptyCatch";
import { checkAnyType } from "./anyType";
import { checkFunctionMetrics } from "./functionMetrics";
import { checkNestingDepth } from "./nestingDepth";
import { checkMergeConflict } from "./mergeConflict";

/**
 * 한 파일에 대해 모든 규칙을 단일 AST 순회로 실행.
 * 파일 단위 검사(unusedImport, todoComment)는 순회 전후에 별도 호출.
 */
export function runRules(ctx: RuleContext): void {
  const { sourceFile } = ctx;

  // 파일 단위 검사 (AST 전체/텍스트 기반)
  checkUnusedImports(sourceFile, ctx);
  checkUnusedVariables(sourceFile, ctx);
  checkUnusedFunctions(sourceFile, ctx);
  checkTodoComments(sourceFile, ctx);
  checkMergeConflict(sourceFile, ctx);

  // 노드 단위 검사 - 단일 순회
  const visit = (node: ts.Node): void => {
    checkEmptyMethod(node, ctx);
    checkConsoleCall(node, ctx);
    checkSmallSwitch(node, ctx);
    checkEmptyCatch(node, ctx);
    checkAnyType(node, ctx);
    checkFunctionMetrics(node, ctx);
    checkNestingDepth(node, ctx);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}
