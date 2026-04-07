import * as vscode from "vscode";
import * as ts from "typescript";
import { Issue, RuleId } from "./types";

export const FIXABLE_RULES: ReadonlySet<RuleId> = new Set<RuleId>([
  "unusedImport",
  "unusedVariable",
  "unusedFunction",
  "todoComment",
  "consoleCall",
]);

export function isFixable(ruleId: RuleId): boolean {
  return FIXABLE_RULES.has(ruleId);
}

export type FixResult = "success" | "already-fixed" | "failed";

/**
 * 단일 이슈에 대한 quick-fix 적용.
 *
 * 반환값:
 *  - "success": 실제로 편집 적용됨
 *  - "already-fixed": 현재 파일에 대상이 더 이상 없음 (이전 fix에서 이미 정리됨 — 조용히 성공 처리)
 *  - "failed": 진짜 실패 (알림 띄움)
 *
 * 중요: 이슈의 line/column은 스캔 당시 값이라 stale할 수 있음.
 *       모든 fix는 현재 문서를 다시 파싱해 "내용 기반"으로 실제 위치를 재탐색한 뒤 편집한다.
 */
export async function applyFix(issue: Issue): Promise<FixResult> {
  const uri = vscode.Uri.file(issue.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();

  let status: "ok" | "not-found" | "invalid";
  switch (issue.ruleId) {
    case "unusedImport": {
      const importName =
        (issue.data?.importName as string | undefined) ??
        parseImportNameFromMessage(issue.message);
      if (!importName) return "failed";
      status = buildUnusedImportEdit(doc, edit, importName, issue.line);
      break;
    }
    case "unusedVariable": {
      const variableName =
        (issue.data?.variableName as string | undefined) ??
        parseVariableNameFromMessage(issue.message);
      if (!variableName) return "failed";
      status = buildUnusedVariableEdit(doc, edit, variableName, issue.line);
      break;
    }
    case "unusedFunction": {
      const functionName =
        (issue.data?.functionName as string | undefined) ??
        parseFunctionNameFromMessage(issue.message);
      if (!functionName) return "failed";
      status = buildUnusedFunctionEdit(doc, edit, functionName, issue.line);
      break;
    }
    case "todoComment":
      status = buildTodoDeleteEdit(doc, edit, issue.line);
      break;
    case "consoleCall":
      status = buildConsoleDeleteEdit(doc, edit, issue.line, issue.data?.method as string | undefined);
      break;
    default:
      return "failed";
  }

  if (status === "not-found") return "already-fixed";
  if (status === "invalid") return "failed";

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) return "failed";
  try {
    await doc.save();
  } catch {
    /* 저장 실패는 무시 (수정 자체는 성공) */
  }
  return "success";
}

function parseImportNameFromMessage(msg: string): string | undefined {
  const m = /사용되지 않는 import:\s*(\S+)/.exec(msg);
  return m?.[1];
}

function parseVariableNameFromMessage(msg: string): string | undefined {
  const m = /사용되지 않는 변수:\s*(\S+)/.exec(msg);
  return m?.[1];
}

function parseFunctionNameFromMessage(msg: string): string | undefined {
  const m = /사용되지 않는 함수:\s*(\S+)/.exec(msg);
  return m?.[1];
}

function parseSource(doc: vscode.TextDocument): ts.SourceFile {
  return ts.createSourceFile(
    doc.fileName,
    doc.getText(),
    ts.ScriptTarget.Latest,
    true,
    doc.fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

/* ────────────────────────────────────────────────────────────────
 * TODO / console quick-fix: 내용 기반 재탐색
 * ──────────────────────────────────────────────────────────────── */

/**
 * 현재 문서에서 hint 라인에 가장 가까운 TODO/FIXME/XXX/HACK 주석을 찾아 삭제.
 * 블록 주석이 여러 줄이면 주석 전체 라인을 삭제.
 */
type BuildStatus = "ok" | "not-found" | "invalid";

function buildTodoDeleteEdit(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  hintLine: number
): BuildStatus {
  const sf = parseSource(doc);
  const text = sf.getFullText();
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /*skipTrivia*/ false,
    sf.languageVariant,
    text
  );

  type Candidate = { startLine: number; endLine: number };
  const candidates: Candidate[] = [];
  const TODO_RE = /\b(TODO|FIXME|XXX|HACK)\b/;

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const start = scanner.getTokenStart();
      const end = scanner.getTokenEnd();
      if (TODO_RE.test(text.slice(start, end))) {
        const s = sf.getLineAndCharacterOfPosition(start).line;
        const e = sf.getLineAndCharacterOfPosition(end).line;
        candidates.push({ startLine: s, endLine: e });
      }
    }
    token = scanner.scan();
  }

  if (candidates.length === 0) return "not-found";
  const target = nearest(candidates, hintLine - 1, (c) => c.startLine);

  deleteLineRange(doc, edit, target.startLine, target.endLine);
  return "ok";
}

/**
 * 현재 문서에서 hint 라인에 가장 가까운 `console.<method>(…)` 호출문을 찾아 삭제.
 * method가 주어지면 그 메소드만 매칭. 부모 ExpressionStatement 범위를 사용해
 * 다중 라인 호출도 한 번에 삭제.
 */
function buildConsoleDeleteEdit(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  hintLine: number,
  method: string | undefined
): BuildStatus {
  const sf = parseSource(doc);

  type Candidate = { startLine: number; endLine: number };
  const candidates: Candidate[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const ex = node.expression;
      if (
        ts.isPropertyAccessExpression(ex) &&
        ts.isIdentifier(ex.expression) &&
        ex.expression.text === "console" &&
        (!method || ex.name.text === method)
      ) {
        const target: ts.Node =
          node.parent && ts.isExpressionStatement(node.parent) ? node.parent : node;
        const s = sf.getLineAndCharacterOfPosition(target.getStart(sf)).line;
        const e = sf.getLineAndCharacterOfPosition(target.getEnd()).line;
        candidates.push({ startLine: s, endLine: e });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (candidates.length === 0) return "not-found";
  const target = nearest(candidates, hintLine - 1, (c) => c.startLine);
  deleteLineRange(doc, edit, target.startLine, target.endLine);
  return "ok";
}

function nearest<T>(items: T[], hint: number, keyFn: (t: T) => number): T {
  return items.reduce((best, c) =>
    Math.abs(keyFn(c) - hint) < Math.abs(keyFn(best) - hint) ? c : best
  );
}

function deleteLineRange(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  startLineIdx: number,
  endLineIdx: number
): void {
  const startPos = new vscode.Position(startLineIdx, 0);
  const endPos =
    endLineIdx + 1 < doc.lineCount
      ? new vscode.Position(endLineIdx + 1, 0)
      : doc.lineAt(endLineIdx).rangeIncludingLineBreak.end;
  edit.delete(doc.uri, new vscode.Range(startPos, endPos));
}

/* ────────────────────────────────────────────────────────────────
 * unused import quick-fix
 * ──────────────────────────────────────────────────────────────── */

/**
 * 현재 문서를 파싱해 unusedImport 케이스에 맞는 가장 작은 텍스트 편집을 계산.
 * - 명명 import 1개만 남았으면 → import 문 전체 삭제
 * - 명명 import 여러개 중 하나면 → 해당 specifier + 인접 콤마만 삭제
 * - default import만 있는데 미사용이면 → import 문 전체 삭제
 * - default + 명명 함께 있을 때 default 미사용 → default 이름 + 콤마 삭제
 * - namespace import (`* as Foo`) 미사용 → import 문 전체 삭제
 */
function buildUnusedImportEdit(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  importName: string,
  hintLine: number
): BuildStatus {
  const sf = parseSource(doc);
  const text = sf.getFullText();

  type Candidate = {
    decl: ts.ImportDeclaration;
    kind: "default" | "namespace" | "named";
    specifier?: ts.ImportSpecifier;
  };
  const candidates: Candidate[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const clause = stmt.importClause;
    if (clause.name && clause.name.text === importName) {
      candidates.push({ decl: stmt, kind: "default" });
    }
    if (clause.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        if (clause.namedBindings.name.text === importName) {
          candidates.push({ decl: stmt, kind: "namespace" });
        }
      } else {
        for (const el of clause.namedBindings.elements) {
          if (el.name.text === importName) {
            candidates.push({ decl: stmt, kind: "named", specifier: el });
          }
        }
      }
    }
  }

  if (candidates.length === 0) return "not-found";

  const target = candidates.reduce((best, c) => {
    const s = sf.getLineAndCharacterOfPosition(c.decl.getStart(sf)).line + 1;
    const b = sf.getLineAndCharacterOfPosition(best.decl.getStart(sf)).line + 1;
    return Math.abs(s - hintLine) < Math.abs(b - hintLine) ? c : best;
  });

  const decl = target.decl;
  const clause = decl.importClause!;
  const hasDefault = !!clause.name;
  const namedBindings = clause.namedBindings;
  const namedCount =
    namedBindings && ts.isNamedImports(namedBindings) ? namedBindings.elements.length : 0;

  const willBeEmpty =
    (target.kind === "default" && !namedBindings) ||
    (target.kind === "namespace" && !hasDefault) ||
    (target.kind === "named" && !hasDefault && namedCount === 1);

  if (willBeEmpty) {
    deleteFullStatement(doc, edit, decl, sf);
    return "ok";
  }

  if (target.kind === "default") {
    const startOff = clause.name!.getStart(sf);
    const afterName = clause.name!.getEnd();
    const commaIdx = text.indexOf(",", afterName);
    if (commaIdx === -1) return "invalid";
    let endOff = commaIdx + 1;
    while (endOff < text.length && text[endOff] === " ") endOff++;
    edit.delete(doc.uri, new vscode.Range(doc.positionAt(startOff), doc.positionAt(endOff)));
    return "ok";
  }

  if (target.kind === "named" && target.specifier) {
    const elements = (namedBindings as ts.NamedImports).elements;
    const idx = elements.indexOf(target.specifier);
    const spec = target.specifier;
    let startOff = spec.getStart(sf);
    let endOff = spec.getEnd();
    if (idx < elements.length - 1) {
      while (endOff < text.length && (text[endOff] === " " || text[endOff] === ",")) endOff++;
    } else if (idx > 0) {
      const prev = elements[idx - 1];
      startOff = prev.getEnd();
    }
    edit.delete(doc.uri, new vscode.Range(doc.positionAt(startOff), doc.positionAt(endOff)));
    return "ok";
  }

  return "invalid";
}

function deleteFullStatement(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  decl: ts.ImportDeclaration,
  sf: ts.SourceFile
): void {
  const startLineIdx = sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line;
  const endLineIdx = sf.getLineAndCharacterOfPosition(decl.getEnd()).line;
  deleteLineRange(doc, edit, startLineIdx, endLineIdx);
}

/* ────────────────────────────────────────────────────────────────
 * unused function quick-fix
 * ──────────────────────────────────────────────────────────────── */

/**
 * 현재 문서에서 같은 이름의 FunctionDeclaration을 찾아 그 라인 범위 전체를 삭제.
 * hint 라인과 가장 가까운 후보를 선택.
 */
function buildUnusedFunctionEdit(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  fnName: string,
  hintLine: number
): BuildStatus {
  const sf = parseSource(doc);

  const candidates: { decl: ts.FunctionDeclaration; line: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.name.text === fnName
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      candidates.push({ decl: node, line });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (candidates.length === 0) return "not-found";

  const target = candidates.reduce((best, c) =>
    Math.abs(c.line - hintLine) < Math.abs(best.line - hintLine) ? c : best
  ).decl;

  const startLineIdx = sf.getLineAndCharacterOfPosition(target.getStart(sf)).line;
  const endLineIdx = sf.getLineAndCharacterOfPosition(target.getEnd()).line;
  deleteLineRange(doc, edit, startLineIdx, endLineIdx);
  return "ok";
}

/* ────────────────────────────────────────────────────────────────
 * unused variable quick-fix
 * ──────────────────────────────────────────────────────────────── */

/**
 * 현재 문서에서 이름이 일치하는 미사용 변수를 찾아 편집:
 *  - 단일 선언의 유일한 simple identifier → VariableStatement 전체 삭제
 *  - 구조분해 요소 → 해당 요소 + 인접 콤마만 삭제
 *  - 다중 선언 중 하나(`const a = 1, b = 2;`) → 해당 선언 + 콤마만 삭제
 */
function buildUnusedVariableEdit(
  doc: vscode.TextDocument,
  edit: vscode.WorkspaceEdit,
  variableName: string,
  hintLine: number
): BuildStatus {
  const sf = parseSource(doc);
  const text = sf.getFullText();

  type Target =
    | { kind: "soleSimple"; stmt: ts.VariableStatement }
    | { kind: "multiDecl"; stmt: ts.VariableStatement; decl: ts.VariableDeclaration }
    | { kind: "bindingElement"; element: ts.BindingElement; parent: ts.ObjectBindingPattern | ts.ArrayBindingPattern };

  const candidates: { target: Target; line: number }[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node)) {
      const decls = node.declarationList.declarations;
      for (const decl of decls) {
        scanPattern(decl.name, node, decl);
      }
    }
    ts.forEachChild(node, visit);
  };

  function scanPattern(
    pattern: ts.BindingName,
    stmt: ts.VariableStatement,
    decl: ts.VariableDeclaration,
    parentPattern?: ts.ObjectBindingPattern | ts.ArrayBindingPattern,
    element?: ts.BindingElement
  ): void {
    if (ts.isIdentifier(pattern)) {
      if (pattern.text !== variableName) return;
      const line = sf.getLineAndCharacterOfPosition(pattern.getStart(sf)).line + 1;
      if (element && parentPattern) {
        candidates.push({ target: { kind: "bindingElement", element, parent: parentPattern }, line });
      } else if (stmt.declarationList.declarations.length === 1) {
        candidates.push({ target: { kind: "soleSimple", stmt }, line });
      } else {
        candidates.push({ target: { kind: "multiDecl", stmt, decl }, line });
      }
      return;
    }
    if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
      for (const el of pattern.elements) {
        if (ts.isOmittedExpression(el)) continue;
        if (el.dotDotDotToken) continue;
        scanPattern(el.name, stmt, decl, pattern, el);
      }
    }
  }

  visit(sf);
  if (candidates.length === 0) return "not-found";

  const chosen = candidates.reduce((best, c) =>
    Math.abs(c.line - hintLine) < Math.abs(best.line - hintLine) ? c : best
  ).target;

  switch (chosen.kind) {
    case "soleSimple": {
      const startLineIdx = sf.getLineAndCharacterOfPosition(chosen.stmt.getStart(sf)).line;
      const endLineIdx = sf.getLineAndCharacterOfPosition(chosen.stmt.getEnd()).line;
      deleteLineRange(doc, edit, startLineIdx, endLineIdx);
      return "ok";
    }
    case "multiDecl": {
      const decls = chosen.stmt.declarationList.declarations;
      const idx = decls.indexOf(chosen.decl);
      let startOff = chosen.decl.getStart(sf);
      let endOff = chosen.decl.getEnd();
      if (idx < decls.length - 1) {
        // 뒤 콤마 + 공백 흡수
        while (endOff < text.length && (text[endOff] === "," || text[endOff] === " ")) endOff++;
      } else if (idx > 0) {
        // 마지막이면 앞 선언의 끝부터 제거
        startOff = decls[idx - 1].getEnd();
      }
      edit.delete(doc.uri, new vscode.Range(doc.positionAt(startOff), doc.positionAt(endOff)));
      return "ok";
    }
    case "bindingElement": {
      const elements = chosen.parent.elements;
      const idx = elements.indexOf(chosen.element);
      let startOff = chosen.element.getStart(sf);
      let endOff = chosen.element.getEnd();
      if (idx < elements.length - 1) {
        while (endOff < text.length && (text[endOff] === "," || text[endOff] === " ")) endOff++;
      } else if (idx > 0) {
        const prev = elements[idx - 1];
        if (ts.isOmittedExpression(prev)) {
          // 드문 케이스: 앞이 빈 슬롯이면 건드리지 않음
        } else {
          startOff = prev.getEnd();
        }
      }
      edit.delete(doc.uri, new vscode.Range(doc.positionAt(startOff), doc.positionAt(endOff)));
      return "ok";
    }
  }
}
