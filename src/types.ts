import * as ts from "typescript";

export type RuleId =
  | "emptyMethod"
  | "unusedImport"
  | "unusedVariable"
  | "unusedFunction"
  | "todoComment"
  | "consoleCall"
  | "smallSwitch"
  | "emptyCatch"
  | "anyType"
  | "paramCount"
  | "functionLength"
  | "nestingDepth"
  | "mergeConflict"
  | "unusedFile";

export interface Issue {
  ruleId: RuleId;
  message: string;
  filePath: string;
  line: number; // 1-based
  column: number; // 1-based
  endLine: number;
  endColumn: number;
  severity: "info" | "warning" | "error";
  /** quick-fix 등에서 사용되는 추가 메타데이터 (예: unusedImport의 import 이름) */
  data?: Record<string, unknown>;
}

export interface RuleConfig {
  emptyMethod: boolean;
  /** true일 때 콜백/생성자/getter/setter도 빈 메소드 검사 대상에 포함 */
  emptyMethodIncludeAnonymous: boolean;
  /** true일 때 본문이 비어있어도 안에 주석이 있으면 검사에서 제외 (상속 훅 등 의도된 빈 본문) */
  emptyMethodIgnoreCommented: boolean;
  unusedImport: boolean;
  unusedVariable: boolean;
  /** true면 *.spec.ts / *.spec.tsx 파일도 unusedVariable 검사 대상에 포함. 기본 false. */
  unusedVariableIncludeSpec: boolean;
  unusedFunction: boolean;
  todoComment: boolean;
  consoleCall: boolean;
  smallSwitch: boolean;
  emptyCatch: boolean;
  /** true일 때 빈 catch 블록 안에 주석이 있으면 검사에서 제외 (의도적 에러 무시 표현) */
  emptyCatchIgnoreCommented: boolean;
  anyType: boolean;
  paramCount: boolean;
  functionLength: boolean;
  nestingDepth: boolean;
  mergeConflict: boolean;
  unusedFile: boolean;
  /** consoleCall이 켜졌을 때 잡을 console 메소드 목록. 기본 ["log"]. */
  consoleMethods: string[];
}

export interface Thresholds {
  paramCount: number;
  functionLength: number;
  nestingDepth: number;
}

export interface RuleContext {
  filePath: string;
  sourceFile: ts.SourceFile;
  config: RuleConfig;
  thresholds: Thresholds;
  issues: Issue[];
}

export function pushIssue(
  ctx: RuleContext,
  ruleId: RuleId,
  node: ts.Node,
  message: string,
  severity: Issue["severity"] = "warning",
  data?: Record<string, unknown>
): void {
  const { sourceFile } = ctx;
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  ctx.issues.push({
    ruleId,
    message,
    filePath: ctx.filePath,
    line: start.line + 1,
    column: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
    severity,
    data,
  });
}
