// 단일 파일 규칙 엣지 케이스 모음

// === any-type: as any / Array<any> / Record<any> ===
const a1 = JSON.parse("{}") as any;        // any-type (as 단언)
const a2: Array<any> = [];                  // any-type (제네릭 안)
const a3: Record<string, any> = {};         // any-type (제네릭 안)
function fa(x: any[]): any {                // any-type x2 (배열 + 리턴)
  return x;
}
console.log(a1, a2, a3, fa([]));

// === todo: XXX / HACK ===
// XXX: 주의 필요
// HACK: 임시 우회

// === console: 다양한 메소드 ===
console.warn("warn");   // consoleMethods=["log"]일 땐 미검출
console.error("error"); // 미검출
console.info("info");   // 미검출

// === smallSwitch: case 0개 (default만) ===
function defaultOnly(x: number): string {
  switch (x) {
    default:
      return "any";
  }
}
defaultOnly(1);

// === smallSwitch: case 1개 ===
function oneCase(x: number): string {
  switch (x) {
    case 1: return "one";
    default: return "other";
  }
}
oneCase(1);

// === emptyCatch: 주석만 있는 catch (빈으로 간주됨) ===
function catchWithComment(): void {
  try {
    JSON.parse("{}");
  } catch (e) {
    // 주석만 — empty-catch로 잡힐까?
  }
}
catchWithComment();

// === emptyMethod: abstract / overload signature 제외 ===
abstract class Abs {
  abstract doIt(): void; // body 없음 → 검사 제외
}
class AbsImpl extends Abs {
  doIt(): void {
    console.log("impl");
  }
}
new AbsImpl().doIt();

function overloaded(x: string): string;
function overloaded(x: number): number;
function overloaded(x: any): any { // 시그니처는 body 없음 → 통과 / 구현부에 any 2개
  return x;
}
overloaded("a");
overloaded(1);

// === nesting: try/catch/switch 깊이 ===
function nestMixed(): void {
  try {
    if (true) {
      switch (1) {
        case 1:
          for (let i = 0; i < 1; i++) {
            if (i) {
              console.log(i); // depth 5
            }
          }
      }
    }
  } catch (e) {
    console.log(e);
  }
}
nestMixed();

// === param-count: 정확히 4개 (임계값) — 미검출 ===
function exactly4(a: number, b: number, c: number, d: number): number {
  return a + b + c + d;
}
exactly4(1, 2, 3, 4);

// === emptyMethod: getter / setter (옵션 OFF면 미검출) ===
class WithAccessor {
  private _v = 0;
  get value(): number { return this._v; }
  set value(v: number) {} // 빈 setter — 기본 옵션이면 미검출, ON이면 검출
}
new WithAccessor().value = 1;

// === emptyMethod: 화살표 함수 (옵션 OFF면 미검출) ===
const cb = () => {}; // 익명 — 기본 미검출
cb();
