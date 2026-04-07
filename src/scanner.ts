import * as fs from "fs";
import * as ts from "typescript";
import { Issue, RuleConfig, RuleContext, Thresholds } from "./types";
import { runRules } from "./rules";
import { collectImportsForFile, computeUnusedFileIssues } from "./rules/unusedFile";

export interface ScanOptions {
  files: string[];
  config: RuleConfig;
  thresholds: Thresholds;
  onProgress?: (scanned: number, total: number) => void;
}

export interface ScanResult {
  issues: Issue[];
  fileCount: number;
  durationMs: number;
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const started = Date.now();
  const issues: Issue[] = [];
  const { files, config, thresholds, onProgress } = options;

  // cross-file 규칙용 데이터: 파일 → import specifier 목록
  const importGraph: Map<string, string[]> = new Map();

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    try {
      const text = await fs.promises.readFile(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        /*setParentNodes*/ true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const ctx: RuleContext = {
        filePath,
        sourceFile,
        config,
        thresholds,
        issues,
      };
      runRules(ctx);

      // cross-file 규칙이 켜져 있으면 import 수집
      if (config.unusedFile) {
        importGraph.set(filePath, collectImportsForFile(sourceFile));
      }
    } catch (err) {
      // 파싱 실패는 조용히 건너뜀 (개별 파일 에러가 전체 스캔을 막지 않도록)
    }
    onProgress?.(i + 1, files.length);
  }

  // 모든 파일 스캔 후 cross-file 분석
  if (config.unusedFile) {
    const crossIssues = computeUnusedFileIssues(files, importGraph);
    issues.push(...crossIssues);
  }

  return {
    issues,
    fileCount: files.length,
    durationMs: Date.now() - started,
  };
}
