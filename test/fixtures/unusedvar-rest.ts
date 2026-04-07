// rest destructuring 의도적 제외 패턴

class Component {
  private _response = () => ({ ITEMS: [1, 2], total: 2, page: 1 });

  readonly pagination = (() => {
    const { ITEMS, ...rest } = this._response();
    return rest;
  })();
}

new Component();

// 함수 파라미터 형태는 아니지만 별도 구조분해
function stripId<T extends { id: string }>(obj: T) {
  const { id, ...withoutId } = obj;
  return withoutId;
}
stripId({ id: "1", name: "a" });

// 여러 필드 제외
const sample = { a: 1, b: 2, c: 3, d: 4 };
const { a, b, ...others } = sample; // a, b는 의도적 제외
console.log(others);

// rest가 없는 구조분해는 여전히 flag 되어야 함
const src = { x: 1, y: 2 };
const { x, y } = src; // x, y 둘 다 미사용이면 flag
console.log("no use");

// rest가 있지만 non-rest 중 하나를 실제로 쓰는 경우 — 문제 없음
const settings = { theme: "dark", lang: "ko", hidden: true };
const { hidden, ...visible } = settings;
console.log(visible, hidden);
