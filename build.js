// esbuild로 extension을 단일 파일로 번들링.
// typescript 모듈을 인라인해야 .vsix에서도 동작 (devDependency라 패키지에 포함 안 됨)
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// 이전 컴파일 부산물(개별 .js 파일들) 제거 — 패키지에 끌려가지 않도록
const outDir = path.join(__dirname, "out");
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}

esbuild
  .build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode"], // VSCode 런타임이 제공
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: false,
    minify: true,
    treeShaking: true,
    logLevel: "info",
  })
  .catch(() => process.exit(1));
