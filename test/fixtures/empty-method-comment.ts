// 빈 메소드 + 주석 옵션 테스트

class Base {
  // 1. 본문 완전히 비어있음 — 항상 flag
  empty(): void {}

  // 2. 본문에 라인 주석 — ignoreCommented 옵션 ON일 때 제외
  afterInitForm(): void {
    // 상속한 클래스에서 선택적으로 사용
  }

  // 3. 본문에 블록 주석 — 동일하게 ignoreCommented일 때 제외
  beforeUnload(): void {
    /* override here */
  }

  // 4. 본문에 statement 있음 — 빈 메소드 아님 → 항상 통과
  withStatement(): number {
    return 1;
  }
}

new Base().empty();
new Base().afterInitForm();
new Base().beforeUnload();
new Base().withStatement();

function emptyFn() {}
function commentedFn() {
  // intentional
}
emptyFn();
commentedFn();
