import * as ts from "typescript";
import { RuleContext } from "../types";

/**
 * Git merge conflict 마커 탐지.
 * 라인 시작 위치에서 `<<<<<<< `, `=======`, `>>>>>>> ` 패턴을 검사.
 *
 * "개발 서버는 멀쩡한데 코드 열어보면 에러" 같은 상황 — 충돌 마커가 코드에 남아
 * 파서가 통과하면서도 빌드/런타임에서 깨지는 경우를 빠르게 잡기 위함.
 */
export function checkMergeConflict(sourceFile: ts.SourceFile, ctx: RuleContext): void {
  if (!ctx.config.mergeConflict) return;

  const text = sourceFile.getFullText();
  const lines = text.split(/\r?\n/);
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let marker: string | undefined;
    if (line.startsWith("<<<<<<< ") || line === "<<<<<<<") marker = "<<<<<<<";
    else if (line === "=======" || line.startsWith("======= ")) marker = "=======";
    else if (line.startsWith(">>>>>>> ") || line === ">>>>>>>") marker = ">>>>>>>";

    if (marker) {
      ctx.issues.push({
        ruleId: "mergeConflict",
        message: `Git merge conflict 마커 ${marker} 남아있음`,
        filePath: ctx.filePath,
        line: i + 1,
        column: 1,
        endLine: i + 1,
        endColumn: line.length + 1,
        severity: "error",
      });
    }
    offset += line.length + 1;
  }
}
