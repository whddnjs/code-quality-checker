import * as ts from "typescript";
import { RuleContext, pushIssue } from "../types";

function isSpecFile(filePath: string): boolean {
  return /\.spec\.tsx?$/.test(filePath);
}

/**
 * 사용되지 않는 변수 탐지. 단일 파일 분석.
 *
 * 대상:
 *   - `let`/`const`/`var` 단일 선언: `const x = 1;`
 *   - 구조분해 바인딩의 개별 요소: `const { a, b } = obj;`, `const [a, b] = arr;`
 *
 * 제외:
 *   - 모듈 최상위 `export` 선언 (다른 파일에서 사용 가능)
 *   - `declare` modifier
 *   - rest 요소 (`const { a, ...rest } = x`)의 rest 자체
 *   - **rest가 있는 구조분해의 다른 단순 바인딩**: `const { ITEMS, ...rest } = obj` 같은
 *     "특정 필드를 빼고 나머지를 받는" 패턴은 의도적 제외이므로 ITEMS를 flag하지 않음.
 *
 * 사용 판정은 unusedImport와 동일한 방식:
 *   파일 전체에서 선언 위치가 아닌 Identifier 출현 수집 → 선언 이름과 대조.
 *   (파일 단위 정밀도. 함수 스코프별 shadowing은 무시 — false negative 허용.)
 */
export function checkUnusedVariables(sourceFile: ts.SourceFile, ctx: RuleContext): void {
  if (!ctx.config.unusedVariable) return;

  // spec 파일은 기본 제외 (테스트에서 선언만 하고 assert로만 쓰거나, 모의 변수를 의도적으로 두는 경우가 흔함).
  // 상세 옵션을 켰을 때만 포함.
  if (!ctx.config.unusedVariableIncludeSpec && isSpecFile(ctx.filePath)) return;

  type Declared = {
    name: string;
    nameNode: ts.Identifier;
    /** 단일 변수 선언 전체(`const x = 1;`) — 전체 삭제 가능한 경우에만 세팅 */
    variableStatement?: ts.VariableStatement;
    /** 구조분해 요소(`{ a, b }` 안의 하나) */
    bindingElement?: ts.BindingElement;
  };

  const declared: Declared[] = [];
  const declNameNodes = new Set<ts.Identifier>();

  const walkDecls = (node: ts.Node): void => {
    if (ts.isVariableStatement(node)) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      if (
        modifiers?.some(
          (m) =>
            m.kind === ts.SyntaxKind.ExportKeyword ||
            m.kind === ts.SyntaxKind.DeclareKeyword
        )
      ) {
        // export/declare는 건드리지 않음
        ts.forEachChild(node, walkDecls);
        return;
      }

      for (const decl of node.declarationList.declarations) {
        collectPattern(decl.name, node, /*topLevelSimpleStatement*/ node.declarationList.declarations.length === 1);
      }
    }
    ts.forEachChild(node, walkDecls);
  };

  function collectPattern(
    pattern: ts.BindingName,
    stmt: ts.VariableStatement,
    isSoleDecl: boolean,
    parentBindingElement?: ts.BindingElement
  ): void {
    if (ts.isIdentifier(pattern)) {
      // 언더스코어로 시작하는 이름은 의도적 미사용 관례 → 제외
      if (pattern.text.startsWith("_")) return;

      declared.push({
        name: pattern.text,
        nameNode: pattern,
        variableStatement: !parentBindingElement && isSoleDecl ? stmt : undefined,
        bindingElement: parentBindingElement,
      });
      declNameNodes.add(pattern);
      return;
    }
    if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
      // rest가 있는 패턴의 다른 바인딩은 "의도적 제외" 패턴으로 간주.
      // 예: `const { ITEMS, ...rest } = obj` — ITEMS는 빼고 rest만 쓰려는 의도.
      const hasRest = pattern.elements.some(
        (el) => !ts.isOmittedExpression(el) && !!el.dotDotDotToken
      );

      for (const el of pattern.elements) {
        if (ts.isOmittedExpression(el)) continue;
        // rest 요소(`...rest`) 자체는 항상 스킵 — 구조적으로 필요
        if (el.dotDotDotToken) continue;
        // rest가 존재하면 이 레벨의 단순 Identifier 바인딩은 의도적 제외로 보고 스킵.
        // 중첩된 바인딩 패턴(`outer: { inner }`)은 그대로 재귀해서 안쪽은 검사.
        if (hasRest && ts.isIdentifier(el.name)) continue;
        collectPattern(el.name, stmt, false, el);
      }
    }
  }

  walkDecls(sourceFile);

  if (declared.length === 0) return;

  // 사용된 이름 수집 (선언 위치 제외)
  const used = new Set<string>();

  const walkUsages = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !declNameNodes.has(node)) {
      const parent = node.parent;
      const isDeclarationPosition =
        // 변수/함수/클래스/타입/enum 등 선언 이름
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
        // 멤버/속성/메소드 이름 (선언)
        (ts.isPropertySignature(parent) && parent.name === node) ||
        (ts.isPropertyDeclaration(parent) && parent.name === node) ||
        (ts.isMethodSignature(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
        (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        // 참조가 아닌 "이름"인 위치
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isQualifiedName(parent) && parent.right === node) ||
        (ts.isJsxAttribute(parent) && parent.name === node) ||
        // 구조분해/import/export에서 "로컬 이름 선언" 및 "property 키" 양쪽 모두 배제
        (ts.isBindingElement(parent) &&
          (parent.name === node || parent.propertyName === node)) ||
        (ts.isImportSpecifier(parent) &&
          (parent.name === node || parent.propertyName === node)) ||
        (ts.isImportClause(parent) && parent.name === node) ||
        (ts.isNamespaceImport(parent) && parent.name === node) ||
        // ExportSpecifier:
        //   `export { foo }`       → .name = foo (로컬 사용 → 배제 X)
        //   `export { foo as bar }` → .propertyName = foo (로컬 사용 → 배제 X),
        //                            .name = bar (외부 이름 → 배제 O)
        (ts.isExportSpecifier(parent) &&
          parent.propertyName !== undefined &&
          parent.name === node);

      if (!isDeclarationPosition) {
        used.add(node.text);
      }
    }
    // `{ x }` shorthand property는 x를 읽는 것 → 사용
    if (ts.isShorthandPropertyAssignment(node)) {
      used.add(node.name.text);
    }
    // JSX 태그 이름
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
        "unusedVariable",
        d.nameNode,
        `사용되지 않는 변수: ${d.name}`,
        "warning",
        { variableName: d.name }
      );
    }
  }
}
