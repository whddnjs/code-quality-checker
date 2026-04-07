// spec 파일 — 아무도 import하지 않아도 엔트리 패턴이라 flag 되지 않음
import { format } from "./format";

describe("format", () => {
  it("uppercases", () => {
    if (format("x") !== "X") throw new Error("fail");
  });
});

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
