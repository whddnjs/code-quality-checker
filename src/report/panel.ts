import * as vscode from "vscode";
import * as path from "path";
import { Issue } from "../types";
import { ruleLabel } from "../diagnostics";
import { applyFix, isFixable } from "../fixes";

export interface ReportPayload {
  issues: Issue[];
  fileCount: number;
  durationMs: number;
  workspaceRoot: string;
}

export class ReportPanel {
  private static current: ReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private lastPayload: ReportPayload | undefined;

  public static createOrShow(context: vscode.ExtensionContext): ReportPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (ReportPanel.current) {
      ReportPanel.current.panel.reveal(column);
      return ReportPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      "codeQualityReport",
      "Code Quality Report",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "out", "report"))],
      }
    );
    ReportPanel.current = new ReportPanel(panel, context);
    return ReportPanel.current;
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => {
      ReportPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "openFile" && typeof msg.filePath === "string") {
        const uri = vscode.Uri.file(msg.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const line = Math.max(0, (msg.line ?? 1) - 1);
        const col = Math.max(0, (msg.column ?? 1) - 1);
        const pos = new vscode.Position(line, col);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(pos, pos);
      } else if (msg?.type === "fix" && msg.issue) {
        await this.runFixes([msg.issue as Issue]);
      } else if (msg?.type === "bulkFix" && Array.isArray(msg.issues)) {
        await this.runFixes(msg.issues as Issue[]);
      } else if (msg?.type === "ready") {
        if (this.lastPayload) this.postPayload(this.lastPayload);
      }
    });
  }

  public show(payload: ReportPayload): void {
    this.lastPayload = payload;
    this.postPayload(payload);
    this.panel.reveal();
  }

  /**
   * 여러 fix를 순차적으로 적용. 같은 파일에 대한 동시 applyEdit 경쟁 조건을 피하기 위함.
   * 호출자는 bottom-up(라인 내림차순)으로 정렬된 배열을 넘기는 것이 안전.
   */
  private async runFixes(issues: Issue[]): Promise<void> {
    // 안전: 파일별로 라인 내림차순 정렬 (앞 편집이 뒤 위치에 영향 주지 않도록)
    const sorted = [...issues].sort((a, b) => {
      if (a.filePath !== b.filePath) return a.filePath < b.filePath ? -1 : 1;
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    let success = 0;
    let alreadyFixed = 0;
    let failed = 0;
    const removedKeys = new Set<string>();
    for (const issue of sorted) {
      try {
        const result = await applyFix(issue);
        if (result === "success") {
          success++;
          removedKeys.add(issueKey(issue));
        } else if (result === "already-fixed") {
          // 이전 fix에서 이미 정리됨 — 조용히 패널에서 제거만
          alreadyFixed++;
          removedKeys.add(issueKey(issue));
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // 한 번만 패널 갱신
    if (this.lastPayload && removedKeys.size > 0) {
      this.lastPayload = {
        ...this.lastPayload,
        issues: this.lastPayload.issues.filter((i) => !removedKeys.has(issueKey(i))),
      };
      this.postPayload(this.lastPayload);
    }

    // 한 번만 결과 알림. already-fixed는 success처럼 취급(조용히 제거), failed만 경고.
    const totalOk = success + alreadyFixed;
    if (failed === 0 && totalOk > 0) {
      vscode.window.setStatusBarMessage(
        totalOk === 1 ? `수정 완료` : `${totalOk}개 수정 완료`,
        3000
      );
    } else if (totalOk > 0 && failed > 0) {
      vscode.window.showWarningMessage(`${totalOk}개 수정 / ${failed}개 실패`);
    } else if (failed > 0) {
      vscode.window.showWarningMessage(`수정 실패 (${failed}개)`);
    }
  }

  private postPayload(payload: ReportPayload): void {
    // Issue 자체가 직렬화 가능한 평문 객체 → 라벨/fixable 플래그 덧붙여 전달
    const enriched = payload.issues.map((i) => ({
      ...i,
      ruleLabel: ruleLabel(i.ruleId),
      fixable: isFixable(i.ruleId),
    }));
    this.panel.webview.postMessage({
      type: "report",
      issues: enriched,
      fileCount: payload.fileCount,
      durationMs: payload.durationMs,
      workspaceRoot: payload.workspaceRoot,
    });
  }

  private getHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<title>Code Quality Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .card { background: var(--vscode-editorWidget-background, #2a2a2a); border: 1px solid var(--vscode-widget-border, #444); padding: 8px 12px; border-radius: 6px; min-width: 120px; }
  .card .label { font-size: 11px; opacity: 0.7; text-transform: uppercase; }
  .card .value { font-size: 20px; font-weight: 600; }
  .quick-actions { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .quick-actions .qa-btn { padding: 6px 12px; font-size: 12px; border-radius: 4px; border: 1px solid var(--vscode-button-background, #0e639c); background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); cursor: pointer; }
  .quick-actions .qa-btn:hover { opacity: 0.85; }
  .filters { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .filter-btn { cursor: pointer; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--vscode-widget-border, #444); background: transparent; color: inherit; font-size: 12px; }
  .filter-btn.active { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); border-color: transparent; }
  .file-group { margin-bottom: 14px; }
  .file-header { font-weight: 600; font-size: 13px; margin-bottom: 4px; opacity: 0.9; }
  .issue { display: grid; grid-template-columns: 70px 120px 1fr auto; gap: 8px; padding: 4px 8px; border-radius: 4px; align-items: baseline; }
  .issue .clickable { cursor: pointer; }
  .issue:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05)); }
  .issue .loc { opacity: 0.7; font-family: ui-monospace, monospace; font-size: 11px; }
  .issue .rule { font-family: ui-monospace, monospace; font-size: 11px; opacity: 0.85; }
  .issue .msg { font-size: 12px; }
  .fix-btn { padding: 2px 8px; font-size: 11px; border-radius: 3px; border: 1px solid var(--vscode-button-background, #0e639c); background: transparent; color: var(--vscode-button-background, #0e639c); cursor: pointer; }
  .fix-btn:hover { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); }
  .file-actions { display: inline-block; margin-left: 8px; }
  .severity-info .rule { color: #6cb6ff; }
  .severity-warning .rule { color: #e2b93b; }
  .severity-error .rule { color: #f85149; }
  .empty { opacity: 0.6; padding: 20px; text-align: center; }
</style>
</head>
<body>
<h1>Code Quality Report</h1>
<div class="summary" id="summary"></div>
<div class="quick-actions" id="quickActions"></div>
<div class="filters" id="filters"></div>
<div id="results"><div class="empty">분석 결과 대기 중...</div></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  let state = { issues: [], activeFilter: "all", workspaceRoot: "" };

  function relPath(p) {
    if (state.workspaceRoot && p.startsWith(state.workspaceRoot)) {
      return p.slice(state.workspaceRoot.length).replace(/^[\\\\/]/, "");
    }
    return p;
  }

  // ruleId → 일괄 수정 버튼 라벨
  const QUICK_ACTION_LABELS = {
    consoleCall: '모든 console 지우기',
    todoComment: '모든 TODO 지우기',
    unusedImport: '모든 사용 안 하는 import 정리',
    unusedVariable: '모든 사용 안 하는 변수 정리',
    unusedFunction: '모든 사용 안 하는 함수 정리',
  };

  function render() {
    const summary = document.getElementById("summary");
    const quickActions = document.getElementById("quickActions");
    const filters = document.getElementById("filters");
    const results = document.getElementById("results");

    const counts = {};
    for (const i of state.issues) counts[i.ruleLabel] = (counts[i.ruleLabel] || 0) + 1;
    summary.innerHTML =
      '<div class="card"><div class="label">Total</div><div class="value">' + state.issues.length + '</div></div>' +
      '<div class="card"><div class="label">Files</div><div class="value">' + state.fileCount + '</div></div>' +
      '<div class="card"><div class="label">Duration</div><div class="value">' + state.durationMs + ' ms</div></div>';

    // Quick action 버튼: fixable 규칙별로 카운트가 있을 때만 노출
    quickActions.innerHTML = '';
    Object.keys(QUICK_ACTION_LABELS).forEach(ruleId => {
      const items = state.issues.filter(i => i.ruleId === ruleId && i.fixable);
      if (items.length === 0) return;
      const btn = document.createElement('button');
      btn.className = 'qa-btn';
      btn.textContent = QUICK_ACTION_LABELS[ruleId] + ' (' + items.length + ')';
      btn.onclick = () => {
        vscode.postMessage({ type: 'bulkFix', issues: items });
      };
      quickActions.appendChild(btn);
    });

    const ruleIds = Object.keys(counts).sort();
    filters.innerHTML = '';
    const addBtn = (id, label) => {
      const b = document.createElement('button');
      b.className = 'filter-btn' + (state.activeFilter === id ? ' active' : '');
      b.textContent = label;
      b.onclick = () => { state.activeFilter = id; render(); };
      filters.appendChild(b);
    };
    addBtn('all', 'All (' + state.issues.length + ')');
    for (const id of ruleIds) addBtn(id, id + ' (' + counts[id] + ')');

    const filtered = state.activeFilter === 'all'
      ? state.issues
      : state.issues.filter(i => i.ruleLabel === state.activeFilter);

    if (filtered.length === 0) {
      results.innerHTML = '<div class="empty">문제가 발견되지 않았습니다 🎉</div>';
      return;
    }

    const byFile = new Map();
    for (const i of filtered) {
      if (!byFile.has(i.filePath)) byFile.set(i.filePath, []);
      byFile.get(i.filePath).push(i);
    }

    let html = '';
    let issueIdx = 0;
    const indexed = [];
    for (const [filePath, items] of byFile) {
      const fixableInFile = items.filter(i => i.fixable).length;
      html += '<div class="file-group">';
      html += '<div class="file-header">' + escapeHtml(relPath(filePath)) + ' <span style="opacity:0.6">(' + items.length + ')</span>';
      if (fixableInFile > 0) {
        html += '<span class="file-actions"><button class="fix-btn" data-fix-file="' + escapeAttr(filePath) + '">파일 내 ' + fixableInFile + '개 일괄 수정</button></span>';
      }
      html += '</div>';
      for (const i of items) {
        indexed[issueIdx] = i;
        html += '<div class="issue severity-' + i.severity + '">';
        html += '<span class="loc clickable" data-idx="' + issueIdx + '">' + i.line + ':' + i.column + '</span>';
        html += '<span class="rule clickable" data-idx="' + issueIdx + '">' + i.ruleLabel + '</span>';
        html += '<span class="msg clickable" data-idx="' + issueIdx + '">' + escapeHtml(i.message) + '</span>';
        if (i.fixable) {
          html += '<button class="fix-btn" data-fix-idx="' + issueIdx + '">수정</button>';
        } else {
          html += '<span></span>';
        }
        html += '</div>';
        issueIdx++;
      }
      html += '</div>';
    }
    results.innerHTML = html;

    results.querySelectorAll('.clickable').forEach(el => {
      el.addEventListener('click', () => {
        const i = indexed[Number(el.dataset.idx)];
        vscode.postMessage({ type: 'openFile', filePath: i.filePath, line: i.line, column: i.column });
      });
    });
    results.querySelectorAll('button[data-fix-idx]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const i = indexed[Number(el.dataset.fixIdx)];
        vscode.postMessage({ type: 'fix', issue: i });
      });
    });
    results.querySelectorAll('button[data-fix-file]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const fp = el.dataset.fixFile;
        // 같은 파일 내 fixable 이슈 모두를 한 메시지로 전송 → 익스텐션이 순차 적용
        const targets = state.issues.filter(i => i.filePath === fp && i.fixable);
        if (targets.length > 0) {
          vscode.postMessage({ type: 'bulkFix', issues: targets });
        }
      });
    });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'report') {
      state.issues = msg.issues;
      state.fileCount = msg.fileCount;
      state.durationMs = msg.durationMs;
      state.workspaceRoot = msg.workspaceRoot;
      render();
    }
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function issueKey(i: Issue): string {
  return `${i.ruleId}|${i.filePath}|${i.line}|${i.column}|${i.message}`;
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
