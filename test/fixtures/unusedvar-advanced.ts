// 사용되지 않는 변수 rule의 고급 오탐 테스트.
// 모두 사용 중이어야 함 (flagged issue 0 기대).

// 1. 클래스 생성자 내부에서 사용
const globalConfig = { db: "postgres" };
class Service {
  constructor() {
    console.log(globalConfig);
  }
}
new Service();

// 2. 클래스 메소드에서 사용
const prefix = "user:";
class Repo {
  getKey(id: string): string {
    return prefix + id;
  }
}
new Repo().getKey("1");

// 3. getter/setter
const store = { count: 0 };
class Counter {
  get value(): number {
    return store.count;
  }
}
new Counter();

// 4. Decorator에 변수 사용 (experimentalDecorators 가정)
const meta = "META";
function deco(_s: string): ClassDecorator {
  return () => {};
}
@deco(meta)
class Decorated {}
new Decorated();

// 5. 객체 리터럴 computed property
const key = "k1";
const dict = { [key]: 1 };
console.log(dict);

// 6. Promise.then 콜백에서 사용
const suffix = "-done";
Promise.resolve("task").then((x) => console.log(x + suffix));

// 7. if/else 문에서 사용
const limit = 100;
function check(n: number): boolean {
  if (n > limit) return false;
  return true;
}
check(5);

// 8. try/catch 블록에서 사용
const maxRetry = 3;
async function attempt(): Promise<void> {
  for (let i = 0; i < maxRetry; i++) {
    try {
      await Promise.resolve();
      return;
    } catch {
      continue;
    }
  }
}
attempt();

// 9. 콜백의 콜백에서 사용
const indent = "  ";
[["a"]].map((arr) => arr.map((s) => indent + s));

// 10. 중첩 함수에서 사용
const shared = "x";
function outer() {
  function inner() {
    return shared;
  }
  return inner();
}
outer();

// 11. async/await
const endpoint = "/api";
async function load(): Promise<string> {
  const res = endpoint;
  return await Promise.resolve(res);
}
load();

// 12. switch case에서 사용
const target = "a";
function route(s: string): number {
  switch (s) {
    case target:
      return 1;
    default:
      return 0;
  }
}
route("a");

// 13. spread 파라미터
const extras = [4, 5];
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3, ...extras);
