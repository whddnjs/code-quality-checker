// unusedImport 엣지 케이스

// 1. side-effect import (사용 식별자 없음) — flag되면 안 됨
import "./side-effect-only";

// 2. type-only import — 타입으로만 사용
import type { Config } from "./types-mod";
function load(_c: Config): void {}
load({} as Config);

// 3. type-only import 미사용 — flag되어야
import type { Unused } from "./types-mod";

// 4. default + named 혼합, default만 사용
import React, { useState } from "react";
console.log(React);
// useState 미사용 → flag

// 5. namespace import 사용 (개별 멤버 접근)
import * as fs from "fs";
fs.readFile("a", () => {});

// 6. namespace import 미사용 — flag
import * as path from "path";

// 7. import { x as alias } — alias가 사용 식별자
import { foo as bar } from "./mod";
console.log(bar);
// foo 자체는 import 텍스트에만 등장 → 'foo'가 아니라 'bar'로 인식되는지 확인

// 8. import { x as alias } — alias 미사용
import { qux as quux } from "./mod";

// 9. import in JSX type position
import type { ReactNode } from "react";
function W(_n: ReactNode): void {}
W(null as unknown as ReactNode);
