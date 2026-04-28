// else if 체인은 같은 깊이로 측정되어야 — 임계값 4면 검출 안 됨

// === case 1: 순수 else if 체인 — 깊이 1로 측정되어야 ===
function elseIfChain(x: number): string {
  if (x === 0) return "zero";
  else if (x === 1) return "one";
  else if (x === 2) return "two";
  else if (x === 3) return "three";
  else if (x === 4) return "four";
  else return "many";
}
elseIfChain(1);

// === case 2: else if 안에 진짜 중첩 — 그건 깊이 증가해야 ===
function elseIfWithNested(x: number, y: number): number {
  if (x === 0) return 0;
  else if (x === 1) {
    if (y > 0) {       // 깊이 2
      for (let i = 0; i < y; i++) {  // 깊이 3
        if (i % 2) {   // 깊이 4
          if (i > 5) { // 깊이 5 → 검출
            return i;
          }
        }
      }
    }
  }
  return -1;
}
elseIfWithNested(1, 10);

// === case 3: else { if } 패턴 (else if 아님) — 진짜 중첩 ===
function elseBlockWithIf(x: number): number {
  if (x === 0) return 0;
  else {
    if (x > 0) {  // 깊이 2
      if (x > 10) {  // 깊이 3
        if (x > 100) {  // 깊이 4
          if (x > 1000) {  // 깊이 5 → 검출
            return x;
          }
        }
      }
    }
  }
  return -1;
}
elseBlockWithIf(1);
