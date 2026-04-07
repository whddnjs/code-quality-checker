import { RuleId } from "./types";

const RULE_LABELS: Record<RuleId, string> = {
  emptyMethod: "empty-method",
  unusedImport: "unused-import",
  unusedVariable: "unused-variable",
  unusedFunction: "unused-function",
  todoComment: "todo-comment",
  consoleCall: "console-call",
  smallSwitch: "small-switch",
  emptyCatch: "empty-catch",
  anyType: "any-type",
  paramCount: "param-count",
  functionLength: "function-length",
  nestingDepth: "nesting-depth",
  mergeConflict: "merge-conflict",
  unusedFile: "unused-file",
};

export function ruleLabel(id: RuleId): string {
  return RULE_LABELS[id];
}
