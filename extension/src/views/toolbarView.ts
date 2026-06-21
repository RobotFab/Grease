/**
 * views/toolbarView.ts
 * ────────────────────
 * The Arduino Grease sidebar — the dark-themed "command center" the user
 * spends most of their time in. Implemented as a single VS Code WebviewView
 * (the kind that docks in the activity bar) with four tab panels:
 *
 *   • Board   — Port/FQBN status, action buttons (Start Sketch, Verify,
 *               Upload, Serial, Plotter, Examples, Managers, AI Prompt),
 *               and the MCP "AI Tether" toggle/health indicator.
 *   • Mngrs   — Embedded Boards & Libraries manager tabs.
 *   • X-mpls  — Example sketches browser (filterable by text/library).
 *   • Prompt  — AI prompt tips and template.
 *
 * The webview communicates with the extension via `postMessage`:
 *   webview → extension: { type: 'cmd', command }      (run a VS Code command)
 *                        { type: 'updateIndexes' }     (refresh boards/libs)
 *                        { type: 'boardSearch', query }
 *                        { type: 'chooseTarget', fqbn }
 *                        { type: 'libInstallSelected', name }
 *                        { type: 'libInstallGit', input }
 *                        { type: 'boardCatalogInstall', entry }
 *                        ...etc
 *   extension → webview: { type: 'state', state }      (port/fqbn/health/...)
 *                        { type: 'boards' | 'libraries' | 'examples', rows }
 *                        { type: 'rainState' | 'uploadResult' | 'verifyResult' }
 *
 * The "rain" you see flowing in the panel background is a small Matrix-style
 * canvas animation that reacts to mouse position and to upload events
 * (turning red on error, accelerating on success).
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { runArduinoCli, enableUnsafeInstall } from "../arduinoCli";
import { asRows, uniqueRows, type ExampleRow } from "../ui/examplesPanel";
import { parseInstalledBoards, parseLibraries } from "../ui/managersPanel";

/** Snapshot of extension state the webview reads to render itself. */
export interface ToolbarState {
  port: string | null;
  fqbn: string | null;
  connectedPorts: string[];
  serverRunning: boolean;
  serverHealthy: boolean;
  lastScanAtMs: number | null;
  serialActive: boolean;
  uploading?: boolean;
  accentColor?: string;
}

/** Callbacks the extension provides to the toolbar (so the panel can mutate extension state). */
export interface ToolbarActions {
  chooseTarget: (fqbn: string) => Promise<void>;
  uploadFirmwareToTarget: (fqbn: string) => Promise<void>;
  recoveryUpload: () => Promise<void>;
  serialOff: () => Promise<void>;
  cycleAccent: (color: string) => Promise<void>;
  /** Called after a library install completes successfully. */
  onLibraryInstalled?: () => Promise<void>;
  /** Called after a board core is installed via the Managers tab — triggers immediate re-detection. */
  onBoardInstalled?: () => Promise<void>;
}

export class ArduinoToolbarViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "arduinoMcp.toolbar";
  view: vscode.WebviewView | null = null;

  private state: ToolbarState = {
    port: null,
    fqbn: null,
    connectedPorts: [],
    serverRunning: false,
    serverHealthy: false,
    lastScanAtMs: null,
    serialActive: false,
  };

  constructor(
    private context: vscode.ExtensionContext,
    private output: vscode.OutputChannel,
    private actions: ToolbarActions,
  ) {}

  setState(next: ToolbarState): void {
    this.state = next;
    this.postState();
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.title = "";
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "resources")],
    };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    this.postState();
  }

  private postState(): void {
    this.view?.webview.postMessage({ type: "state", state: this.state });
  }

  /** Dispatcher for messages arriving from the webview script. */
  private async onMessage(msg: any): Promise<void> {
    if (!msg?.type) return;

    // Generic "run a registered VS Code command" pipe.
    if (msg.type === "cmd") {
      const command = String(msg.command ?? "");
      if (!command) return;
      await vscode.commands.executeCommand(command);
      return;
    }

    // The examples tab inside the toolbar reuses the standalone panel's helpers.
    if (msg.type === "list") {
      try {
        const argsBase = ["lib", "examples", "--json"];
        const base = await runArduinoCli(argsBase);
        if (!base.success)
          throw new Error(base.stderr || base.stdout || "Failed to list examples");
        let rows: ExampleRow[] = asRows(JSON.parse(base.stdout));
        const fqbn = this.state.fqbn;
        if (fqbn) {
          const b = await runArduinoCli(["lib", "examples", "--fqbn", fqbn, "--json"]);
          if (b.success) rows = rows.concat(asRows(JSON.parse(b.stdout)));
        }
        this.view?.webview.postMessage({ type: "examples", rows: uniqueRows(rows) });
      } catch (e) {
        this.view?.webview.postMessage({
          type: "exError",
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return;
    }

    if (msg.type === "openExample") {
      const dir = String(msg.path ?? "").trim();
      if (!dir) return;
      const name = path.basename(dir);
      const preferred = path.join(dir, name + ".ino");
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
      await vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession");
      vscode.window
        .showInformationMessage(
          "This is a read-only example. Save a copy to edit it.",
          "Save As New Sketch",
        )
        .then((choice) => {
          if (choice === "Save As New Sketch")
            vscode.commands.executeCommand("workbench.action.files.saveAs");
        });
      return;
    }

    const post = (payload: any): void => void this.view?.webview.postMessage(payload);
    try {
      if (msg.type === "updateIndexes") {
        this.output.appendLine("[Mngrs] Updating board and library indexes...");
        const res1 = await runArduinoCli(["update"]);
        this.output.appendLine(res1.stdout);
        this.output.appendLine(res1.stderr);
        const boards = await runArduinoCli(["core", "list", "--json"]);
        if (boards.success) {
          const rows = parseInstalledBoards(boards.stdout);
          post({ type: "boards", rows });
          this.output.appendLine(`[Mngrs] Loaded ${rows.length} installed boards.`);
        } else {
          post({ type: "mgrError", error: "Failed. See Output > Arduino Grease." });
        }
      } else if (msg.type === "boardSearch") {
        const boards = await runArduinoCli(["core", "list", "--json"]);
        if (!boards.success) {
          post({ type: "mgrError", error: "Failed. See Output > Arduino Grease." });
          return;
        }
        post({
          type: "boards",
          rows: parseInstalledBoards(boards.stdout),
          query: String(msg.query ?? ""),
        });
      } else if (msg.type === "chooseTarget") {
        const fqbn = String(msg.fqbn ?? "").trim();
        if (!fqbn) {
          post({ type: "mgrError", error: "Select a board first." });
          return;
        }
        this.output.appendLine(`[Mngrs] Choosing target ${fqbn}...`);
        await this.actions.chooseTarget(fqbn);
      } else if (msg.type === "uploadFirmwareToTarget") {
        const fqbn = String(msg.fqbn ?? "").trim();
        if (!fqbn) {
          post({ type: "mgrError", error: "Select a board first." });
          return;
        }
        this.output.appendLine(`[Mngrs] Upload firmware to target ${fqbn}...`);
        await this.actions.uploadFirmwareToTarget(fqbn);
      } else if (msg.type === "recoveryUpload") {
        await this.actions.recoveryUpload();
      } else if (msg.type === "libList") {
        this.output.appendLine("[Mngrs] Updating library index...");
        const upd = await runArduinoCli(["lib", "update-index"]);
        this.output.appendLine(upd.stdout);
        this.output.appendLine(upd.stderr);
        const res = await runArduinoCli(["lib", "list", "--json"]);
        if (!res.success) {
          post({ type: "mgrError", error: res.stderr || res.stdout });
          return;
        }
        post({ type: "libraries", rows: parseLibraries(res.stdout) });
      } else if (msg.type === "libSearch") {
        const q = String(msg.query ?? "").trim();
        const res = await runArduinoCli(["lib", "search", q, "--json"]);
        if (!res.success) {
          post({ type: "mgrError", error: res.stderr || res.stdout });
          return;
        }
        post({ type: "libraries", rows: parseLibraries(res.stdout) });
      } else if (msg.type === "libInstallSelected") {
        const name = String(msg.name ?? "").trim();
        if (!name) {
          post({ type: "mgrError", error: "Select a library first." });
          return;
        }
        this.output.appendLine(`[Mngrs] Installing library ${name}...`);
        await enableUnsafeInstall();
        const res = await runArduinoCli(["lib", "install", name]);
        this.output.appendLine(res.stdout);
        this.output.appendLine(res.stderr);
        if (!res.success) {
          post({ type: "mgrError", error: res.stderr || res.stdout });
        } else {
          vscode.window.showInformationMessage(`Arduino Grease: Library ${name} installed.`);
          if (this.actions.onLibraryInstalled) {
            await this.actions.onLibraryInstalled();
          }
        }
      } else if (msg.type === "toggleSerial") {
        await vscode.commands.executeCommand("arduinoMcp.toggleSerial");
      } else if (msg.type === "libInstallGit") {
        const input = String(msg.input ?? "").trim();
        if (!input) return;
        this.output.appendLine(`[Mngrs] Installing library from Github: ${input}...`);
        const url = `https://github.com/${input}.git`;
        await enableUnsafeInstall();
        const res = await runArduinoCli(["lib", "install", "--git-url", url]);
        this.output.appendLine(res.stdout);
        this.output.appendLine(res.stderr);
        if (!res.success) {
          post({ type: "mgrError", error: res.stderr || res.stdout });
        } else {
          vscode.window.showInformationMessage(`Arduino Grease: Library ${input} installed.`);
          if (this.actions.onLibraryInstalled) {
            await this.actions.onLibraryInstalled();
          }
        }
      } else if (msg.type === "boardCatalogInstall") {
        const entry = msg.entry;
        if (!entry?.installCommand) {
          post({ type: "mgrError", error: "Invalid board entry." });
          return;
        }
        this.output.appendLine(`[Mngrs] Installing board platform: ${entry.name}...`);
        if (entry.url) {
          const addUrl = await runArduinoCli([
            "config",
            "add",
            "board_manager.additional_urls",
            entry.url,
          ]);
          this.output.appendLine(addUrl.stdout);
          this.output.appendLine(addUrl.stderr);
          await runArduinoCli(["update"]);
        }
        const resCore = await runArduinoCli(["core", "install", entry.installCommand]);
        this.output.appendLine(resCore.stdout);
        this.output.appendLine(resCore.stderr);
        if (!resCore.success) {
          post({ type: "mgrError", error: resCore.stderr || resCore.stdout });
        } else {
          vscode.window.showInformationMessage(`Arduino Grease: ${entry.name} installed.`);
          const boards2 = await runArduinoCli(["core", "list", "--json"]);
          if (boards2.success)
            post({ type: "boards", rows: parseInstalledBoards(boards2.stdout) });
          if (this.actions.onBoardInstalled) await this.actions.onBoardInstalled();
        }
      } else if (msg.type === "serialOff") {
        await this.actions.serialOff();
      } else if (msg.type === "cycleAccent") {
        const color = String(msg.color ?? "#007ACC");
        await this.actions.cycleAccent(color);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.output.appendLine(`[Mngrs] Error: ${err}`);
      post({ type: "mgrError", error: err });
    }
  }

  private html(webview: vscode.Webview): string {
    const iconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "resources", "icon.png"),
    );
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --muted: #4a9960; --ink: #c8ffd8; --bg: #080e0a; --panel: #0b120d; --stroke: #1a3322; --mono: Consolas, Menlo, Monaco, 'Courier New', monospace; }
  body { background: var(--bg); color: var(--ink); font-family: var(--mono); font-size: 11px; height: 100vh; overflow: hidden; }
  .panel-area { width: 100%; min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; position: relative; }
  canvas.rain { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  .panel-content { position: relative; z-index: 1; padding: 10px 10px 4px; overflow-y: auto; height: 100%; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  a { font-family: var(--mono); font-size: 11px; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0; margin: 0; display: inline; }
  a:hover { text-decoration: underline; }
  a.dim { color: var(--muted); } a.dim:hover { color: var(--ink); }
  a.c-green { color: #55efc4; } a.c-amber { color: #f6c542; } a.c-teal { color: #4ecdc4; }
  a.c-sky { color: #81ecec; } a.c-purple { color: #a29bfe; } a.c-blue { color: #74b9ff; }
  a.c-coral { color: #ff6b6b; } a.c-pink { color: #fd79a8; } a.c-std { color: var(--ink); }
  a.serial-on { color: #49c06b !important; text-decoration: underline !important; }
  .ascii-line { font-family: var(--mono); font-size: 11px; color: var(--ink); white-space: pre; line-height: 1.6; display: block; }
  .dim { color: var(--muted); }
  .actions-wrap { margin-top: 6px; }
  .act-row { padding: 1px 0 1px 2px; font-family: var(--mono); font-size: 10px; line-height: 1.8; white-space: pre; }
  .server-section { margin-top: 12px; font-family: var(--mono); font-size: 11px; color: var(--ink); }
  .server-line { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .sblock { font-size: 16px; line-height: 1; cursor: pointer; }
  .logo-area { margin-top: 12px; }
  .logo-img { display: block; width: 132px; opacity: 0.06; filter: brightness(2) saturate(0.3); }
  .logo-caption { font-family: var(--mono); font-size: 10px; color: #5bc8f5; margin-top: 3px; letter-spacing: 0.04em; }
  .logo-ascii { font-family: var(--mono); font-size: 9px; color: var(--muted); white-space: pre; line-height: 1.4; margin-top: 6px; opacity: 0.55; }

  .mgr-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
  .mgr-label { color: var(--muted); font-size: 10px; }
  .mgr-section { margin-bottom: 10px; }
  .mgr-section-title { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .mgr-card { border: 1px solid var(--stroke); background: var(--panel); border-radius: 6px; padding: 8px; }
  .mgr-card input { background: #050d07; color: var(--ink); border: 1px solid var(--stroke); border-radius: 4px; padding: 4px 6px; font-size: 11px; font-family: var(--mono); width: 100%; margin-bottom: 6px; }
  .mgr-card input:focus { outline: none; border-color: var(--muted); }
  .mgr-top-row { margin-bottom: 7px; font-family: var(--mono); font-size: 10px; display: flex; gap: 14px; flex-wrap: wrap; }
  .mgr-list { max-height: 160px; overflow-y: auto; }
  .mgr-item { padding: 5px 6px; border: 1px solid var(--stroke); border-radius: 4px; margin-bottom: 3px; cursor: pointer; font-size: 10px; background: #050d07; }
  .mgr-item:hover { border-color: #58aa58; }
  .mgr-item .name { color: var(--ink); font-weight: bold; }
  .mgr-item .meta { color: var(--muted); }
</style>
</head>
<body>
<div class="panel-area" id="panelArea">
    <canvas class="rain" id="rainCanvas"></canvas>
    <div class="panel-content">

      <div class="tab-panel active" id="panel-board">
        <span class="ascii-line"><span class="dim">+------------ -  -   +</span></span>
        <span class="ascii-line"><span class="dim">| Port:     </span><a class="dim" href="#" onclick="cmd('arduinoMcp.refreshPortsBoards');return false">||R||</a></span>
        <span class="ascii-line"><span class="dim">| </span><span id="portVal">?</span></span>
        <span class="ascii-line"><span class="dim">| Board:</span></span>
        <span class="ascii-line"><span class="dim">| </span><span id="fqbnVal">?</span></span>
        <span class="ascii-line"><span class="dim">+   -   -  - --------+</span></span>
        <div class="actions-wrap">
          <div class="act-row"><span class="dim">+-------------- -  -   +</span></div>
          <div class="act-row"> <a class="c-teal"  href="#" onclick="cmd('arduinoMcp.startSketch');return false">||Start Sketch||</a></div>
          <div class="act-row"> <a class="c-coral"  href="#" onclick="onUploadClick();return false">||Upload||</a></div>
          <div class="act-row"> <a class="c-teal"   href="#" onclick="cmd('arduinoMcp.verify');return false">||Verify||</a></div>
          <div class="act-row"> <a id="serialBtn" class="c-blue" href="#" onclick="toggleSerial();return false">||Serial||</a></div>
          <div class="act-row"> <a class="c-teal" href="#" onclick="cmd('arduinoMcp.openSerialPlotter');return false">||Plotter||</a></div>
          <div class="act-row"> <a class="c-blue"   href="#" onclick="switchTab('examples');return false">||Examples||</a></div>
          <div class="act-row"> <a class="c-teal"  href="#" onclick="switchTab('managers');return false">||Managers||</a></div>
          <div class="act-row"> <a class="c-purple"   href="#" onclick="switchTab('prompt');return false">||AI Prompt||</a></div>
          <div class="act-row"><span class="dim">+   -   -  - ----------+</span></div>
        </div>
        <div class="server-section">
          AI Tether <a class="dim" href="#" onclick="cmd('arduinoMcp.refreshServer');return false">||R||</a>
          <div class="server-line">
            <span class="sblock serverBlock" style="color:#49c06b" onclick="cmd('arduinoMcp.toggleServer')">&#x2588;</span>
            <span style="color:var(--muted);font-size:10px" class="serverStatus">running</span>
          </div>
          <div class="server-line" style="margin-top:6px">
            <span class="sblock" id="accentBlock" style="color:#007ACC;cursor:pointer;font-size:16px;line-height:1" onclick="cycleAccent()" title="Click to cycle accent color">&#x2588;</span>
          </div>
        </div>
        <div class="logo-area">
          <img class="logo-img" id="logoImg" src="${iconUri}" draggable="false" />
        </div>
      </div>

      <div class="tab-panel" id="panel-managers">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>Mngrs</span>
          <a class="c-std" id="updateIdx" href="#" onclick="event.preventDefault()">||Update indexes||</a>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Board</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" id="chooseTargetBtn" href="#" onclick="event.preventDefault()">||Choose as target||</a>
              <a class="c-coral" id="recoveryUploadBtn" href="#" onclick="event.preventDefault()">||Recovery Upload||</a>
            </div>
            <input id="boardQuery" class="boardQuery" placeholder="arduino, esp32, rp2040..." />
            <div class="mgr-list" id="boardsList"></div>
            <a class="c-amber" id="installBoardBtn" href="#" onclick="event.preventDefault()" style="font-size:10px;margin-top:6px;display:block">||Install new board||</a>
          </div>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Library</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" id="libListBtn" href="#" onclick="event.preventDefault()">||List installed||</a>
              <a class="c-green" id="libInstallBtn" href="#" onclick="event.preventDefault()">||Install library||</a>
            </div>
            <input id="libQuery" class="libQuery" placeholder="wire, servo, wifi..." />
            <div class="mgr-list" id="libsList"></div>
          </div>
        </div>
        <div class="mgr-card" style="margin-top: 9px;">
          <div class="muted" style="font-size: 10px; margin-bottom: 4px;">
            Install library from Github (e.g. arduino-libraries/WiFi101)
          </div>
          <input id="libGitInput" placeholder="user/repo" onkeydown="if(event.key==='Enter') { vscode.postMessage({type:'libInstallGit', input:this.value}); this.value=''; }" />
        </div>
      </div>

      <div class="tab-panel" id="panel-examples">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>X-mpls</span>
          <a class="c-std" href="#" onclick="vscode.postMessage({type:'list',library:''});return false">&#8635;</a>
        </div>
        <div class="mgr-card" style="margin-bottom:6px">
          <div style="display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap">
            <div style="flex:1;min-width:70px">
              <div class="muted" style="font-size:9px;margin-bottom:2px">Search Text</div>
              <input id="exQuery" placeholder="blink, imu, wifi" oninput="renderEx()" onkeydown="if(event.key==='Enter')renderEx()" />
            </div>
            <div style="flex:1;min-width:70px">
              <div class="muted" style="font-size:9px;margin-bottom:2px">Library name</div>
              <input id="exLibrary" placeholder="wire, servo" oninput="renderEx()" onkeydown="if(event.key==='Enter')renderEx()" />
            </div>
          </div>
        </div>
        <div id="exError" style="color:#ffb4b4;white-space:pre-wrap;font-size:10px;margin-bottom:4px"></div>
        <div id="exCount" class="muted" style="font-size:9px;margin-bottom:4px">loading...</div>
        <div id="exOut" class="mgr-list" style="max-height:416px"></div>
      </div>

      <div class="tab-panel" id="panel-prompt">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>AI Prompt Template</span>
        </div>
        <div class="mgr-section">
          <div class="mgr-card" style="padding: 10px; font-size: 10px; line-height: 1.4; color: var(--muted);">
            <p>Please stretch your panel and read this! Important! </p>
            <br>
            <p> Your AI Agent needs greasing and structure!</p>
            <p style="margin-top: 8px;">If your AI Tether is active and "arduino-cli" is on PATH, its time to make sure your AI Agent "knows" it can use it. Try the following as a Prompt: </p>
            <br>
            <div style="margin-top: 8px; color: var(--ink); border-left: 2px solid var(--muted); padding-left: 8px;">
              Use &lt;IDE-Extension&gt; Arduino Grease &lt;/IDE-Extension&gt; to filter incoming A0 signals: read them via its MCP server, generate a new sketch, upload it. Check dist/SKILL.md and dist/server.mjs inside the extension folder for REST endpoints and skills. GET /state returns the current board/port. Auth key lives in ~/.grease/extension/mcp-auth.json — send it as the x-grease-auth header.
            </div>
            <br>
            <p> When running your sketches, try to use the following XML tags to emphasize goals, electronic hardware, mechanical components or control preferences. One example below:</p>
            <div style="margin-top: 8px; color: var(--ink); border-left: 2px solid var(--muted); padding-left: 8px;">
              Write a program to &lt;goal&gt; stack 5 cups &lt;/goal&gt;. I am using &lt;hw&gt; 2 servo motors and one 3-pin temperature sensor. My orange wire is on pin 13&lt;/hw&gt;.
              <br><br>
              My robot has &lt;mech&gt; a 2 inch wheel &lt;/mech&gt; and is using &lt;control&gt; a PD controller &lt;/control&gt;
            </div>
            <p style="margin-top: 8px;">
              You can also create your own skills (for example, a skill &lt;learning&gt; could specify a preferred deep Q-learning strategy, or &lt;references&gt; could aggregate datasheets from different modules).
            </p>
            <br>
            <p>
              Make sure your AI Tether is running, and that you clearly prompt the logic flow needed to achieve your goal.
            </p>
          </div>
        </div>
        <div class="server-section" style="margin-top: 8px;">
          AI Tether <a class="dim" href="#" onclick="cmd('arduinoMcp.refreshServer');return false">||R||</a>
          <div class="server-line">
            <span class="sblock serverBlock" style="color:#49c06b" onclick="cmd('arduinoMcp.toggleServer')">&#x2588;</span>
            <span style="color:var(--muted);font-size:10px" class="serverStatus">running</span>
          </div>
        </div>
      </div>

    </div>
</div>

<script>
const vscode = acquireVsCodeApi();

function cmd(command) { vscode.postMessage({ type: 'cmd', command: command }); }

function switchTab(panel) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panelEl = document.getElementById('panel-' + panel);
  if (panelEl) panelEl.classList.add('active');
  rainActive = (panel === 'board' || panel === 'managers' || panel === 'examples' || panel === 'prompt');
  if (panel === 'managers') { vscode.postMessage({type:'serialOff'}); vscode.postMessage({type:'updateIndexes'}); vscode.postMessage({type:'libList'}); }
  if (panel === 'examples') { vscode.postMessage({type:'serialOff'}); vscode.postMessage({type:'list',library:''}); }
}

const ACCENT_COLORS = ['#005FA0','#6B0000','#A34300','#8F6809','#6B004A','#520A85','#004D00'];
let accentIndex = 0;
function cycleAccent() {
  accentIndex = (accentIndex + 1) % ACCENT_COLORS.length;
  const color = ACCENT_COLORS[accentIndex];
  const block = document.getElementById('accentBlock');
  if (block) block.style.color = color;
  vscode.postMessage({ type: 'cycleAccent', color: color });
}

const rainCanvas = document.getElementById('rainCanvas');
const rctx = rainCanvas.getContext('2d');
const panelArea = document.getElementById('panelArea');
const CHARS = 'abcdefghijklmnopqrstuvwxyzNH01+=-./\\\\[]{}()?!<>:;'.split('');
const COL = 13;
let drops=[], W=0, H=0, mouseX=-999, mouseY=-999, rainActive=true;
let thrustOpacityBoost = 0, thrustSpeedMult = 1.0;

function resizeRain(){
  const r=panelArea.getBoundingClientRect();W=r.width||300;H=r.height||660;rainCanvas.width=W;rainCanvas.height=H;
  const cols=Math.floor(W/COL);
  if(drops.length!==cols)drops=Array.from({length:cols},()=>({y:H*Math.random(), o:0, blue:false, halted:false}));
}
panelArea.addEventListener('mousemove',e=>{const r=rainCanvas.getBoundingClientRect();mouseX=e.clientX-r.left;mouseY=e.clientY-r.top;});
panelArea.addEventListener('mouseleave',()=>{mouseX=-999;mouseY=-999;});
let rainState='idle',extraDrops=[],thrustRightTimer=null,errorTimer=null;

function setRainState(s){
  rainState=s;
  if(s==='thrust'){
    thrustOpacityBoost = 0.7;
  }
  if(s!=='thrust'){
    extraDrops=[];
    thrustOpacityBoost = 0;
    thrustSpeedMult = 1.0;
    drops.forEach(d => { d.o = 0; d.blue = false; d.halted = false; });
  }
  if(errorTimer){clearTimeout(errorTimer);errorTimer=null;}
  if(s==='error'){errorTimer=setTimeout(()=>{errorTimer=null;setRainState('idle');},5000);}
}

function drawRain(){
  if(!rainActive){rctx.clearRect(0,0,W,H);return;}
  rctx.fillStyle='rgba(8,14,10,0.28)';rctx.fillRect(0,0,W,H);
  const st=rainState;
  const bRGB=st==='error'?'210,30,30':'0,210,80';
  const hRGB=st==='error'?'255,100,100':'140,255,170';

  function drop(d,x){
    const dx=x-mouseX,dy=d.y-mouseY,dist=Math.sqrt(dx*dx+dy*dy);
    const inSlow = dist < 60;
    const inHalt = dist < 15;

    if(inHalt && !d.halted){
      d.halted = true;
      d.o = (d.o || 0) + 0.1;
      d.blue = true;
    } else if(!inHalt) {
      d.halted = false;
    }

    let bo,ho,fz,sp;
    if(st==='error'){bo=0.30;ho=0.30;fz=13;sp=0;}
    else if(st==='bright'){bo=Math.min(1,(inSlow?0.40:0.03)+0.12);ho=Math.min(1,(inSlow?0.80:0.10)+0.50);fz=13;sp=inSlow?(3+(60-dist)*0.08):(1.2+Math.random()*0.6);}
    else if(st==='thrust'){
      if(d.rocket){
        bo=0.7; ho=0.7; fz=14; sp=35;
      } else {
        bo=0.7;
        ho=0.7;
        fz=inSlow?13:12;
        const normalSp = 7.5 * thrustSpeedMult;
        sp = inHalt ? 0 : (inSlow ? (1.2 + Math.random() * 0.6) : normalSp);
      }
    }
    else{bo=Math.min(1,(inSlow?0.40:0.03)+d.o); ho=Math.min(1,(inSlow?0.80:0.10)+d.o); fz=inSlow?13:12; sp=inSlow?(3+(60-dist)*0.08):(1.2+Math.random()*0.6);}

    if(d.y < -20) d.rocket = false;
    const finalBRGB = d.blue ? '0,100,210' : bRGB;
    const finalHRGB = d.blue ? '80,160,255' : hRGB;

    rctx.font=fz+'px Consolas,monospace';
    rctx.fillStyle='rgba('+finalBRGB+','+Math.min(1,bo)+')';rctx.fillText(CHARS[Math.floor(Math.random()*CHARS.length)],x,d.y);
    rctx.fillStyle='rgba('+finalHRGB+','+Math.min(1,ho)+')';rctx.fillText(CHARS[Math.floor(Math.random()*CHARS.length)],x,d.y-13);
    return sp;
  }

  for(let i=0;i<drops.length;i++){
    const sp=drop(drops[i], i*COL+4);
    drops[i].y-=sp;
    if(drops[i].y<-26)drops[i].y=H+Math.floor(Math.random()*80);
    if(st==='thrust'){
      drop({y:drops[i].y+H/3, o:drops[i].o, blue:drops[i].blue, halted:drops[i].halted}, i*COL+4+3);
      drop({y:drops[i].y+2*H/3, o:drops[i].o, blue:drops[i].blue, halted:drops[i].halted}, i*COL+4-3);
    }
  }
  if(st==='thrust'){for(let i=0;i<extraDrops.length;i++){const d=extraDrops[i];const sp=drop(d, d.x);d.y-=sp;if(d.y<-26)d.y=H+Math.floor(Math.random()*80);}}
}
resizeRain();new ResizeObserver(resizeRain).observe(panelArea);setInterval(drawRain,50);
document.addEventListener('mousedown',e=>{
  if(rainState === 'idle' && e.target.closest('a')) setRainState('bright');
  if(rainState === 'thrust' && e.button === 0){
    const r=rainCanvas.getBoundingClientRect();
    const cx=e.clientX-r.left, cy=e.clientY-r.top;
    for(let i=0;i<drops.length;i++){
      const dx=(i*COL+4)-cx, dy=drops[i].y-cy;
      if(Math.sqrt(dx*dx+dy*dy)<25) drops[i].rocket=true;
    }
    for(let i=0;i<extraDrops.length;i++){
      const dx=extraDrops[i].x-cx, dy=extraDrops[i].y-cy;
      if(Math.sqrt(dx*dx+dy*dy)<25) extraDrops[i].rocket=true;
    }
    thrustRightTimer = setInterval(()=>{
      if(extraDrops.length < drops.length * 8) {
        for(let i=0; i<drops.length; i++) extraDrops.push({x:Math.random()*W, y:Math.random()*H, o:0, blue:false, halted:false});
      }
    }, 500);
  }
});
document.addEventListener('mouseup',e=>{
  if(rainState==='bright')setRainState('idle');
  if(e.button===0&&thrustRightTimer){clearInterval(thrustRightTimer);thrustRightTimer=null;}
});
document.addEventListener('contextmenu',e=>{if(rainState==='thrust')e.preventDefault();});


function toggleSerial() { vscode.postMessage({ type: 'toggleSerial' }); }
function setServer(state) {
  const blocks = document.querySelectorAll('.serverBlock');
  const statuses = document.querySelectorAll('.serverStatus');
  blocks.forEach(block => {
    if (!state.serverRunning) block.style.color='#593b3bff';
    else if (state.serverHealthy) block.style.color='#49c06b';
    else block.style.color='#d2b046';
  });
  statuses.forEach(status => {
    if (!state.serverRunning) status.textContent='stopped';
    else if (state.serverHealthy) status.textContent='running';
    else status.textContent='starting...';
  });
}

let exRows = [];
function renderEx() {
  const q = (document.getElementById('exQuery')?.value || '').trim().toLowerCase();
  const lib = (document.getElementById('exLibrary')?.value || '').trim().toLowerCase();
  const filtered = exRows.filter(r => {
    const full = (r.library + ' ' + r.example + ' ' + r.fullPath).toLowerCase();
    return (!lib || r.library.toLowerCase().includes(lib)) && (!q || full.includes(q));
  });
  const countEl = document.getElementById('exCount');
  const outEl = document.getElementById('exOut');
  if (countEl) countEl.textContent = filtered.length + ' example sketches';
  if (!outEl) return;
  if (!filtered.length) { outEl.innerHTML = '<div class="muted" style="font-size:10px">No examples found.</div>'; return; }
  outEl.innerHTML = filtered.map(r =>
    '<div class="mgr-item" style="cursor:pointer" data-path="' + esc(r.fullPath) + '">' +
    '<div class="name">' + esc(r.example) + '</div>' +
    '<div class="meta">' + esc(r.library) + '</div></div>'
  ).join('');
  outEl.querySelectorAll('.mgr-item').forEach(el => {
    el.addEventListener('click', () => vscode.postMessage({type:'openExample', path: el.getAttribute('data-path') || ''}));
  });
}

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'state') {
    const s = msg.state || {};
    document.getElementById('portVal').textContent = s.port || '?';
    const fqbnVal = s.fqbn || '?';
    document.getElementById('fqbnVal').textContent = fqbnVal;
    if (fqbnVal === '?') {
      document.getElementById('fqbnVal').innerHTML += '<br><span style="font-size:8px;color:#ffb4b4;line-height:1.2">Unknown board. Access ||Managers||.</span>';
    }
    setServer(s);
    const sBtn = document.getElementById('serialBtn');
    if (sBtn) {
      if (s.serialActive) sBtn.classList.add('serial-on');
      else sBtn.classList.remove('serial-on');
    }
    if (s.accentColor) {
      const block = document.getElementById('accentBlock');
      if (block) block.style.color = s.accentColor;
      const idx = ACCENT_COLORS.indexOf(s.accentColor);
      if (idx !== -1) accentIndex = idx;
    }
  } else if (msg.type === 'accentColor') {
    const block = document.getElementById('accentBlock');
    if (block) block.style.color = msg.color;
    const idx = ACCENT_COLORS.indexOf(msg.color);
    if (idx !== -1) accentIndex = idx;
  } else if (msg.type === 'verifyResult') {
    if(msg.success && rainState === 'thrust') {
      thrustOpacityBoost += 0.1;
      thrustSpeedMult *= 3;
    }
  } else if (msg.type === 'examples') {
    exRows = Array.isArray(msg.rows) ? msg.rows : [];
    const errEl = document.getElementById('exError');
    if (errEl) errEl.textContent = '';
    renderEx();
  } else if (msg.type === 'exError') {
    const errEl = document.getElementById('exError');
    if (errEl) errEl.textContent = msg.error || 'Unknown error';
  } else if (msg.type === 'uploadResult') {
    setRainState(msg.success ? 'idle' : 'error');
  } else if (msg.type === 'rainState') {
    setRainState(msg.state);
  } else if (msg.type === 'boards') {
    boards = Array.isArray(msg.rows) ? msg.rows : [];
    if (!selectedFqbn && boards.length) selectedFqbn = boards[0].fqbn;
    if (typeof msg.query === "string") boardQuery = msg.query;
    boardMode = 'installed';
    selectedCatalogId = null;
    const iBtn = document.getElementById('installBoardBtn');
    if (iBtn) iBtn.textContent = '||Install new board||';
    renderBoards();
  } else if (msg.type === 'libraries') {
    libs = Array.isArray(msg.rows) ? msg.rows : [];
    if (!selectedLib && libs.length) selectedLib = libs[0].name;
    renderLibs();
  } else if (msg.type === 'mgrError') {
    const el = document.getElementById('mgrErr');
    if (el) el.textContent = msg.error || '';
  }
});

let boards = [];
let libs = [];
let selectedFqbn = "";
let selectedLib = "";
let boardQuery = "";
let boardMode = 'installed';
let selectedCatalogId = null;
const BOARD_CATALOG = [
  {id:"esp8266:esp8266",name:"ESP8266 Boards",vendor:"ESP8266 Community",tags:["wifi","iot","nodemcu","wemos","esp8266"],url:"https://arduino.esp8266.com/stable/package_esp8266com_index.json",installCommand:"esp8266:esp8266",exampleBoards:["NodeMCU 1.0","Wemos D1 Mini","Generic ESP8266"]},
  {id:"esp32:esp32",name:"ESP32 Boards (Espressif)",vendor:"Espressif",tags:["wifi","bluetooth","iot","esp32","s2","s3","c3"],url:"https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json",installCommand:"esp32:esp32",exampleBoards:["ESP32 Dev Module","ESP32-S3","ESP32-C3","XIAO ESP32S3"]},
  {id:"rp2040:rp2040",name:"Raspberry Pi Pico / RP2040",vendor:"Earle Philhower",tags:["rp2040","pico","raspberry pi","arm"],url:"https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json",installCommand:"rp2040:rp2040",exampleBoards:["Raspberry Pi Pico","Raspberry Pi Pico W","Adafruit Feather RP2040"]},
  {id:"arduino:mbed_rp2040",name:"Raspberry Pi Pico (Arduino Official)",vendor:"Arduino",tags:["rp2040","pico","mbed","arm"],url:null,installCommand:"arduino:mbed_rp2040",exampleBoards:["Raspberry Pi Pico"]},
  {id:"adafruit:avr",name:"Adafruit AVR Boards",vendor:"Adafruit",tags:["adafruit","avr","flora","gemma","trinket","wearable"],url:"https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",installCommand:"adafruit:avr",exampleBoards:["Adafruit Flora","Adafruit Gemma","Adafruit Trinket"]},
  {id:"adafruit:samd",name:"Adafruit SAMD Boards",vendor:"Adafruit",tags:["adafruit","samd","feather","m0","m4","circuit playground"],url:"https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",installCommand:"adafruit:samd",exampleBoards:["Feather M0","Feather M4 Express","ItsyBitsy M4"]},
  {id:"adafruit:nrf52",name:"Adafruit nRF52 Boards",vendor:"Adafruit",tags:["adafruit","nrf52","bluetooth","ble","nordic"],url:"https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",installCommand:"adafruit:nrf52",exampleBoards:["Feather nRF52840 Express"]},
  {id:"SparkFun:avr",name:"SparkFun AVR Boards",vendor:"SparkFun",tags:["sparkfun","avr","redboard","pro micro","lilypad"],url:"https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/IDE_Board_Manager/package_sparkfun_index.json",installCommand:"SparkFun:avr",exampleBoards:["SparkFun RedBoard","SparkFun Pro Micro"]},
  {id:"SparkFun:samd",name:"SparkFun SAMD Boards",vendor:"SparkFun",tags:["sparkfun","samd","samd21","thing plus"],url:"https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/IDE_Board_Manager/package_sparkfun_index.json",installCommand:"SparkFun:samd",exampleBoards:["SparkFun SAMD21 Mini","SparkFun Thing Plus"]},
  {id:"STMicroelectronics:stm32",name:"STM32 Boards",vendor:"STMicroelectronics",tags:["stm32","nucleo","blue pill","arm","cortex-m"],url:"https://raw.githubusercontent.com/stm32duino/BoardManagerFiles/main/package_stmicroelectronics_index.json",installCommand:"STMicroelectronics:stm32",exampleBoards:["Nucleo-64","Generic STM32F1","Blue Pill"]},
  {id:"ATTinyCore:avr",name:"ATtiny Boards",vendor:"Community",tags:["attiny","attiny85","attiny84","avr","bare chip"],url:"https://raw.githubusercontent.com/damellis/attiny/ide-1.6.x-boards-manager/package_damellis_attiny_index.json",installCommand:"ATTinyCore:avr",exampleBoards:["ATtiny85","ATtiny84","ATtiny45"]},
  {id:"MiniCore:avr",name:"MiniCore (MCUdude)",vendor:"MCUdude",tags:["avr","atmega328","atmega168","bare chip"],url:"https://mcudude.github.io/MiniCore/package_MCUdude_MiniCore_index.json",installCommand:"MiniCore:avr",exampleBoards:["ATmega328","ATmega168","ATmega88"]},
  {id:"MegaCore:avr",name:"MegaCore (MCUdude)",vendor:"MCUdude",tags:["avr","atmega2560","mega","bare chip"],url:"https://mcudude.github.io/MegaCore/package_MCUdude_MegaCore_index.json",installCommand:"MegaCore:avr",exampleBoards:["ATmega2560","ATmega1280"]},
  {id:"MightyCore:avr",name:"MightyCore (MCUdude)",vendor:"MCUdude",tags:["avr","atmega1284","atmega644","bare chip"],url:"https://mcudude.github.io/MightyCore/package_MCUdude_MightyCore_index.json",installCommand:"MightyCore:avr",exampleBoards:["ATmega1284","ATmega644"]},
  {id:"Seeeduino:samd",name:"Seeed SAMD Boards",vendor:"Seeed Studio",tags:["seeed","xiao","wio terminal","samd"],url:"https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json",installCommand:"Seeeduino:samd",exampleBoards:["Seeeduino XIAO","Wio Terminal"]},
  {id:"Seeeduino:avr",name:"Seeed AVR Boards",vendor:"Seeed Studio",tags:["seeed","seeeduino","avr"],url:"https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json",installCommand:"Seeeduino:avr",exampleBoards:["Seeeduino v4.2","Seeeduino Lotus"]},
  {id:"SparkFun:apollo3",name:"SparkFun Apollo3 Boards",vendor:"SparkFun",tags:["sparkfun","artemis","apollo3","arm","ble"],url:"https://raw.githubusercontent.com/sparkfun/Arduino_Apollo3/master/package_sparkfun_apollo3_index.json",installCommand:"SparkFun:apollo3",exampleBoards:["SparkFun Artemis Thing Plus","RedBoard Artemis Nano"]}
];

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}

function renderBoards() {
  if (boardMode === 'catalog') { renderCatalogBoards(); return; }
  const filtered = boards.filter((b) => {
    const q = boardQuery.toLowerCase();
    if (!q) return true;
    return (b.name + " " + b.fqbn + " " + b.platform).toLowerCase().includes(q);
  });
  if (!filtered.length) {
    document.getElementById('boardsList').innerHTML = "<div class='muted' style='font-size:10px'>No installed boards found.</div>";
    return;
  }
  document.getElementById('boardsList').innerHTML = filtered.map((b) => {
    const border = selectedFqbn === b.fqbn ? "border-color: #58aa58; box-shadow: 0 0 0 1px #58aa58 inset;" : "";
    return "<div class='mgr-item' style='" + border + "' data-fqbn='" + esc(b.fqbn) + "'><div class='name'>" + esc(b.name) + "</div><div class='meta'>" + esc(b.fqbn) + " | " + esc(b.platform) + " @ " + esc(b.version) + "</div></div>";
  }).join("");
  document.querySelectorAll("#boardsList .mgr-item").forEach((el) => {
    el.addEventListener("click", () => {
      selectedFqbn = el.getAttribute("data-fqbn") || "";
      renderBoards();
    });
  });
}

function renderCatalogBoards() {
  const q = boardQuery.toLowerCase();
  const filtered = q ? BOARD_CATALOG.filter(b =>
    (b.name + ' ' + b.vendor + ' ' + b.tags.join(' ')).toLowerCase().includes(q)
  ) : BOARD_CATALOG;
  if (!filtered.length) {
    document.getElementById('boardsList').innerHTML = "<div class='muted' style='font-size:10px'>No matching boards.</div>";
    return;
  }
  document.getElementById('boardsList').innerHTML = filtered.map((b) => {
    const border = selectedCatalogId === b.id ? "border-color: #f6c542; box-shadow: 0 0 0 1px #f6c542 inset;" : "";
    return "<div class='mgr-item' style='" + border + "' data-catalog-id='" + esc(b.id) + "'><div class='name'>" + esc(b.name) + "</div><div class='meta'>" + esc(b.vendor) + " | " + esc(b.exampleBoards.slice(0,3).join(', ')) + "</div></div>";
  }).join("");
  document.querySelectorAll("#boardsList [data-catalog-id]").forEach((el) => {
    el.addEventListener("click", () => {
      selectedCatalogId = el.getAttribute("data-catalog-id") || "";
      renderCatalogBoards();
    });
    el.addEventListener("dblclick", () => {
      selectedCatalogId = el.getAttribute("data-catalog-id") || "";
      installSelectedCatalogBoard();
    });
  });
}

function installSelectedCatalogBoard() {
  if (!selectedCatalogId) return;
  const entry = BOARD_CATALOG.find(b => b.id === selectedCatalogId);
  if (!entry) return;
  const btn = document.getElementById('installBoardBtn');
  if (btn) btn.textContent = '||Installing...||';
  vscode.postMessage({ type: 'boardCatalogInstall', entry: { id: entry.id, name: entry.name, installCommand: entry.installCommand, url: entry.url } });
}

function renderLibs() {
  if (!libs.length) {
    document.getElementById('libsList').innerHTML = "<div class='muted' style='font-size:10px'>No libraries loaded.</div>";
    return;
  }
  document.getElementById('libsList').innerHTML = libs.map((l) => {
    const right = l.version || l.author || l.sentence || "";
    const border = selectedLib === l.name ? "border-color: #58aa58; box-shadow: 0 0 0 1px #58aa58 inset;" : "";
    return "<div class='mgr-item' style='" + border + "' data-lib='" + esc(l.name) + "'><div class='name'>" + esc(l.name) + "</div><div class='meta'>" + esc(right) + "</div></div>";
  }).join("");

  document.querySelectorAll("#libsList .mgr-item").forEach((el) => {
    el.addEventListener("click", () => {
      selectedLib = el.getAttribute("data-lib") || "";
      renderLibs();
    });
  });
}

const $ = (id) => document.getElementById(id);
$("updateIdx")?.addEventListener("click", () => {
  boardMode = 'installed';
  selectedCatalogId = null;
  const btn = $("installBoardBtn");
  if (btn) btn.textContent = '||Install new board||';
  vscode.postMessage({ type: "updateIndexes" });
});
$("boardQuery")?.addEventListener("keydown", (e) => {
  if(e.key === 'Enter') {
    boardQuery = $("boardQuery").value || "";
    if (boardMode === 'catalog') { renderCatalogBoards(); }
    else { vscode.postMessage({ type: "boardSearch", query: boardQuery }); }
  }
});
$("boardQuery")?.addEventListener("input", () => {
  if (boardMode === 'catalog') { boardQuery = $("boardQuery").value || ""; renderCatalogBoards(); }
});
$("installBoardBtn")?.addEventListener("click", () => {
  if (boardMode === 'installed') {
    boardMode = 'catalog';
    selectedCatalogId = null;
    boardQuery = $("boardQuery")?.value || "";
    const btn = $("installBoardBtn");
    if (btn) btn.textContent = '||Confirm install||';
    renderCatalogBoards();
  } else {
    installSelectedCatalogBoard();
  }
});
$("chooseTargetBtn")?.addEventListener("click", () => vscode.postMessage({ type: "chooseTarget", fqbn: selectedFqbn }));
$("recoveryUploadBtn")?.addEventListener("click", () => vscode.postMessage({ type: "recoveryUpload" }));
$("libListBtn")?.addEventListener("click", () => vscode.postMessage({ type: "libList" }));
$("libQuery")?.addEventListener("keydown", (e) => {
  if(e.key === 'Enter') {
    vscode.postMessage({ type: "libSearch", query: $("libQuery").value });
  }
});
$("libInstallBtn")?.addEventListener("click", () => vscode.postMessage({ type: "libInstallSelected", name: selectedLib }));

function onUploadClick(){setRainState('thrust');cmd('arduinoMcp.upload');}
    </script>
  </body>
</html>`;
  }
}
