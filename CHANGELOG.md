# Changelog

## 0.0.3

### 개선
- `todo-comment`: 콜론 패턴(`TODO:`, `FIXME(name):`, `XXX :`)만 검출하도록 좁힘 → `// === XXX 케이스 ===` 같은 헤더 주석에서의 false positive 제거
- `nesting-depth`: `else if` 체인은 같은 깊이로 측정 → `if/else if × 5` 같은 일반 분기에서 잘못 잡히지 않음
- `small-switch`: case가 0개(default만 있는 switch)일 때 별도 메시지 — "switch 자체를 제거하고 본문으로 풀어쓰기"
- `any-type`: 위치별 메시지 분기 — `as any` 단언 / `Array<any>` 등 제네릭 인자 / 파라미터·리턴·변수·프로퍼티 타입을 구분해서 표시
- `unused-file`: 자동 엔트리 패턴 확장 — `*.e2e.ts(x)`, `*.stories.ts(x)`, `*.config.ts(x)` 추가 (Storybook, Playwright/Cypress E2E, Vite/Webpack/Rollup 설정 파일)

### 추가
- `codeQuality.rules.emptyCatchIgnoreCommented` 옵션 — 빈 catch 안에 주석이 있으면 검사에서 제외 (의도적 에러 무시 표현 봐주기)

### 문서
- 알려진 한계 보강: `unusedFunction` shadowing false negative, 단일 tsconfig 로드 제한, implicit any 미지원 명시

## 0.0.2

- 초기 릴리즈
