// unusedVariable 엣지 케이스

// 1. 같은 이름 shadowing — outer 미사용이지만 inner와 이름 같으면 어떻게?
const dup = 1;
function shadowing(): number {
  const dup = 2;
  return dup;
}
shadowing();
// outer dup은 외부에선 안 쓰이지만 같은 이름이 있어 'used set'에 들어감 → flag 안 됨 (false negative, 알려진 한계)

// 2. let 재선언 + 재할당
let counter = 0;
counter += 1;
console.log(counter);

// 3. 다중 변수 선언 한 줄 (`const a = 1, b = 2;`)
const a1 = 1, b1 = 2;
console.log(a1);
// b1만 미사용 → flag

// 4. typeof 사용
const obj = { x: 1 };
type ObjT = typeof obj;
function get(_o: ObjT): void {}
get(obj);

// 5. enum 멤버 참조
enum Color { Red, Blue }
const fav = Color.Red;
console.log(fav);

// 6. computed property로만 사용
const k = "key";
const m = { [k]: 1 };
console.log(m);

// 7. 객체 메소드 안에서만 사용
const greeting = "hi";
const obj2 = {
  say() { return greeting; }
};
console.log(obj2.say());

// 8. 표현식 statement로만 두기 (사용 안 됨)
const justDecl = 99;
// flag 되어야

// 9. 타입 단언 안에서 사용 (`x as Y`)
const value = 10;
const cast = value as unknown as string;
console.log(cast);

// 10. tagged template literal
const tag = (strs: TemplateStringsArray) => strs.join("");
const word = "hello";
console.log(tag`${word}`);

// 11. 동일 스코프 내 미사용 변수
function localUnused(): void {
  const inside = 1;
  console.log("nothing");
  // inside flag 되어야 (함수 안에서도 미사용)
}
localUnused();

// 12. export const는 검사 제외
export const exposedAlpha = 1; // flag 안 됨
export const exposedBeta = 2;  // flag 안 됨

// 13. Symbol.iterator 같은 computed 메소드
const iterKey = Symbol.iterator;
class Iter {
  [iterKey]() { return { next: () => ({ value: 1, done: true }) }; }
}
new Iter();
