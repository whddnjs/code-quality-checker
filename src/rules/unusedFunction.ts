import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

/**
 * 사용되지 않는 함수 선언 탐지. 단일 파일 분석.
 *
 * 대상:
 *   - top-level이든 nested든 `function foo() { ... }` 형태의 함수 선언
 *
 * 제외 (false positive 회피):
 *   - `export` modifier (다른 파일에서 사용 가능)
 *   - `declare` modifier
 *   - 이름이 `_`로 시작 (의도적 미사용 관례)
 *   - 클래스 메소드, 객체 메소드, FunctionExpression, ArrowFunction (외부에서 호출될 수 있어 보수적으로 미검사)
 *
 * 사용 판정은 unusedVariable과 동일:
 *   파일 전체에서 선언 위치가 아닌 Identifier 출현 수집 → 선언 이름과 대조.
 *   (파일 단위 정밀도. 같은 이름이 다른 곳에 있으면 사용으로 간주됨 — false negative 허용.)
 */
export function checkUnusedFunctions(sourceFile: ts.SourceFile, ctx: RuleContext): void {
  if (!ctx.config.unusedFunction) return;

  type Declared = {
    name: string;
    nameNode: ts.Identifier;
    decl: ts.FunctionDeclaration;
  };

  const declared: Declared[] = [];
  const declNameNodes = new Set<ts.Identifier>();

  const walkDecls = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const skip = modifiers?.some(
        (m) =>
          m.kind === ts.SyntaxKind.ExportKeyword ||
          m.kind === ts.SyntaxKind.DeclareKeyword ||
          m.kind === ts.SyntaxKind.DefaultKeyword
      );
      if (!skip && !node.name.text.startsWith("_")) {
        declared.push({ name: node.name.text, nameNode: node.name, decl: node });
        declNameNodes.add(node.name);
      }
    }
    ts.forEachChild(node, walkDecls);
  };
  walkDecls(sourceFile);

  if (declared.length === 0) return;

  const used = new Set<string>();

  const walkUsages = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !declNameNodes.has(node)) {
      const parent = node.parent;
      const isDeclarationPosition =
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isParameter(parent) && parent.name === node) ||
        (ts.isFunctionDeclaration(parent) && parent.name === node) ||
        (ts.isFunctionExpression(parent) && parent.name === node) ||
        (ts.isClassDeclaration(parent) && parent.name === node) ||
        (ts.isClassExpression(parent) && parent.name === node) ||
        (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
        (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
        (ts.isEnumDeclaration(parent) && parent.name === node) ||
        (ts.isEnumMember(parent) && parent.name === node) ||
        (ts.isModuleDeclaration(parent) && parent.name === node) ||
        (ts.isTypeParameterDeclaration(parent) && parent.name === node) ||
        (ts.isPropertySignature(parent) && parent.name === node) ||
        (ts.isPropertyDeclaration(parent) && parent.name === node) ||
        (ts.isMethodSignature(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
        (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isQualifiedName(parent) && parent.right === node) ||
        (ts.isJsxAttribute(parent) && parent.name === node) ||
        (ts.isBindingElement(parent) &&
          (parent.name === node || parent.propertyName === node)) ||
        (ts.isImportSpecifier(parent) &&
          (parent.name === node || parent.propertyName === node)) ||
        (ts.isImportClause(parent) && parent.name === node) ||
        (ts.isNamespaceImport(parent) && parent.name === node) ||
        (ts.isExportSpecifier(parent) &&
          parent.propertyName !== undefined &&
          parent.name === node);

      if (!isDeclarationPosition) {
        used.add(node.text);
      }
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      used.add(node.name.text);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) used.add(tag.text);
      else if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression)) {
        used.add(tag.expression.text);
      }
    }
    ts.forEachChild(node, walkUsages);
  };
  ts.forEachChild(sourceFile, walkUsages);

  for (const d of declared) {
    if (!used.has(d.name)) {
      pushIssue(
        ctx,
        "unusedFunction",
        d.nameNode,
        `사용되지 않는 함수: ${d.name}`,
        "warning",
        { functionName: d.name }
      );
    }
  }
}
