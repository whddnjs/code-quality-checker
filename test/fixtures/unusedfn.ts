// 사용하지 않는 함수 케이스

// 1. private helper, 미사용 → flag
function unusedHelper(): number {
  return 42;
}

// 2. private helper, 사용 중 → OK
function usedHelper(): string {
  return "ok";
}
console.log(usedHelper());

// 3. export된 함수 → 검사 제외
export function publicApi(): void {}

// 4. export default → 검사 제외
export default function rootDefault(): void {}

// 5. _ prefix → 의도적 미사용 → 제외
function _intentionallyUnused(): void {}

// 6. 다른 함수에서 호출되는 helper → OK
function inner(): number {
  return chained();
}
function chained(): number {
  return 1;
}
console.log(inner());

// 7. 미사용 함수 — 다른 곳에서 사용되지 않음 → flag
function deadCode(): boolean {
  return false;
}
