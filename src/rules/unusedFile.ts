import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import { Issue } from "../types";

/**
 * 사용되지 않는 파일 탐지 (cross-file).
 *
 * 판정:
 *   스캔 대상 파일 중, 다른 스캔 대상 파일에서 상대경로 import로 참조되지 않는 파일.
 *
 * 엔트리 포인트로 취급해 제외하는 파일:
 *   - `index.ts` / `index.tsx`      (모듈 엔트리)
 *   - `main.ts` / `main.tsx`        (앱 엔트리)
 *   - `*.spec.ts` / `*.spec.tsx`    (테스트 - 보통 다른 곳에서 import되지 않음)
 *   - `*.test.ts` / `*.test.tsx`    (테스트)
 *   - `*.d.ts`                      (전역 타입 선언)
 *   - `*.module.ts` (Angular/NestJS 모듈 루트)
 *
 * 제한:
 *   - 비-상대 경로(`react`, `@scope/foo`, tsconfig paths alias)는 해석하지 않음.
 *   - tsconfig.json의 paths 매핑 미지원.
 *   - 문자열 리터럴로 참조되는 파일(Angular templateUrl 등)은 감지하지 못함.
 *   → 이런 경우는 false positive 여지가 있으므로 보수적으로 엔트리 패턴을 늘려 사용.
 */

const ENTRY_PATTERNS: RegExp[] = [
  /(?:^|[\\/])index\.tsx?$/,
  /(?:^|[\\/])main\.tsx?$/,
  /\.spec\.tsx?$/,
  /\.test\.tsx?$/,
  /\.d\.ts$/,
  /\.module\.ts$/,
];

export function isEntryFile(filePath: string): boolean {
  return ENTRY_PATTERNS.some((re) => re.test(filePath));
}

/**
 * 한 파일의 모든 import/require/dynamic-import 모듈 specifier 수집.
 */
export function collectImportsForFile(sf: ts.SourceFile): string[] {
  const specs: string[] = [];
  const visit = (node: ts.Node): void => {
    // 정적 import / export ... from
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    }
    // 동적 import('...')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push((node.arguments[0] as ts.StringLiteral).text);
    }
    // CommonJS require('...')
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs;
}

/**
 * 스캔된 파일 중 첫 번째에서 부모 디렉토리를 거슬러 올라가며 tsconfig.json을 찾아 로드.
 * extends 체인과 paths alias가 있는 경우 ts.parseJsonConfigFileContent가 자동으로 해석.
 */
function loadCompilerOptions(firstFile: string): ts.CompilerOptions {
  let dir = path.dirname(path.resolve(firstFile));
  while (dir) {
    const configPath = path.join(dir, "tsconfig.json");
    if (fs.existsSync(configPath)) {
      try {
        const raw = ts.readConfigFile(configPath, ts.sys.readFile);
        if (!raw.error && raw.config) {
          const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, dir);
          return parsed.options;
        }
      } catch {
        /* 파싱 실패 시 다음 parent로 계속 */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

/**
 * ts.resolveModuleName으로 import specifier를 실제 파일 경로로 해석.
 * 상대경로/baseUrl/paths alias/확장자 생략/index 생략/node_modules를 모두 공식 로직으로 처리.
 * node_modules(외부 라이브러리)는 null 반환.
 */
function resolveImport(
  fromFile: string,
  spec: string,
  options: ts.CompilerOptions
): string | null {
  const result = ts.resolveModuleName(spec, fromFile, options, ts.sys);
  const rm = result.resolvedModule;
  if (!rm) return null;
  if (rm.isExternalLibraryImport) return null;
  return path.resolve(rm.resolvedFileName);
}

/**
 * 모든 스캔 파일에 대해 미사용 파일을 찾아 Issue 배열 반환.
 */
export function computeUnusedFileIssues(
  allFiles: string[],
  importGraph: Map<string, string[]>
): Issue[] {
  if (allFiles.length === 0) return [];

  const absAll = allFiles.map((f) => path.resolve(f));
  const absFileSet = new Set(absAll);

  // 스캔된 파일들 근처의 tsconfig.json을 한 번 로드해 컴파일러 옵션(paths/baseUrl 포함) 확보
  const options = loadCompilerOptions(absAll[0]);

  const referenced = new Set<string>();
  for (const [fromFile, specs] of importGraph) {
    const fromAbs = path.resolve(fromFile);
    for (const spec of specs) {
      const resolved = resolveImport(fromAbs, spec, options);
      if (resolved && absFileSet.has(resolved)) {
        referenced.add(resolved);
      }
    }
  }

  const issues: Issue[] = [];
  for (let i = 0; i < allFiles.length; i++) {
    const origPath = allFiles[i];
    const absPath = absAll[i];
    if (referenced.has(absPath)) continue;
    if (isEntryFile(absPath)) continue;
    issues.push({
      ruleId: "unusedFile",
      message: "이 파일을 import하는 다른 파일이 없음",
      filePath: origPath,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      severity: "info",
    });
  }
  return issues;
}
