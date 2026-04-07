import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

interface ImportBinding {
  name: string;
  node: ts.Node;
}

/**
 * 사용되지 않는 import 탐지.
 * 단일 파일 분석: import 식별자 수집 → 파일 나머지 영역의 Identifier/JSX 이름 출현 여부 확인.
 */
export function checkUnusedImports(sourceFile: ts.SourceFile, ctx: RuleContext): void {
  if (!ctx.config.unusedImport) return;

  const bindings: ImportBinding[] = [];
  const importRanges: Array<{ pos: number; end: number }> = [];

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    importRanges.push({ pos: stmt.getStart(sourceFile), end: stmt.getEnd() });

    const clause = stmt.importClause;
    // default import: import Foo from "..."
    if (clause.name) {
      bindings.push({ name: clause.name.text, node: clause.name });
    }
    if (clause.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        // import * as Foo from "..."
        bindings.push({ name: clause.namedBindings.name.text, node: clause.namedBindings.name });
      } else {
        // import { a, b as c } from "..."
        for (const el of clause.namedBindings.elements) {
          bindings.push({ name: el.name.text, node: el.name });
        }
      }
    }
  }

  if (bindings.length === 0) return;

  // 사용 식별자 수집 (import 구문 범위는 제외)
  const used = new Set<string>();
  const inImportRange = (pos: number): boolean =>
    importRanges.some((r) => pos >= r.pos && pos < r.end);

  const visit = (node: ts.Node): void => {
    // Identifier 참조
    if (ts.isIdentifier(node) && !inImportRange(node.getStart(sourceFile))) {
      // 선언부에서의 이름은 사용이 아님 (변수/함수/클래스 이름 자체)
      const parent = node.parent;
      const isDeclarationName =
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isFunctionDeclaration(parent) && parent.name === node) ||
        (ts.isClassDeclaration(parent) && parent.name === node) ||
        (ts.isParameter(parent) && parent.name === node) ||
        (ts.isBindingElement(parent) && parent.name === node) ||
        (ts.isPropertySignature(parent) && parent.name === node) ||
        (ts.isPropertyDeclaration(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        // PropertyAccessExpression의 오른쪽(.name)은 import 이름 사용이 아님
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        // QualifiedName의 오른쪽도 동일
        (ts.isQualifiedName(parent) && parent.right === node);
      if (!isDeclarationName) {
        used.add(node.text);
      }
    }
    // JSX 엘리먼트 태그 이름 (ex: <Foo />) — Identifier로 처리되지만 안전하게 한 번 더
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) used.add(tag.text);
      else if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression)) {
        used.add(tag.expression.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  for (const b of bindings) {
    if (!used.has(b.name)) {
      pushIssue(
        ctx,
        "unusedImport",
        b.node,
        `사용되지 않는 import: ${b.name}`,
        "warning",
        { importName: b.name }
      );
    }
  }
}
