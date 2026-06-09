/**
 * arduinoHover.ts
 * ───────────────
 * VS Code hover provider + clangd hover filter for the Arduino built-in API.
 *
 * Two responsibilities:
 *   1. registerArduinoHoverProvider — shows concise function docs from arduino_docs.h.
 *   2. injectClangdHoverFilter — patches the clangd LanguageClient middleware so that:
 *        • Symbols Grease documents: clangd hover is suppressed entirely (our hover wins).
 *        • All other symbols: "provided by ..." lines are stripped from clangd's output.
 */

import * as fs from "node:fs";
import * as vscode from "vscode";

export interface ArduinoSymbolDoc {
  brief: string;
  signature: string;
  params: Array<{ name: string; desc: string }>;
}

/**
 * Read `arduino_docs.h` and return a map of {symbolName → {brief, signature, params}}.
 * Returns an empty map on any I/O error so the rest of the extension keeps working.
 */
export function parseArduinoDocs(sidecarPath: string): Map<string, ArduinoSymbolDoc> {
  const docs = new Map<string, ArduinoSymbolDoc>();
  let content: string;
  try {
    content = fs.readFileSync(sidecarPath, "utf8");
  } catch {
    return docs;
  }

  const blockRe = /\/\*\*([\s\S]*?)\*\//g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    const body = m[1];

    // Pull out @brief ... up to (a) a blank comment line, (b) another @tag, or (c) end.
    const briefRe = /@brief\b\s*([\s\S]*?)(?=\n\s*\*\s*(?:@|\n)|\n\s*\*\/|$)/;
    const briefMatch = body.match(briefRe);
    if (!briefMatch) continue;

    const brief = briefMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => l.length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!brief) continue;

    // Pull out @param name description entries.
    const params: Array<{ name: string; desc: string }> = [];
    const paramRe = /@param\s+(\w+)\s+([\s\S]*?)(?=\n\s*\*\s*(?:@|\n)|\n\s*\*\/|$)/g;
    let pm: RegExpExecArray | null;
    while ((pm = paramRe.exec(body)) !== null) {
      const desc = pm[2]
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").trim())
        .filter((l) => l.length > 0)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pm[1] && desc) params.push({ name: pm[1], desc });
    }

    const after = content.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const sym = identifySymbol(after);
    if (!sym) continue;
    if (!docs.has(sym.name)) docs.set(sym.name, { brief, signature: sym.signature, params });
  }
  return docs;
}

/**
 * Look at the text immediately after a doc-comment block and figure out which
 * symbol it documents. Returns {name, signature} or null if unrecognizable.
 */
function identifySymbol(after: string): { name: string; signature: string } | null {
  const firstLine = after.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";

  const macro = after.match(/^\s*#define\s+([A-Za-z_]\w*)/);
  if (macro) {
    return { name: macro[1], signature: firstLine };
  }

  const ext = after.match(/^\s*extern\s+[\w:<>*&\s]+?\s+([A-Za-z_]\w*)\s*[;[]/);
  if (ext) {
    const sig = firstLine.replace(/^extern\s+/, "").replace(/;$/, "").trim();
    return { name: ext[1], signature: sig };
  }

  const cls = after.match(/^\s*class\s+([A-Za-z_]\w*)/);
  if (cls) {
    return { name: cls[1], signature: `class ${cls[1]}` };
  }

  const fn = after.match(
    /^\s*(?:(?:virtual|static|inline|explicit|constexpr|friend)\s+)*(?:[A-Za-z_][\w:]*\s*[*&\s]+)+([A-Za-z_]\w*)\s*\(/,
  );
  if (fn) {
    return { name: fn[1], signature: firstLine.replace(/;$/, "").trim() };
  }

  return null;
}

/**
 * Wire up the hover provider. Accepts a pre-parsed docsMap so the caller can
 * share it with injectClangdHoverFilter without parsing the file twice.
 */
export function registerArduinoHoverProvider(
  docsMap: Map<string, ArduinoSymbolDoc>,
  output: vscode.OutputChannel,
): vscode.Disposable {
  output.appendLine(`[hover-docs] Loaded ${docsMap.size} Arduino symbol descriptions.`);

  return vscode.languages.registerHoverProvider(
    [
      { scheme: "file", language: "cpp" },
      { scheme: "file", language: "c" },
      { scheme: "file", language: "arduino" },
    ],
    {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return null;
        const word = document.getText(range);
        const doc = docsMap.get(word);
        if (!doc) return null;

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**function** \`${word}\`\n\n`);
        md.appendMarkdown(`${doc.brief}\n\n`);
        md.appendCodeblock(doc.signature, "cpp");
        for (const p of doc.params) {
          md.appendMarkdown(`*@param* \`${p.name}\` — ${p.desc}\n\n`);
        }
        md.isTrusted = false;
        return new vscode.Hover(md, range);
      },
    },
  );
}

/**
 * Patch the clangd LanguageClient hover middleware so that clangd hover is
 * completely suppressed for .ino files — Arduino Grease's own provider handles
 * all hover for those files.
 *
 * Retries for up to 15 s because clangd activates asynchronously and its
 * languageClient may not be ready when our extension first runs. Tries multiple
 * property-name paths because the vscode-clangd export API has changed across
 * versions. All diagnostic output goes to the Output channel so failures are
 * always visible without a debugger.
 */
export async function injectClangdHoverFilter(
  _docsMap: Map<string, ArduinoSymbolDoc>,
  output: vscode.OutputChannel,
): Promise<void> {
  const clangdExt = vscode.extensions.getExtension("llvm-vs-code-extensions.vscode-clangd");
  if (!clangdExt) {
    output.appendLine("[hover-filter] clangd extension not found — filter skipped");
    return;
  }

  // Retry loop — clangd may still be starting when our activate() runs.
  let api: any;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      api = clangdExt.isActive ? clangdExt.exports : await clangdExt.activate();
    } catch (e) {
      output.appendLine(`[hover-filter] clangd activate error (attempt ${attempt + 1}): ${String(e)}`);
    }
    if (api) break;
    await new Promise<void>((r) => setTimeout(r, 1000));
  }

  if (!api) {
    output.appendLine("[hover-filter] clangd API not available after retries — filter skipped");
    return;
  }

  output.appendLine("[hover-filter] clangd API keys: " + Object.keys(api).join(", "));

  // Try every known property name the clangd extension has used across versions.
  const client: any =
    api?.languageClient ??
    api?.client ??
    (typeof api?.getClient === "function" ? api.getClient() : undefined) ??
    null;

  if (!client) {
    output.appendLine("[hover-filter] languageClient not found in clangd exports — filter skipped");
    return;
  }

  // Reach into the client's options bag — property name also varies by version.
  const opts: any =
    (client as any)._clientOptions ??
    (client as any).clientOptions ??
    (typeof (client as any).getClientOptions === "function"
      ? (client as any).getClientOptions()
      : undefined) ??
    null;

  if (!opts) {
    output.appendLine("[hover-filter] clangd clientOptions not accessible — filter skipped");
    return;
  }

  if (!opts.middleware) opts.middleware = {};
  const mw = opts.middleware;
  const originalProvideHover: Function | undefined = mw.provideHover;

  mw.provideHover = async (
    doc: vscode.TextDocument,
    pos: vscode.Position,
    token: vscode.CancellationToken,
    next: (
      d: vscode.TextDocument,
      p: vscode.Position,
      t: vscode.CancellationToken,
    ) => Thenable<vscode.Hover | null | undefined>,
  ): Promise<vscode.Hover | null | undefined> => {
    // .ino files — suppress clangd entirely. Grease is the sole hover provider.
    if (doc.fileName.toLowerCase().endsWith(".ino")) return null;

    // All other files — pass through, but strip "provided by ..." noise.
    const result: vscode.Hover | null | undefined = originalProvideHover
      ? await (originalProvideHover as any)(doc, pos, token, next)
      : await next(doc, pos, token);
    return result ? stripProvidedBy(result) : result;
  };

  output.appendLine("[hover-filter] clangd hover suppressed for .ino files");
}

function stripProvidedBy(hover: vscode.Hover): vscode.Hover {
  const contents = (Array.isArray(hover.contents) ? hover.contents : [hover.contents]) as Array<
    vscode.MarkdownString | { language: string; value: string }
  >;

  const filtered = contents.map((c) => {
    if (!(c instanceof vscode.MarkdownString)) return c;
    const clean = c.value
      .replace(/^provided by ["'][^"'\n]*["']\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const ms = new vscode.MarkdownString(clean);
    ms.isTrusted = c.isTrusted;
    return ms;
  });

  return new vscode.Hover(filtered as any, hover.range);
}
