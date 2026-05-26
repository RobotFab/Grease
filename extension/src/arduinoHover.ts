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
 * Patch the clangd LanguageClient hover middleware so that:
 *   • Symbols documented by Grease → clangd returns null (Grease hover is the only one shown).
 *   • All other symbols → clangd hover is shown, but "provided by ..." lines are removed.
 *
 * The clangd extension (llvm-vs-code-extensions.vscode-clangd) exposes its LanguageClient
 * via `extension.exports.languageClient`. We store the original middleware and wrap it.
 * If the API is not accessible, this function exits silently — hover still works, it just
 * doesn't filter clangd's output.
 */
export async function injectClangdHoverFilter(
  docsMap: Map<string, ArduinoSymbolDoc>,
  output: vscode.OutputChannel,
): Promise<void> {
  const clangdExt = vscode.extensions.getExtension("llvm-vs-code-extensions.vscode-clangd");
  if (!clangdExt) {
    output.appendLine("[hover-filter] clangd extension not found — filter skipped");
    return;
  }

  let api: any;
  try {
    api = clangdExt.isActive ? clangdExt.exports : await clangdExt.activate();
  } catch (e) {
    output.appendLine("[hover-filter] clangd activation error: " + String(e));
    return;
  }

  const client = api?.languageClient;
  if (!client) {
    output.appendLine("[hover-filter] languageClient not exposed by clangd — filter skipped");
    return;
  }

  // _clientOptions is the internal property in vscode-languageclient; fall back to the
  // public getter in case a future version renames it.
  const opts: any = (client as any)._clientOptions ?? (client as any).clientOptions;
  const mw = opts?.middleware;
  if (!mw) {
    output.appendLine("[hover-filter] clangd middleware not accessible — filter skipped");
    return;
  }

  const originalProvideHover: Function | undefined = mw.provideHover;

  mw.provideHover = async (
    doc: vscode.TextDocument,
    pos: vscode.Position,
    token: vscode.CancellationToken,
    next: (d: vscode.TextDocument, p: vscode.Position, t: vscode.CancellationToken) => Thenable<vscode.Hover | null | undefined>,
  ): Promise<vscode.Hover | null | undefined> => {
    // Suppress clangd hover for symbols Grease documents — our provider handles them.
    const wordRange = doc.getWordRangeAtPosition(pos);
    const word = wordRange ? doc.getText(wordRange) : "";
    if (word && docsMap.has(word)) return null;

    // For everything else: run clangd hover but strip "provided by ..." lines.
    const result: vscode.Hover | null | undefined = originalProvideHover
      ? await originalProvideHover(doc, pos, token, next)
      : await next(doc, pos, token);

    return result ? stripProvidedBy(result) : result;
  };

  output.appendLine("[hover-filter] clangd hover filter installed");
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
