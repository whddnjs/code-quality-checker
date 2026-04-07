// 사용되지 않는 변수 rule의 오탐 테스트 케이스.
// 아래 변수들은 모두 "사용 중"이어야 하고 하나도 flag되어선 안 됨.

// 1. 단순 사용
const simple = 1;
console.log(simple);

// 2. 다른 변수의 initializer에서 사용
const base = 10;
const derived = base * 2;
export { derived };

// 3. 템플릿 리터럴 안에서 사용
const name = "world";
const greeting = `hello, ${name}`;
console.log(greeting);

// 4. 함수 본문에서 사용
const factor = 3;
function multiply(x: number): number {
  return x * factor;
}
multiply(5);

// 5. 화살표 함수 본문 (expression body)에서 사용
const addend = 5;
const adder = (x: number) => x + addend;
adder(1);

// 6. 객체 리터럴 shorthand
const hello = "hi";
const obj = { hello };
console.log(obj);

// 7. 객체 리터럴 explicit property value
const port = 3000;
const config = { port: port };
console.log(config);

// 8. spread 안에서 사용
const arr = [1, 2];
const more = [...arr, 3];
console.log(more);

// 9. 조건식에서 사용
const flag = true;
const result = flag ? "yes" : "no";
console.log(result);

// 10. typeof 타입 참조에서 사용
const settings = { foo: 1 };
type Settings = typeof settings;
function use(_s: Settings): void {}
use(settings);

// 11. 타입 참조 (값이 클래스인 경우)
class Widget {}
const w: Widget = new Widget();
console.log(w);

// 12. 메소드 인자로 전달
const callback = () => 1;
[1, 2].map(callback);

// 13. 구조분해 RHS 참조
const source = { a: 1, b: 2 };
const { a, b } = source;
console.log(a, b);

// 14. JSX (TSX에서만 의미)
// TSX 파일이 아니므로 주석으로만 기록. 별도 TSX fixture 사용.
