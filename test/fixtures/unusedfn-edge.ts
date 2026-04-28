// unusedFunction 엣지 케이스

// 1. nested function — 외부 함수에서만 호출
function outerNested(): number {
  function innerHelper(): number {
    return 1;
  }
  return innerHelper();
}
outerNested();

// 2. 같은 이름 함수가 nested에 있을 때
function helper(): number { // top-level — 미사용? nested 'helper'에 의해 used set에 들어가나?
  return 100;
}
function callerOf(): number {
  function helper(): number {
    return 1;
  }
  return helper();
}
callerOf();
// false negative: top-level helper도 nested helper 이름 때문에 used로 보일 가능성

// 3. 미사용 nested function
function withDeadInner(): number {
  function neverCalled(): number {
    return 0;
  }
  return 1;
}
withDeadInner();
// neverCalled 미사용 → flag 되어야 하나?

// 4. 함수 표현식은 검사 안 함 (의도)
const arrowFn = () => 1;
const fnExpr = function namedExpr() { return 2; };
console.log(arrowFn(), fnExpr());

// 5. 콜백으로 전달 (참조만 됨)
function asCallback(): void {}
[1].forEach(asCallback);

// 6. 재귀
function recurse(n: number): number {
  if (n <= 0) return 0;
  return recurse(n - 1);
}
recurse(3);

// 7. 호이스팅 — 정의 위에서 호출
hoisted();
function hoisted(): void {}
