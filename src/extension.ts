import * as vscode from "vscode";
import { scan } from "./scanner";
import { RuleConfig, Thresholds } from "./types";
import { ReportPanel } from "./report/panel";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("codeQuality.run", () => runAnalysis(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("codeQuality.showReport", () =>
      ReportPanel.createOrShow(context)
    )
  );
}

export function deactivate(): void {}

async function runAnalysis(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage("열려있는 워크스페이스가 없습니다.");
    return;
  }
  const root = folders[0];

  const selected = await pickFolders(root);
  if (!selected || selected.length === 0) return;

  const baseRead = readConfig();
  const overriddenConfig = await pickRules(baseRead.config);
  if (!overriddenConfig) return;
  const { thresholds, excludeGlobs } = baseRead;
  const config = overriddenConfig;

  // 선택한 각 서브폴더에 대해 findFiles를 호출해 합침.
  // glob 패턴은 OS 무관하게 forward slash만 사용해야 함.
  const allFiles: string[] = [];
  const seen = new Set<string>();
  for (const sub of selected) {
    const normalized = sub === "." ? "" : sub.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const glob = normalized ? `${normalized}/**/*.{ts,tsx}` : `**/*.{ts,tsx}`;
    const pattern = new vscode.RelativePattern(root, glob);
    const exclude = `{${excludeGlobs.join(",")}}`;
    const uris = await vscode.workspace.findFiles(pattern, exclude);
    for (const u of uris) {
      if (!seen.has(u.fsPath)) {
        seen.add(u.fsPath);
        allFiles.push(u.fsPath);
      }
    }
  }

  if (allFiles.length === 0) {
    vscode.window.showInformationMessage("검사 대상 .ts/.tsx 파일이 없습니다.");
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Code Quality 분석 중...",
      cancellable: false,
    },
    async (progress) => {
      let last = 0;
      return scan({
        files: allFiles,
        config,
        thresholds,
        onProgress: (scanned, total) => {
          const pct = Math.floor((scanned / total) * 100);
          if (pct !== last) {
            progress.report({ message: `${scanned}/${total} 파일`, increment: pct - last });
            last = pct;
          }
        },
      });
    }
  );

  const panel = ReportPanel.createOrShow(context);
  panel.show({
    issues: result.issues,
    fileCount: result.fileCount,
    durationMs: result.durationMs,
    workspaceRoot: root.uri.fsPath,
  });

  vscode.window.showInformationMessage(
    `분석 완료: ${result.issues.length}개 이슈, ${result.fileCount}개 파일, ${result.durationMs}ms`
  );
}

const FOLDER_EXCLUDE = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".git",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".angular",
  ".nuxt",
  ".svelte-kit",
]);

interface FolderPickItem extends vscode.QuickPickItem {
  relPath?: string;
  isRoot?: boolean;
}

/**
 * 드릴다운 방식 폴더 선택 picker.
 *
 * - 한 번에 한 디렉토리만 펼쳐 보임 (큰 프로젝트에서도 가볍게)
 * - 각 폴더 우측의 ▶ 버튼으로 하위 진입
 * - 좌상단 ← 버튼으로 상위 폴더 이동
 * - 다중 선택은 레벨 사이를 오가도 유지됨
 * - 부모 폴더에는 그 아래 선택된 개수가 description에 표시됨
 */
async function pickFolders(root: vscode.WorkspaceFolder): Promise<string[] | undefined> {
  // 설정에 미리 지정된 폴더가 있으면 그것을 사용
  const configured = vscode.workspace
    .getConfiguration("codeQuality")
    .get<string[]>("includeFolders", []);
  if (configured.length > 0) return configured;

  return new Promise<string[] | undefined>((resolve) => {
    const qp = vscode.window.createQuickPick<FolderPickItem>();
    qp.canSelectMany = true;
    qp.matchOnDescription = true;

    /** 레벨 사이에서도 유지되는 선택 상태 */
    const selected = new Set<string>();
    let rootSelected = false;
    /** 현재 보여주고 있는 디렉토리(루트 기준 상대경로). 빈 문자열 = 워크스페이스 루트 */
    let currentRel = "";
    let resolved = false;

    const drillButton: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon("chevron-right"),
      tooltip: "하위 폴더 열기",
    };
    const backButton: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon("arrow-left"),
      tooltip: "상위 폴더로",
    };

    function updatePlaceholder(): void {
      const total = selected.size + (rootSelected ? 1 : 0);
      qp.placeholder =
        total > 0
          ? `${total}개 선택됨 · 스페이스로 선택, ▶로 하위 진입, 엔터로 확정`
          : `스페이스로 선택, ▶ 버튼으로 하위 진입, 엔터로 확정`;
    }

    /** 현재 화면의 체크 상태를 selected Set에 반영 */
    function syncSelectionFromView(): void {
      // 1. 현재 보이는 항목들은 일단 selected에서 제거 (체크 해제 반영)
      let rootVisible = false;
      for (const item of qp.items) {
        if (item.isRoot) rootVisible = true;
        if (item.relPath) selected.delete(item.relPath);
      }
      if (rootVisible) rootSelected = false;
      // 2. 현재 체크된 것을 다시 추가
      for (const item of qp.selectedItems) {
        if (item.isRoot) rootSelected = true;
        if (item.relPath) selected.add(item.relPath);
      }
    }

    async function showLevel(rel: string): Promise<void> {
      syncSelectionFromView();
      currentRel = rel;

      qp.title = rel ? `검사할 폴더 — /${rel}` : "검사할 폴더";
      qp.buttons = rel ? [backButton] : [];
      qp.busy = true;

      const items: FolderPickItem[] = [];

      if (!rel) {
        items.push({
          label: "$(root-folder) 루트 전체",
          description: "워크스페이스 전체 검사",
          isRoot: true,
        });
      }

      const uri = rel ? vscode.Uri.joinPath(root.uri, ...rel.split("/")) : root.uri;
      let entries: [string, vscode.FileType][] = [];
      try {
        entries = await vscode.workspace.fs.readDirectory(uri);
      } catch {
        /* 접근 불가 디렉토리는 빈 리스트로 처리 */
      }
      entries.sort((a, b) => a[0].localeCompare(b[0]));

      for (const [name, type] of entries) {
        if ((type & vscode.FileType.Directory) === 0) continue;
        if (FOLDER_EXCLUDE.has(name) || name.startsWith(".")) continue;

        const childRel = rel ? `${rel}/${name}` : name;
        // 이 폴더 자신 또는 하위가 이미 선택되어 있으면 description에 표시
        const subPrefix = childRel + "/";
        let subCount = 0;
        for (const s of selected) {
          if (s === childRel || s.startsWith(subPrefix)) subCount++;
        }
        const desc =
          subCount > 0 ? `${childRel}  ·  ${subCount}개 선택됨` : childRel;

        items.push({
          label: `$(folder) ${name}`,
          description: desc,
          relPath: childRel,
          buttons: [drillButton],
        });
      }

      qp.items = items;
      // 영구 선택 상태를 새 화면에도 다시 반영
      const reSelect: FolderPickItem[] = [];
      for (const item of items) {
        if (item.isRoot && rootSelected) reSelect.push(item);
        if (item.relPath && selected.has(item.relPath)) reSelect.push(item);
      }
      qp.selectedItems = reSelect;

      qp.busy = false;
      updatePlaceholder();
    }

    qp.onDidTriggerItemButton((e) => {
      if (e.button === drillButton && e.item.relPath) {
        void showLevel(e.item.relPath);
      }
    });

    qp.onDidTriggerButton((button) => {
      if (button === backButton && currentRel) {
        const parent = currentRel.includes("/")
          ? currentRel.substring(0, currentRel.lastIndexOf("/"))
          : "";
        void showLevel(parent);
      }
    });

    qp.onDidChangeSelection(() => {
      // 선택 토글 시마다 영구 set 동기화 + placeholder 카운트 갱신
      syncSelectionFromView();
      updatePlaceholder();
    });

    qp.onDidAccept(() => {
      syncSelectionFromView();
      resolved = true;
      if (rootSelected) {
        resolve(["."]);
      } else if (selected.size > 0) {
        resolve([...selected]);
      } else {
        resolve(undefined);
      }
      qp.hide();
    });

    qp.onDidHide(() => {
      if (!resolved) resolve(undefined);
      qp.dispose();
    });

    void showLevel("");
    qp.show();
  });
}

interface RulePickItem extends vscode.QuickPickItem {
  /** 토글 가능한 boolean 규칙 키 */
  key?: keyof RuleConfig;
  /** consoleMethods 배열에 추가/제거할 메소드 이름 */
  consoleMethod?: string;
}

const CONSOLE_METHOD_OPTIONS = ["log", "warn", "error", "info", "debug", "trace"];

async function pickRules(base: RuleConfig): Promise<RuleConfig | undefined> {
  // 모든 항목 기본 체크 해제 상태로 노출 — 매번 필요한 것만 선택해서 사용.
  const items: RulePickItem[] = [
    { key: "unusedImport", label: "사용하지 않는 import", picked: false },
    { key: "unusedVariable", label: "사용하지 않는 변수", description: "기본: *.spec.ts 제외", picked: false },
    {
      key: "unusedVariableIncludeSpec",
      label: "  └ *.spec.ts 파일까지 검사 (상세)",
      description: "위 옵션의 검사 범위 확장",
      picked: false,
    },
    { key: "unusedFunction", label: "사용하지 않는 함수", description: "non-export `function` 선언만", picked: false },
    { key: "emptyMethod", label: "빈 메소드/함수", description: "이름있는 함수·메소드만", picked: false },
    {
      key: "emptyMethodIncludeAnonymous",
      label: "  └ 콜백/생성자/getter/setter도 포함 (상세)",
      description: "위 옵션의 검사 범위 확장",
      picked: false,
    },
    {
      key: "emptyMethodIgnoreCommented",
      label: "  └ 본문에 주석 있으면 제외 (상세)",
      description: "상속 훅 등 의도된 빈 본문 봐주기",
      picked: false,
    },
    { key: "consoleCall", label: "console.* 호출", description: "아래 메소드 중 체크된 것만 잡음", picked: false },
    ...CONSOLE_METHOD_OPTIONS.map((m) => ({
      consoleMethod: m,
      label: `  └ console.${m}`,
      picked: false,
    })),
    { key: "todoComment", label: "TODO/FIXME 주석", picked: false },
    { key: "unusedFile", label: "사용하지 않는 파일 (import 안 되는 파일)", description: "index/main/*.spec/*.d.ts/*.module.ts 제외", picked: false },
    { key: "mergeConflict", label: "Git merge conflict 마커", description: "<<<<<<< / ======= / >>>>>>> 잔존", picked: false },
    { key: "smallSwitch", label: "switch case ≤ 2개", picked: false },
    { key: "emptyCatch", label: "빈 catch 블록", picked: false },
    { key: "anyType", label: "명시적 any 타입", picked: false },
    { key: "paramCount", label: "함수 파라미터 개수 초과", picked: false },
    { key: "functionLength", label: "함수 길이 초과", picked: false },
    { key: "nestingDepth", label: "중첩 깊이 초과", picked: false },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: "검사할 항목을 선택하세요",
    placeHolder: "스페이스로 토글, 엔터로 확정",
  });
  if (!picked) return undefined;

  const pickedSet = new Set(picked as RulePickItem[]);
  const result: RuleConfig = { ...base, consoleMethods: [] };
  for (const item of items) {
    if (item.key) {
      (result as any)[item.key] = pickedSet.has(item);
    } else if (item.consoleMethod && pickedSet.has(item)) {
      result.consoleMethods.push(item.consoleMethod);
    }
  }
  return result;
}

function readConfig(): { config: RuleConfig; thresholds: Thresholds; excludeGlobs: string[] } {
  const c = vscode.workspace.getConfiguration("codeQuality");
  const config: RuleConfig = {
    emptyMethod: c.get("rules.emptyMethod", true),
    emptyMethodIncludeAnonymous: c.get("rules.emptyMethodIncludeAnonymous", false),
    emptyMethodIgnoreCommented: c.get("rules.emptyMethodIgnoreCommented", false),
    unusedImport: c.get("rules.unusedImport", true),
    unusedVariable: c.get("rules.unusedVariable", true),
    unusedVariableIncludeSpec: c.get("rules.unusedVariableIncludeSpec", false),
    unusedFunction: c.get("rules.unusedFunction", true),
    todoComment: c.get("rules.todoComment", true),
    consoleCall: c.get("rules.consoleCall", true),
    smallSwitch: c.get("rules.smallSwitch", true),
    emptyCatch: c.get("rules.emptyCatch", true),
    anyType: c.get("rules.anyType", true),
    paramCount: c.get("rules.paramCount", true),
    functionLength: c.get("rules.functionLength", true),
    nestingDepth: c.get("rules.nestingDepth", true),
    mergeConflict: c.get("rules.mergeConflict", true),
    unusedFile: c.get("rules.unusedFile", false),
    consoleMethods: c.get<string[]>("rules.consoleMethods", ["log"]),
  };
  const thresholds: Thresholds = {
    paramCount: c.get("thresholds.paramCount", 4),
    functionLength: c.get("thresholds.functionLength", 50),
    nestingDepth: c.get("thresholds.nestingDepth", 4),
  };
  const excludeGlobs = c.get<string[]>("excludeGlobs", [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/coverage/**",
    "**/.git/**",
  ]);
  return { config, thresholds, excludeGlobs };
}
