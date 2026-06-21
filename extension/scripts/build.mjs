#!/usr/bin/env node
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const watch = process.argv.includes("--watch");

const sharedConfig = {
  bundle: true,
  sourcemap: !watch ? false : "linked",
  minify: !watch,
  logLevel: "info",
};

// ── Extension host bundle (CJS, runs inside VS Code) ───────────────────────
const extensionCtx = await esbuild.context({
  ...sharedConfig,
  entryPoints: [path.join(root, "src/extension.ts")],
  outfile: path.join(root, "dist/extension.js"),
  format: "cjs",
  platform: "node",
  external: ["vscode"],
});

// ── MCP server bundle (ESM, runs as a standalone Node.js child process) ────
// createRequire banner lets inlined CJS deps call require() for Node built-ins
// without breaking ESM mode on Node v22+.
const serverCtx = await esbuild.context({
  ...sharedConfig,
  entryPoints: [path.join(root, "server/server.mjs")],
  outfile: path.join(root, "dist/server.mjs"),
  format: "esm",
  platform: "node",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

if (watch) {
  await Promise.all([extensionCtx.watch(), serverCtx.watch()]);
  console.log("Watching for changes…");
} else {
  await Promise.all([extensionCtx.rebuild(), serverCtx.rebuild()]);
  await Promise.all([extensionCtx.dispose(), serverCtx.dispose()]);
}
