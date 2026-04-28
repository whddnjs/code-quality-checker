# Code Quality Checker

TypeScript 프로젝트를 가볍게 점검하는 VSCode 익스텐션. 한 번의 실행으로 14개 규칙을 일괄 검사하고, 파일/라인 단위로 정리된 리포트를 보여준다. 자주 정리하는 항목(미사용 import/변수/함수, TODO, console)은 결과창에서 바로 일괄 수정 가능.

## 검사 규칙 (14개) — QuickPick 표시 순서

| 규칙 | 설명 | Quick Fix |
| --- | --- | :---: |
| `unused-import` | 사용되지 않는 import (default/named/namespace) | ✅ |
| `unused-variable` | 사용되지 않는 변수/구조분해 요소 (rest 패턴 의도적 제외 인식) | ✅ |
| `unused-function` | 사용되지 않는 `function` 선언 (non-export, 이름 있는 것만) | ✅ |
| `empty-method` | 빈 함수/메소드 본문 (이름있는 함수만 기본, 콜백/생성자 포함은 옵션) | |
| `console-call` | `console.*` 호출 (log/warn/error/info/debug/trace 개별 토글) | ✅ |
| `todo-comment` | `TODO`/`FIXME`/`XXX`/`HACK` 주석 | ✅ |
| `unused-file` | 다른 파일에서 import되지 않는 파일 (cross-file 분석) | |
| `merge-conflict` | Git merge conflict 마커(`<<<<<<<`, `=======`, `>>>>>>>`) 잔존 | |
| `small-switch` | `case`가 2개 이하인 switch (if로 단순화 후보) | |
| `empty-catch` | 빈 catch 블록 | |
| `any-type` | 명시적 `any` 타입 | |
| `param-count` | 파라미터 개수 초과 (기본 > 4) | |
| `function-length` | 함수 라인 수 초과 (기본 > 50) | |
| `nesting-depth` | 중첩 깊이 초과 (기본 > 4, `else if` 체인은 같은 레벨로 측정) | |

### 상세 옵션
- **빈 메소드** — 기본은 이름있는 함수/메소드만. 옵션 켜면 생성자/getter/setter/익명 함수까지 포함
- **빈 메소드 - 본문 주석 봐주기** — 옵션 켜면 본문이 비어있어도 안에 주석이 있으면 검사 제외 (상속 훅 등 의도된 빈 본문)
- **빈 catch - 본문 주석 봐주기** — 옵션 켜면 빈 catch 안에 주석이 있으면 검사 제외 (의도적 에러 무시 표현)
- **사용하지 않는 변수** — 기본은 `*.spec.ts` 파일 제외. 옵션 켜면 spec 파일도 검사
- **console 호출** — 기본은 `console.log`만. 다른 메소드(`warn`, `error`, ...)는 개별 체크박스로 추가
- **TODO 주석 - 콜론 형태만** — `TODO:`, `FIXME(name):`, `XXX :` 같이 콜론이 따라오는 경우만 검출. `// === XXX 케이스 ===` 같은 헤더 주석에서 잘못 잡히지 않음
- **사용하지 않는 변수 - rest 패턴 인식** — `const { ITEMS, ...rest } = obj`처럼 rest 구조분해의 비-rest 바인딩은 "의도적 제외"로 보고 flag하지 않음
- **사용하지 않는 파일 - 자동 엔트리 제외** — `index.ts`, `main.ts`, `*.spec.ts`, `*.test.ts`, `*.e2e.ts`, `*.d.ts`, `*.module.ts`, `*.stories.ts`, `*.config.ts`는 import 안 돼도 flag 안 함
- **사용하지 않는 파일 - tsconfig path alias 지원** — `tsconfig.json`의 `paths`/`baseUrl`을 자동으로 읽어 `@/utils/foo` 같은 alias도 정확히 해석
- **any 타입 - 위치별 메시지** — `as any` / `Array<any>` / 파라미터·리턴·변수·프로퍼티 위치를 구분해서 표시

## 사용

1. **명령 팔레트 열기**: `F1` (또는 `Cmd+Shift+P` / `Ctrl+Shift+P`)
2. `Code Quality: Run Analysis` 입력 → 엔터
3. **검사할 폴더 선택** (드릴다운 + 다중 선택)
   - 한 번에 한 디렉토리만 보임 → 큰 프로젝트도 가볍게
   - 각 폴더 우측 **▶ 버튼**으로 하위 디렉토리 진입
   - 좌상단 **← 버튼**으로 상위 디렉토리로 이동
   - 스페이스로 다중 선택 (레벨 사이를 오가도 선택 상태 유지)
   - 부모 폴더에는 그 아래 선택된 개수가 description에 표시됨 (`src · 3개 선택됨`)
   - `node_modules`, `dist`, `build`, `out`, `coverage`, `.git`, `.next`, `.angular` 등 자동 제외
4. **검사할 규칙 선택** (다중 선택, 기본 전부 해제)
   - 각 규칙 항목 옆에 상세 옵션이 들여쓰기로 표시됨
5. 분석 진행 상태가 알림으로 표시되고, 끝나면 **Code Quality Report** 패널이 자동으로 열림

## 결과창

- **요약 카드**: Total / Files / Duration
- **Quick Action 버튼** (해당 이슈가 있을 때만 노출):
  - `모든 console 지우기`
  - `모든 TODO 지우기`
  - `모든 사용 안 하는 import 정리`
  - `모든 사용 안 하는 변수 정리`
- **규칙별 필터** 칩
- **파일별 그룹**: 파일 헤더에 `파일 내 N개 일괄 수정` 버튼
- **이슈 행**: `라인:열  규칙  메시지  [수정]`
  - 행 클릭 → 해당 파일의 정확한 라인으로 점프
  - 수정 버튼 → 해당 이슈만 정리 (자동 저장)

### Quick Fix 동작
- **unused-import**: AST 기반으로 케이스별 정확 편집 (단일 specifier 제거 / 문장 전체 삭제 / default + named 분리 등)
- **unused-variable**: 단일 선언은 문장 전체 삭제, 다중 선언/구조분해는 해당 부분만 제거
- **todo-comment / console-call**: 이슈가 차지하는 모든 라인을 한 번에 삭제 (다중 라인 console 호출도 5줄 짜리면 5줄 통째로)
- 일괄 수정은 파일별 라인 내림차순으로 순차 처리되어 줄 번호 drift 없이 안전
- 매 fix 적용 후 `doc.save()` 자동 호출 → 디스크 즉시 반영

## 설정 (`settings.json`)

```jsonc
{
  "codeQuality.includeFolders": ["src"],            // 비우면 매번 폴더 선택 프롬프트
  "codeQuality.excludeGlobs": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/coverage/**",
    "**/.git/**"
  ],

  // 각 규칙 on/off (settings에서 영구 설정. 매번의 QuickPick은 매번 새로 선택)
  "codeQuality.rules.mergeConflict": true,
  "codeQuality.rules.emptyMethod": true,
  "codeQuality.rules.emptyMethodIncludeAnonymous": false,
  "codeQuality.rules.emptyMethodIgnoreCommented": false,
  "codeQuality.rules.unusedImport": true,
  "codeQuality.rules.unusedVariable": true,
  "codeQuality.rules.unusedVariableIncludeSpec": false,
  "codeQuality.rules.todoComment": true,
  "codeQuality.rules.consoleCall": true,
  "codeQuality.rules.consoleMethods": ["log"],      // ["log", "warn", "error"] 등
  "codeQuality.rules.smallSwitch": true,
  "codeQuality.rules.emptyCatch": true,
  "codeQuality.rules.emptyCatchIgnoreCommented": false,
  "codeQuality.rules.anyType": true,
  "codeQuality.rules.paramCount": true,
  "codeQuality.rules.functionLength": true,
  "codeQuality.rules.nestingDepth": true,
  "codeQuality.rules.unusedFile": false,

  // 임계값
  "codeQuality.thresholds.paramCount": 4,
  "codeQuality.thresholds.functionLength": 50,
  "codeQuality.thresholds.nestingDepth": 4
}
```

## 설계 노트

- **타입체커(`ts.createProgram`) 미사용** → 1000+ 파일도 수 초 내 처리
- 노드 기반 규칙은 모두 **단일 AST 순회** 안에서 처리 → 규칙 개수가 늘어도 속도에 거의 영향 없음
- 파일 단위 규칙(`unusedImport`, `unusedVariable`, `todoComment`, `mergeConflict`)만 별도 스캔
- **cross-file 규칙** (`unusedFile`)은 per-file 스캔 시 import specifier만 수집해두고, 모든 파일 스캔 후 한 번에 그래프 분석
- `unusedFile`의 모듈 해석은 `ts.resolveModuleName` 사용 → tsconfig의 `paths` alias, `baseUrl`, ESM 확장자 매핑까지 TypeScript 컴파일러와 동일한 로직으로 처리
- Quick Fix는 적용 직전 **해당 파일을 다시 파싱하여 내용 기반 위치 재탐색** → 줄 번호가 drift해도 정확한 대상 편집

## 알려진 한계

- `unusedVariable` / `unusedFunction`은 파일 단위 분석이라 함수 간 동일 이름이 있으면 사용으로 간주됨 (예: outer/inner 같은 이름의 함수가 있으면 outer 미사용도 통과 — false negative 허용)
- `unusedFile`은 문자열 참조(`templateUrl: './foo.html'` 같은 Angular 스타일)는 감지하지 못함
- `unusedFile`은 첫 스캔 파일 기준으로 한 번만 tsconfig를 로드함 — 모노레포처럼 여러 tsconfig가 있는 프로젝트에선 일부 alias 해석이 빠질 수 있음
- `anyType`은 명시적 `any`만 검출. implicit any는 타입체커가 필요해 미지원
- Quick Fix는 `unused-import`, `unused-variable`, `todo-comment`, `console-call`만 지원

## 개발

```bash
npm install
npm run compile     # out/ 생성
node test/run.js    # fixture 기반 스모크 테스트
```

명령 팔레트(F1)에서 `Code Quality: Run Analysis` 실행으로 사용.
