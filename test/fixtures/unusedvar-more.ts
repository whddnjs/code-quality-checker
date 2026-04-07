// 더 이색적인 usage 케이스

// 1. 타입 단언 (as X)
class SomeClass {
  x = 1;
}
const rawData = { x: 2 };
const casted = rawData as SomeClass;
console.log(casted);

// 2. satisfies 연산자
const themeKeys = ["light", "dark"] as const;
const theme = { light: "#fff", dark: "#000" } satisfies Record<
  (typeof themeKeys)[number],
  string
>;
console.log(theme);

// 3. default parameter 값으로만 사용
const DEFAULT_SIZE = 10;
function makeBuffer(size: number = DEFAULT_SIZE): number[] {
  return new Array(size).fill(0);
}
makeBuffer();

// 4. class heritage clause에서 사용
const Base = class {
  foo() {
    return 1;
  }
};
class Derived extends Base {
  bar() {
    return this.foo() + 1;
  }
}
new Derived();

// 5. enum value 초기값
const START = 100;
enum Code {
  A = START,
  B = START + 1,
}
console.log(Code.A, Code.B);

// 6. Record type의 key로 사용
const allowedKeys = ["a", "b"] as const;
type Allowed = (typeof allowedKeys)[number];
const map: Record<Allowed, number> = { a: 1, b: 2 };
console.log(map);

// 7. 화살표 함수 파라미터 기본값
const FALLBACK = "default";
const fn = (s: string = FALLBACK) => s.toUpperCase();
fn();

// 8. 변수로 선언된 함수를 참조
const handler = function namedFn() {
  return 1;
};
handler();

// 9. 동일 파일 내 re-export
const secret = "xyz";
export { secret as publicSecret };

// 10. 변수 -> 객체 키 (dynamic)
const dynKey = "field";
const holder: Record<string, number> = {};
holder[dynKey] = 42;
console.log(holder);
