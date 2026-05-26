/**
 * ui/examplesPanel.ts
 * ───────────────────
 * Browse and open the bundled example sketches that ship with installed
 * Arduino libraries. Lets the user filter by free text or library name and
 * opens the chosen `.ino` as a read-only buffer (so they don't accidentally
 * edit the bundled file in their Arduino install directory).
 *
 * This module owns:
 *   • `asRows()` / `uniqueRows()` — pure shaping of arduino-cli JSON
 *   • `ExamplesPanel` — the standalone webview panel
 *
 * The toolbar (views/toolbarView.ts) reuses `asRows` / `uniqueRows` to render
 * the same data inside its embedded "X-mpls" tab.
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runArduinoCli } from "../arduinoCli";

export interface ExampleRow {
  library: string;
  example: string;
  fullPath: string;
}

/** Flatten the `lib examples --json` shape into one row per example sketch. */
export function asRows(data: any): ExampleRow[] {
  const examples = Array.isArray(data?.examples) ? data.examples : [];
  const rows: ExampleRow[] = [];
  for (const entry of examples) {
    const libraryName = String(entry?.library?.name ?? "Unknown");
    const paths = Array.isArray(entry?.examples) ? entry.examples : [];
    for (const p of paths) {
      const fullPath = String(p ?? "");
      if (!fullPath) continue;
      rows.push({
        library: libraryName,
        example: path.basename(fullPath),
        fullPath,
      });
    }
  }
  return rows;
}

/** Dedupe by `library::fullPath` and sort by library then example name. */
export function uniqueRows(rows: ExampleRow[]): ExampleRow[] {
  const seen = new Set<string>();
  const out: ExampleRow[] = [];
  for (const r of rows) {
    const k = `${r.library}::${r.fullPath}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.sort((a, b) => {
    const l = a.library.localeCompare(b.library);
    if (l !== 0) return l;
    return a.example.localeCompare(b.example);
  });
}

export class ExamplesPanel {
  private panel: vscode.WebviewPanel | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private output: vscode.OutputChannel,
  ) {}

  /** Create or reveal the examples webview. Passing the current FQBN filters board-specific examples. */
  show(defaultFqbn: string | null): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "arduinoMcp.examples",
        "X-mpls",
        vscode.ViewColumn.Beside,
        { enableScripts: true },
      );
      this.panel.onDidDispose(() => (this.panel = null));
      this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg, defaultFqbn));
    } else {
      this.panel.title = "X-mpls";
      this.panel.reveal(vscode.ViewColumn.Beside);
    }
    this.panel.webview.html = this.html();
    void this.onMessage({ type: "list", library: "" }, defaultFqbn);
  }

  /**
   * Ask arduino-cli for every example sketch in the user's installed libraries.
   * Runs twice: once with no board filter (universal examples) and once with
   * the current FQBN (board-specific examples) — then merges and dedupes.
   *
   * Also scans a known custom-library path so personal libs show up.
   */
  private async listExamples(defaultFqbn: string | null): Promise<ExampleRow[]> {
    const argsBase = ["lib", "examples", "--json"];
    this.output.appendLine(`$ arduino-cli ${argsBase.join(" ")}`);
    const base = await runArduinoCli(argsBase);
    if (!base.success) throw new Error(base.stderr || base.stdout || "Failed to list examples");
    let rows = asRows(JSON.parse(base.stdout));
    if (defaultFqbn) {
      const argsBoard = ["lib", "examples", "--fqbn", defaultFqbn, "--json"];
      this.output.appendLine(`$ arduino-cli ${argsBoard.join(" ")}`);
      const b = await runArduinoCli(argsBoard);
      if (b.success) rows = rows.concat(asRows(JSON.parse(b.stdout)));
    }
    const customLibPath = path.join(os.homedir(), "Documents", "Arduino", "libraries", "AdvancedAnalog");
    if (fs.existsSync(customLibPath)) {
      const exDir = path.join(customLibPath, "examples");
      if (fs.existsSync(exDir)) {
        try {
          const subdirs = fs
            .readdirSync(exDir, { withFileTypes: true })
            .filter((d) => d.isDirectory());
          for (const sd of subdirs) {
            rows.push({
              library: "Filtered analog",
              example: sd.name,
              fullPath: path.join(exDir, sd.name),
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
    return uniqueRows(rows);
  }

  /** Open the example's main .ino in a fresh editor tab. */
  private async openExampleAsTab(examplePath: string): Promise<void> {
    const dir = String(examplePath || "").trim();
    if (!dir) return;
    const name = path.basename(dir);
    const preferred = path.join(dir, `${name}.ino`);
    let inoFile: string | null = null;
    if (fs.existsSync(preferred)) {
      inoFile = preferred;
    } else {
      try {
        const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".ino"));
        if (files.length > 0) inoFile = path.join(dir, files[0]);
      } catch {
        /* ignore */
      }
    }
    if (!inoFile) {
      vscode.window.showWarningMessage("Arduino Grease: No .ino file found in this example.");
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(inoFile));
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async onMessage(msg: any, defaultFqbn: string | null): Promise<void> {
    if (!this.panel || !msg?.type) return;
    if (msg.type === "list") {
      try {
        const rows = await this.listExamples(defaultFqbn);
        this.panel.webview.postMessage({ type: "examples", rows });
      } catch (e) {
        this.panel.webview.postMessage({
          type: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } else if (msg.type === "openExample") {
      await this.openExampleAsTab(String(msg.path ?? ""));
    }
  }

  private html(): string {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #0b0f0b;
        --panel: #121912;
        --ink: #d5ffd5;
        --soft: #bce6bc;
        --muted: #7ca57c;
        --stroke: #335233;
      }
      body { margin: 0; padding: 12px; background: var(--bg); color: var(--ink); font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size:11px; }
      .card { border: 1px solid var(--stroke); background: var(--panel); padding: 9px; border-radius: 8px; margin-bottom: 9px; }
      input {
        background: #0d130d;
        color: var(--ink);
        border: 1px solid var(--stroke);
        border-radius: 6px;
        padding: 6px 7px;
        font-size: 11px;
        width: 168px;
      }
      .muted { color: var(--muted); font-size: 10px; }
      .list { display:flex; flex-direction:column; gap:7px; }
      .item { border:1px solid var(--stroke); border-radius:8px; background:#0d130d; padding:7px; cursor:pointer; }
      .item:hover { border-color:#58aa58; }
      .title { font-weight:700; font-size:11px; overflow-wrap:anywhere; color:var(--soft); }
      .meta { font-size:10px; color:var(--muted); margin-top:2px; overflow-wrap:anywhere; }
      .row { display:flex; gap:8px; align-items:flex-end; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="row">
        <div>
          <div class="muted">Search Text</div>
          <input id="query" placeholder="blink, imu, wifi" />
        </div>
        <div>
          <div class="muted">Library name</div>
          <input id="library" placeholder="wire, serv" />
        </div>
      </div>
    </div>

    <div class="card">
      <div id="error" style="color:#ffb4b4; white-space:pre-wrap"></div>
      <div id="count" class="muted" style="margin-bottom:8px"></div>
      <div id="out" class="list"></div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);
      let rows = [];

      function esc(s) {
        return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      }

      function render() {
        const q = String($("query").value || "").trim().toLowerCase();
        const lib = String($("library").value || "").trim().toLowerCase();
        const filtered = rows.filter((r) => {
          const full = (r.library + " " + r.example + " " + r.fullPath).toLowerCase();
          const libMatch = !lib || r.library.toLowerCase().includes(lib);
          const textMatch = !q || full.includes(q);
          return libMatch && textMatch;
        });

        $("count").textContent = String(filtered.length) + " example sketches";
        if (filtered.length === 0) {
          $("out").innerHTML = "<div class='muted'>No example sketches found.</div>";
          return;
        }

        $("out").innerHTML = filtered.map((r) => {
          return "<div class='item' data-path='" + esc(r.fullPath) + "'><div class='title'>" + esc(r.example) + "</div><div class='meta'>" + esc(r.library) + "</div><div class='meta'>" + esc(r.fullPath) + "</div></div>";
        }).join("");

        document.querySelectorAll(".item").forEach((el) => {
          el.addEventListener("dblclick", () => {
            vscode.postMessage({ type: "openExample", path: el.getAttribute("data-path") || "" });
          });
        });
      }

      function maybeSearchOnEnter(ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          render();
        }
      }

      $("query").addEventListener("keydown", maybeSearchOnEnter);
      $("library").addEventListener("keydown", maybeSearchOnEnter);
      $("query").addEventListener("input", render);
      $("library").addEventListener("input", render);

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "error") {
          $("error").textContent = msg.error || "Unknown error";
        } else if (msg.type === "examples") {
          rows = Array.isArray(msg.rows) ? msg.rows : [];
          render();
        }
      });
    </script>
  </body>
</html>`;
  }
}
