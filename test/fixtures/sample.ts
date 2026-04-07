// 의도적으로 모든 규칙을 위반하는 샘플 파일
import { readFile, writeFile } from "fs"; // writeFile 사용 안 함 → unused-import
import * as path from "path"; // 사용됨

// TODO: 여기 정리하기 → todo-comment
// FIXME: 나중에 수정

<<<<<<< HEAD
const branchA = 1;
=======
const branchB = 2;
>>>>>>> feature/x

function empty() {} // empty-method

// 사용하지 않는 변수 테스트
const unusedTop = 42; // unused-variable (단일 선언)
const usedTop = 10;
const sum = usedTop + 1;
console.log(sum);

function withLocals(): number {
  const unusedLocal = "hello"; // unused-variable
  const { keep, drop } = { keep: 1, drop: 2 }; // keep만 사용
  const [first, second] = [1, 2]; // first만 사용
  return keep + first;
}

const _intentional = 99; // 언더스코어 prefix → 제외

class Foo {
  bar(): void {} // empty-method
}

function useConsole(): void {
  console.log("남아있는 로그"); // console-call (단일 라인)
  console.log(
    "여러",
    "줄에",
    "걸친 호출"
  ); // console-call (다중 라인 → 5줄 전체 삭제 대상)
  console.warn("warn은 기본 검사 대상 아님"); // 기본 옵션에선 미검출
}

function manyParams(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e; // param-count > 4
}

function smallSwitchExample(x: number): string {
  switch (x) {
    case 1:
      return "one";
    case 2:
      return "two";
  }
  return ""; // small-switch (case 2개)
}

function emptyCatchExample(): void {
  try {
    JSON.parse("{}");
  } catch (e) {
    // 빈 catch → empty-catch
  }
}

function useAny(x: any): any { // any-type x2
  return x;
}

function deepNest(): void {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            const x = 1; // nesting-depth > 4
          }
        }
      }
    }
  }
}

function longFn(): void {
  // function-length > 50
  let x = 0;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
  x++;
}

readFile(path.resolve("x"), () => {});
