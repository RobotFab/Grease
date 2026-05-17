"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode8 = __toESM(require("vscode"));
var os = __toESM(require("node:os"));
var path4 = __toESM(require("node:path"));
var fs3 = __toESM(require("node:fs"));

// src/serverProcess.ts
var import_node_child_process = require("node:child_process");
var path = __toESM(require("node:path"));
var net = __toESM(require("node:net"));
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
async function pickPort(preferred = 3333) {
  if (await canBind(preferred)) return preferred;
  for (let p = preferred + 1; p < preferred + 60; p++) {
    if (await canBind(p)) return p;
  }
  throw new Error("No free local port found for Arduino MCP server");
}
async function startBundledServer(context, output, preferredPort = 3333) {
  const port = await pickPort(preferredPort);
  const nodePath = process.env.ARDUINO_MCP_NODE_PATH || "node";
  const serverPath = context.asAbsolutePath(path.join("dist", "server.mjs"));
  const { randomBytes } = await import("node:crypto");
  let authKey;
  try {
    const stored = JSON.parse(fs3.readFileSync(path.join(os.homedir(), ".grease-mcp-auth"), "utf8"));
    authKey = stored.key || null;
  } catch (_e) {}
  if (!authKey) { authKey = randomBytes(24).toString("hex"); }
  output.appendLine(`Starting bundled Arduino MCP server on port ${port}...`);
  const child = (0, import_node_child_process.spawn)(nodePath, [serverPath], {
    cwd: context.extensionPath,
    env: { ...process.env, MCP_PORT: String(port), MCP_HOST: "127.0.0.1", MCP_AUTH_KEY: authKey },
    shell: false
  });
  child.stdout.on("data", (d) => output.appendLine(`[server] ${String(d).trimEnd()}`));
  child.stderr.on("data", (d) => output.appendLine(`[server:err] ${String(d).trimEnd()}`));
  child.on("exit", (code) => output.appendLine(`[server] exited with code ${code}`));
  await delay(250);
  if (child.exitCode !== null) {
    throw new Error(`Bundled server exited early with code ${child.exitCode}`);
  }
  return {
    port,
    authKey,
    stop: async () => {
      if (child.killed) return;
      child.kill("SIGTERM");
      await delay(200);
      if (!child.killed) child.kill("SIGKILL");
    }
  };
}

// src/boards.ts
var vscode = __toESM(require("vscode"));

// src/arduinoCli.ts
var import_node_child_process2 = require("node:child_process");
async function runArduinoCli(args, cwd) {
  const cmd = process.env.ARDUINO_CLI_PATH || "arduino-cli";
  return new Promise((resolve) => {
    const child = (0, import_node_child_process2.spawn)(cmd, args, { cwd, env: process.env, shell: os.platform() === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => stderr += d.toString());
    child.on("error", (err) => resolve({
      success: false, exitCode: null, stdout, stderr: `${stderr}
${String(err)}`
    }));
    child.on("close", (code) => resolve({ success: code === 0, exitCode: code, stdout, stderr }));
  });
}
async function updateIndexes() {
  return runArduinoCli(["core", "update-index"]);
}
async function installCore(pkg) {
  return runArduinoCli(["core", "install", pkg]);
}
function extractCoreFromFqbn(fqbn) {
  if (!fqbn || typeof fqbn !== "string") return null;
  const parts = fqbn.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return null;
}
async function isCoreInstalled(corePkg) {
  const result = await runArduinoCli(["core", "list", "--json"]);
  if (!result.success) return false;
  try {
    const parsed = JSON.parse(result.stdout);
    const platforms = Array.isArray(parsed?.platforms) ? parsed.platforms : [];
    for (const p of platforms) {
      const id = String(p?.id ?? "");
      if (id === corePkg) return true;
    }
  } catch { }
  return false;
}
async function generateCompileCommands(fqbn, sketchPath, outputChannel) {
  if (!fqbn || !sketchPath) return;
  try {
    const result = await runArduinoCli(["compile", "--fqbn", fqbn, "--only-compilation-database", sketchPath], sketchPath);
    if (result.success) {
      outputChannel.appendLine("[clangd] compile_commands.json generated for IntelliSense.");
    } else {
      outputChannel.appendLine("[clangd] Failed to generate compile_commands.json: " + result.stderr);
    }
  } catch (e) {
    outputChannel.appendLine("[clangd] Error generating compile_commands.json: " + (e instanceof Error ? e.message : String(e)));
  }
}
async function detectBoardCandidates() {
  const result = await runArduinoCli(["board", "list", "--format", "json"]);
  const raw = result.stdout;
  const stderr = result.stderr;
  if (!result.success) {
    return { success: false, candidates: [], raw, stderr };
  }
  const match = raw.match(/\{[\s\S]*\}\s*$/) || raw.match(/\[[\s\S]*\]\s*$/);
  const jsonStr = match ? match[0] : raw;
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      success: false, candidates: [], raw, stderr: `${stderr}
Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`
    };
  }
  const ports = Array.isArray(parsed?.detected_ports) ? parsed.detected_ports : [];
  const candidates = [];
  for (const p of ports) {
    const address = p?.port?.address;
    const protocol = p?.port?.protocol;
    const vid = p?.port?.properties?.vid ?? null;
    const pid = p?.port?.properties?.pid ?? null;
    const serialNumber = p?.port?.properties?.serialNumber ?? null;
    const matching = Array.isArray(p?.matching_boards) ? p.matching_boards : [];
    if (matching.length === 0) {
      if (typeof address === "string") {
        candidates.push({ port: address, protocol, vid, pid, serialNumber });
      }
      continue;
    }
    for (const b of matching) {
      candidates.push({
        port: address,
        protocol,
        fqbn: b?.fqbn,
        name: b?.name,
        vid,
        pid,
        serialNumber
      });
    }
  }
  return { success: true, candidates, raw, stderr };
}

// src/boards.ts
var TARGET_KEY = "arduinoMcp.target";
async function loadTarget(context) {
  return context.globalState.get(TARGET_KEY) ?? null;
}
async function saveTarget(context, target) {
  if (!target) {
    await context.globalState.update(TARGET_KEY, void 0);
    return;
  }
  await context.globalState.update(TARGET_KEY, target);
}
var BOARD_MEMORY_KEY = "arduinoMcp.boardMemory";
async function loadBoardMemory(context) {
  return context.globalState.get(BOARD_MEMORY_KEY) ?? {};
}
async function saveBoardMemory(context, memory) {
  await context.globalState.update(BOARD_MEMORY_KEY, memory);
}
function vidPidKey(vid, pid) {
  if (!vid || !pid) return null;
  return `${String(vid).toLowerCase()}:${String(pid).toLowerCase()}`;
}
function boardMemoryKeys(candidate) {
  const keys = [];
  if (candidate?.serialNumber) keys.push(`serial:${candidate.serialNumber}`);
  if (candidate?.vid && candidate?.pid) keys.push(vidPidKey(candidate.vid, candidate.pid));
  if (candidate?.fqbn) keys.push(`fqbn:${candidate.fqbn}`);
  return keys;
}
async function refreshBoards(output) {
  const result = await detectBoardCandidates();
  if (!result.success) {
    output.appendLine(`Board detect failed: ${result.stderr}`);
    return { success: false, candidates: [], stderr: result.stderr };
  }
  return { success: true, candidates: result.candidates };
}
function pickLabel(c) {
  const parts = [c.name || "Unknown board", c.fqbn ? `(${c.fqbn})` : "(no fqbn)", c.port];
  return parts.join("  ");
}
async function promptForTarget(context, candidates, currentTarget) {
  if (candidates.length === 0) return null;
  const items = candidates.map((c) => {
    const fqbn = typeof c.fqbn === "string" ? c.fqbn : null;
    return {
      label: pickLabel(c),
      description: fqbn ? void 0 : "Port detected (board unknown - install/select core)",
      target: { port: c.port, fqbn }
    };
  });
  if (currentTarget?.fqbn) {
    items.push({ kind: -1, label: "Change port only (keep current board)" });
    for (const c of candidates) {
      items.push({
        label: `$(plug) ${c.port}`,
        description: `Keep board: ${currentTarget.fqbn}`,
        target: { port: c.port, fqbn: currentTarget.fqbn }
      });
    }
  }
  const picked = await vscode.window.showQuickPick(items, {
    title: "Select Arduino board/port",
    placeHolder: "Pick the correct port (and board if known)",
    ignoreFocusOut: false
  });
  if (!picked) return null;
  await saveTarget(context, picked.target);
  return picked.target;
}

// src/sketch.ts
var vscode2 = __toESM(require("vscode"));
var fs = __toESM(require("node:fs"));
var path2 = __toESM(require("node:path"));
function safeReadDir(folder) {
  try {
    return fs.readdirSync(folder);
  } catch {
    return [];
  }
}
function findMainSketchFile(sketchFolder) {
  const base = path2.basename(sketchFolder);
  const preferred = path2.join(sketchFolder, `${base}.ino`);
  if (fs.existsSync(preferred)) return preferred;
  const inoFiles = safeReadDir(sketchFolder).filter((f) => f.toLowerCase().endsWith(".ino"));
  if (inoFiles.length === 1) {
    return path2.join(sketchFolder, inoFiles[0]);
  }
  return null;
}
function isSketchFolder(folder) {
  return findMainSketchFile(folder) !== null;
}
function getSketchFolder() {
  const editor = vscode2.window.activeTextEditor;
  if (editor) {
    const fsPath = editor.document.uri.fsPath;
    if (fsPath.toLowerCase().endsWith(".ino")) {
      return path2.dirname(fsPath);
    }
  }
  const wf = vscode2.workspace.workspaceFolders?.[0];
  const root = wf?.uri.fsPath;
  if (!root) return null;
  if (isSketchFolder(root)) {
    return root;
  }
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = path2.join(root, entry.name);
      if (isSketchFolder(child)) return child;
    }
  } catch {
  }
  return root;
}

// src/serverHttpClient.ts
var baseUrl = "http://127.0.0.1:3333";
var _authKey = "";
function setAuthKey(key) { _authKey = key; }
function setServerBaseUrl(url) {
  const clean = String(url || "").trim();
  if (!clean) return;
  baseUrl = clean.replace(/\/$/, "");
}
async function postJson(path5, body) {
  const res = await fetch(`${baseUrl}${path5}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-grease-auth": _authKey },
    body: JSON.stringify(body ?? {})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path5}`);
  return await res.json();
}
async function getHealth() {
  const res = await fetch(`${baseUrl}/health`, { headers: { "x-grease-auth": _authKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status} /health`);
  return await res.json();
}
async function syncTargetToServer(target) {
  try {
    await postJson("/target", { port: target?.port ?? null, fqbn: target?.fqbn ?? null });
  } catch { /* server may not be ready */ }
}
async function serialOpen(args) {
  return postJson("/serial/open", args);
}
async function serialClose() {
  return postJson("/serial/close", {});
}
async function serialWrite(args) {
  return postJson("/serial/write", args);
}
async function serialRead() {
  return postJson("/serial/read", {});
}

// src/ui/serialMonitorPanel.ts
var SerialMonitorPanel = class {
  constructor(output) {
    this.output = output;
  }
  output;
  pollTimer = null;
  connectedPort = null;
  baudRate = 9600;
  isConnected = false;
  async start(defaultPort, baud = 9600) {
    this.baudRate = baud;
    if (!defaultPort) {
      this.output.appendLine("Serial: no port selected.");
      return;
    }
    await this.connect(defaultPort, this.baudRate);
    this.startPolling();
  }
  async stop() {
    if (!this.isConnected) return;
    await serialClose();
    this.isConnected = false;
    this.output.appendLine("Serial disconnected");
  }
  async handleConsoleCommand(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return;
    if (/^baud\s*=\s*\d+$/i.test(text)) {
      const next = Number(text.split("=")[1]);
      if (!Number.isFinite(next) || next <= 0) {
        this.output.appendLine("Serial: invalid baud value.");
        return;
      }
      this.baudRate = next;
      this.output.appendLine(`Serial baud set to ${next}`);
      if (this.connectedPort) {
        await this.connect(this.connectedPort, this.baudRate);
      }
      return;
    }
    if (/^clear$/i.test(text)) {
      const r = await serialRead();
      const dropped = r.lines?.length ?? 0;
      this.output.appendLine(`Serial buffer cleared (${dropped} lines dropped).`);
      return;
    }
    if (/^disconnect$/i.test(text)) {
      await this.stop();
      return;
    }
    if (/^connect$/i.test(text)) {
      if (!this.connectedPort) {
        this.output.appendLine("Serial: no known port to connect.");
        return;
      }
      await this.connect(this.connectedPort, this.baudRate);
      return;
    }
    const sendQuoted = text.match(/^send\s*=\s*"([\s\S]*)"$/i);
    const sendPlain = text.match(/^send\s*=\s*(.+)$/i);
    if (sendQuoted || sendPlain) {
      const payload = sendQuoted ? sendQuoted[1] : sendPlain?.[1] ?? "";
      if (!this.isConnected) {
        this.output.appendLine("Serial: not connected.");
        return;
      }
      await serialWrite({ data: payload });
      this.output.appendLine(`[serial:tx] ${payload}`);
      return;
    }
    this.output.appendLine(`Serial: unknown command "${text}".`);
  }
  async connect(port, baudRate) {
    try {
      await serialOpen({ path: port, baudRate });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isPermDenied = msg.includes("Permission denied") || msg.includes("EACCES") || msg.includes("EPERM");
      if (isPermDenied && os.platform() === "linux") {
        vscode8.window.showErrorMessage(
          `Serial: Permission denied on ${port}. On Linux, run: sudo usermod -a -G dialout $USER — then log out and back in.`,
          "Copy Command"
        ).then((action) => {
          if (action === "Copy Command") vscode8.env.clipboard.writeText(`sudo usermod -a -G dialout $USER`);
        });
      } else {
        vscode8.window.showErrorMessage(`Serial: Failed to open ${port}: ${msg}`);
      }
      this.output.appendLine(`Serial open failed: ${msg}`);
      return;
    }
    this.connectedPort = port;
    this.baudRate = baudRate;
    this.isConnected = true;
    this.output.appendLine(`Serial connected: ${port} @ ${baudRate}`);
  }
  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.isConnected) return;
      void (async () => {
        try {
          const r = await serialRead();
          for (const line of r.lines ?? []) {
            this.output.appendLine(`[serial] ${line}`);
          }
        } catch {
        }
      })();
    }, 250);
  }
};

// src/ui/serialPlotterPanel.ts
var vscode3 = __toESM(require("vscode"));
function parseAllNumbers(line) {
  const matches = line.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  const numbers = [];
  for (const m of matches) {
    const n = Number(m);
    if (Number.isFinite(n)) numbers.push(n);
  }
  return numbers;
}
function parseLabeled(line) {
  const pairs = [];
  const re = /([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(String(line))) !== null) {
    pairs.push({ label: m[1], value: Number(m[2]) });
  }
  if (pairs.length > 0) return { labels: pairs.map(p => p.label), numbers: pairs.map(p => p.value) };
  const numbers = parseAllNumbers(line);
  return { labels: [], numbers };
}
var SerialPlotterPanel = class {
  constructor(output) {
    this.output = output;
  }
  output;
  panel = null;
  pollTimer = null;
  isConnected = false;
  show(defaultPort, autoConnect = true) {
    if (!this.panel) {
      this.panel = vscode3.window.createWebviewPanel(
        "arduinoMcp.serialPlotter",
        "Arduino Grease: Plttr",
        vscode3.ViewColumn.Beside,
        { enableScripts: true }
      );
      this.panel.onDidDispose(() => this.dispose());
      this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    }
    this.panel.title = "Arduino Grease: Plttr";
    this.panel.reveal(vscode3.ViewColumn.Beside);
    this.panel.webview.html = this.html(defaultPort);
    this.startPolling();
    this.postStatus();
    if (autoConnect && defaultPort && !this.isConnected) {
      void this.connect(defaultPort, 9600);
    }
  }
  dispose() {
    this.panel = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
  async connect(port, baudRate) {
    try {
      await serialOpen({ path: port, baudRate });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isPermDenied = msg.includes("Permission denied") || msg.includes("EACCES") || msg.includes("EPERM");
      if (isPermDenied && os.platform() === "linux") {
        vscode8.window.showErrorMessage(
          `Serial: Permission denied on ${port}. On Linux, run: sudo usermod -a -G dialout $USER — then log out and back in.`,
          "Copy Command"
        ).then((action) => {
          if (action === "Copy Command") vscode8.env.clipboard.writeText(`sudo usermod -a -G dialout $USER`);
        });
      } else {
        vscode8.window.showErrorMessage(`Serial: Failed to open ${port}: ${msg}`);
      }
      this.output.appendLine(`Serial open failed (plotter): ${msg}`);
      return;
    }
    this.output.appendLine(`Serial connected (plotter): ${port} @ ${baudRate}`);
    this.isConnected = true;
    this.postStatus();
  }
  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.panel) return;
      if (!this.isConnected) return;
      void (async () => {
        try {
          const r = await serialRead();
          const points = [];
          const labelBatch = [];
          for (const line of r.lines ?? []) {
            const parsed = parseLabeled(String(line));
            if (parsed.numbers.length > 0) {
              points.push(parsed.numbers);
              labelBatch.push(parsed.labels);
            }
          }
          if (points.length) this.panel?.webview.postMessage({ type: "points", points, labels: labelBatch });
          this.panel?.webview.postMessage({ type: "status", status: r.serial });
        } catch {
          this.panel?.webview.postMessage({ type: "status", status: { isOpen: false } });
        }
      })();
    }, 180);
  }
  postStatus() {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: "status", status: { isOpen: this.isConnected } });
  }
  async onMessage(msg) {
    if (!msg?.type) return;
    try {
      if (msg.type === "toggle") {
        const port = String(msg.path || "");
        const baud = Number(msg.baudRate || 9600);
        if (this.isConnected) {
          await serialClose();
          this.output.appendLine("Serial disconnected (plotter)");
          this.isConnected = false;
        } else {
          await this.connect(port, baud);
        }
        this.postStatus();
      } else if (msg.type === "clear") {
        if (this.panel) this.panel.webview.postMessage({ type: "clear" });
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.output.appendLine(`Serial plotter error: ${err}`);
      vscode3.window.showErrorMessage(`Arduino Grease Plotter: ${err}`);
      this.postStatus();
    }
  }
  html(defaultPort) {
    const portValue = defaultPort ? defaultPort.replaceAll('"', "&quot;") : "";
    const placeholder = os.platform() === "win32" ? "COM1" : "/dev/cu.usbmodem...";
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #050806;
        --panel: #0d1611;
        --ink: #b5ffc8;
        --muted: #76bf8b;
        --stroke: #2d4d3a;
        --trace: #7dff9e;
      }
      body { margin: 0; padding: 12px; background: radial-gradient(circle at 20% 0%, #0c120f, #050806 65%); color: var(--ink); font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size:11px; }
      .card { border: 1px solid var(--stroke); background: var(--panel); padding: 8px; border-radius: 8px; box-shadow: inset 0 0 20px rgba(61, 255, 117, 0.08); }
      .row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: nowrap; }
      label { font-size: 10px; color: var(--muted); }
      input, button {
        background: #07100b;
        color: var(--ink);
        border: 1px solid var(--stroke);
        border-radius: 6px;
        padding: 6px 7px;
        font-size: 11px;
        font-family: Consolas, Menlo, Monaco, "Courier New", monospace;
      }
      input { min-width: 180px; }
      #baud { min-width: 90px; }
      a { color: var(--ink); cursor: pointer; font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size: 11px; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .status { font-size: 10px; color: var(--muted); margin-left: auto; }
      .cmdbtn{ color:#d8ffd8; cursor:pointer; position:relative; display:inline; }
      .cmdbtn::after{
        content: attr(data-tip);
        position:absolute; left:0; bottom:120%;
        background:#0a110a; color:#e5ffe5; border:1px solid #335233; border-radius:4px;
        padding:2px 4px; font-size:10px; opacity:0; pointer-events:none; transition:opacity .12s ease; white-space:nowrap;
      }
      .cmdbtn:hover::after{ opacity:1; }
      canvas { width: 100%; height: calc(100vh - 162px); border: 1px solid var(--stroke); border-radius: 8px; background: #020502; box-shadow: inset 0 0 35px rgba(0, 255, 90, 0.08); }
      #legend { display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding:5px 8px; margin-top:4px; border:1px solid var(--stroke); border-radius:6px; background:var(--panel); min-height:26px; font-size:10px; }
      .leg-item { cursor:pointer; display:flex; align-items:center; gap:3px; user-select:none; }
      .leg-item:hover { text-decoration:underline; }
      .leg-bg { cursor:pointer; color:var(--muted); border:1px solid var(--stroke); padding:1px 6px; border-radius:3px; font-size:10px; margin-left:auto; }
      .leg-bg:hover { color:var(--ink); }
    </style>
  </head>
  <body>
    <div class="card" style="margin-bottom:8px">
      <div class="row">
        <div>
          <label>Port</label><br/>
          <input id="port" placeholder="${placeholder}" value="${portValue}"/>
        </div>
        <div>
          <label>Baud</label><br/>
          <input id="baud" value="9600"/>
        </div>
        <a class="cmdbtn" data-tip="start/stop" id="toggle" href="#" onclick="event.preventDefault()">||S||</a>
        <a class="cmdbtn" data-tip="clear" id="clear" href="#" onclick="event.preventDefault()">||C||</a>
        <div class="status" id="status"></div>
      </div>
    </div>

    <canvas id="canvas" width="1500" height="760"></canvas>
    <div id="legend"><span class="leg-bg" onclick="toggleBg()">bg</span></div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);
      const canvas = $("canvas");
      const ctx = canvas.getContext("2d");

      const maxPoints = 650;
      const series = [];
      let yMin = -0.2;
      let yMax = 1.2;

      const PLOT_COLORS = ["#7dff9e","#ff7d9e","#9e7dff","#ffff7d","#7dffff","#ffb47d","#ff9e7d","#7db4ff","#ff7dff","#d4ff7d"];
      let seriesColors = [...PLOT_COLORS];
      let seriesLabels = [];
      let numSeriesTotal = 0;
      let plotBgDark = true;

      function setStatus(s) {
        if (!s) return;
        const connected = !!s.isOpen;
        $("status").textContent = connected ? (" " + s.path + " @ " + s.baudRate) : "Disconnected";
        $("toggle").textContent = connected ? "||S|| █running " : "||S|| █stopped ";
        $("toggle").style.color = connected ? "#49c06b" : "#593b3bff";
      }

      function drawGrid(w, h) {
        ctx.strokeStyle = plotBgDark ? "rgba(62,255,120,0.12)" : "rgba(0,80,30,0.12)";
        ctx.lineWidth = 1;
        for (let x = 50; x < w - 20; x += 40) {
          ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, h - 36); ctx.stroke();
        }
        for (let y = 20; y < h - 36; y += 32) {
          ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(w - 20, y); ctx.stroke();
        }
      }

      function draw() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = plotBgDark ? "#020502" : "#f5f5f5";
        ctx.fillRect(0, 0, w, h);
        drawGrid(w, h);

        ctx.strokeStyle = plotBgDark ? "rgba(80,255,140,0.35)" : "rgba(0,100,40,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 20);
        ctx.lineTo(50, h - 36);
        ctx.lineTo(w - 20, h - 36);
        ctx.stroke();

        if (series.length < 2) return;

        const x0 = 50, y0 = h - 36, x1 = w - 20, y1 = 20;
        const plotW = x1 - x0;
        const plotH = y0 - y1;

        ctx.shadowColor = plotBgDark ? "rgba(140,255,170,0.55)" : "rgba(0,80,30,0.4)";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.2;

        const numSeries = series.length > 0 ? series[series.length - 1].length : 0;
        for (let s = 0; s < numSeries; s++) {
          const col = seriesColors[s] !== undefined ? seriesColors[s] : PLOT_COLORS[s % PLOT_COLORS.length];
          ctx.strokeStyle = col;
          ctx.beginPath();
          for (let i = 0; i < series.length; i++) {
            if (s >= series[i].length) continue;
            const x = x0 + (i / (maxPoints - 1)) * plotW;
            const v = series[i][s];
            const y = y0 - ((v - yMin) / (yMax - yMin)) * plotH;
            if (i === 0 || s >= series[i-1].length) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        ctx.fillStyle = plotBgDark ? "#8de0a0" : "#006400";
        ctx.font = "11px Consolas, Menlo, Monaco, monospace";
        ctx.fillText("min " + yMin.toFixed(2), x0, 14);
        ctx.fillText("max " + yMax.toFixed(2), x0 + 130, 14);
        const lastVals = series[series.length - 1] || [];
        ctx.fillText("last " + lastVals.map(v => v.toFixed(3)).join(", "), x0 + 260, 14);
      }

      function updateLegend() {
        const legend = $("legend");
        if (!legend) return;
        let html = '';
        for (let i = 0; i < numSeriesTotal; i++) {
          if (seriesColors[i] === undefined) seriesColors[i] = PLOT_COLORS[i % PLOT_COLORS.length];
          const col = seriesColors[i];
          const label = seriesLabels[i] || ("ch" + (i + 1));
          html += '<span class="leg-item" style="color:' + col + '" onclick="cycleSeriesColor(' + i + ')">█ ' + label + '</span>';
        }
        html += '<span class="leg-bg" onclick="toggleBg()">bg</span>';
        legend.innerHTML = html;
      }

      function cycleSeriesColor(i) {
        const idx = PLOT_COLORS.indexOf(seriesColors[i]);
        seriesColors[i] = PLOT_COLORS[(idx + 1) % PLOT_COLORS.length];
        updateLegend();
        draw();
      }

      function toggleBg() {
        plotBgDark = !plotBgDark;
        canvas.style.background = plotBgDark ? "#020502" : "#f5f5f5";
        draw();
      }

      $("toggle").addEventListener("click", () => {
        vscode.postMessage({ type: "toggle", path: $("port").value, baudRate: Number($("baud").value || 9600) });
      });
      $("clear").addEventListener("click", () => vscode.postMessage({ type: "clear" }));

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "points") {
          const labelBatch = Array.isArray(msg.labels) ? msg.labels : [];
          let labelsUpdated = false;
          for (let pi = 0; pi < msg.points.length; pi++) {
            const p = msg.points[pi];
            series.push(p);
            if (series.length > maxPoints) series.shift();
            for (const val of p) {
              if (val > yMax) yMax = val + 0.1;
              if (val < yMin) yMin = val - 0.1;
            }
            if (p.length > numSeriesTotal) { numSeriesTotal = p.length; labelsUpdated = true; }
            const rowLabels = labelBatch[pi];
            if (rowLabels && rowLabels.length > 0) {
              for (let li = 0; li < rowLabels.length; li++) {
                if (seriesLabels[li] !== rowLabels[li]) { seriesLabels[li] = rowLabels[li]; labelsUpdated = true; }
              }
            }
          }
          if (labelsUpdated) updateLegend();
          draw();
        } else if (msg.type === "status") {
          setStatus(msg.status);
        } else if (msg.type === "clear") {
          series.length = 0;
          seriesLabels.length = 0;
          seriesColors = [...PLOT_COLORS];
          numSeriesTotal = 0;
          yMin = -0.2;
          yMax = 1.2;
          updateLegend();
          draw();
        }
      });

      draw();
    </script>
  </body>
</html>`;
  }
};

// src/ui/examplesPanel.ts
var vscode4 = __toESM(require("vscode"));
var fs2 = __toESM(require("node:fs"));
var path3 = __toESM(require("node:path"));
function asRows(data) {
  const examples = Array.isArray(data?.examples) ? data.examples : [];
  const rows = [];
  for (const entry of examples) {
    const libraryName = String(entry?.library?.name ?? "Unknown");
    const paths = Array.isArray(entry?.examples) ? entry.examples : [];
    for (const p of paths) {
      const fullPath = String(p ?? "");
      if (!fullPath) continue;
      rows.push({
        library: libraryName,
        example: path3.basename(fullPath),
        fullPath
      });
    }
  }
  return rows;
}
function uniqueRows(rows) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
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
var ExamplesPanel = class {
  constructor(context, output) {
    this.context = context;
    this.output = output;
  }
  context;
  output;
  panel = null;
  show(defaultFqbn) {
    if (!this.panel) {
      this.panel = vscode4.window.createWebviewPanel(
        "arduinoMcp.examples",
        "X-mpls",
        vscode4.ViewColumn.Beside,
        { enableScripts: true }
      );
      this.panel.onDidDispose(() => this.panel = null);
      this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg, defaultFqbn));
    } else {
      this.panel.title = "X-mpls";
      this.panel.reveal(vscode4.ViewColumn.Beside);
    }
    this.panel.webview.html = this.html();
    void this.onMessage({ type: "list", library: "" }, defaultFqbn);
  }
  async listExamples(defaultFqbn) {
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
    const customLibPath = path3.join(os.homedir(), "Documents", "Arduino", "libraries", "AdvancedAnalog");
    if (fs2.existsSync(customLibPath)) {
      const exDir = path3.join(customLibPath, "examples");
      if (fs2.existsSync(exDir)) {
        try {
          const subdirs = fs2.readdirSync(exDir, { withFileTypes: true }).filter(d => d.isDirectory());
          for (const sd of subdirs) {
            rows.push({ library: "Filtered analog", example: sd.name, fullPath: path3.join(exDir, sd.name) });
          }
        } catch (e) { }
      }
    }
    return uniqueRows(rows);
  }
  async openExampleAsTab(examplePath) {
    const dir = String(examplePath || "").trim();
    if (!dir) return;
    const name = path3.basename(dir);
    const preferred = path3.join(dir, `${name}.ino`);
    let inoFile = null;
    if (fs2.existsSync(preferred)) {
      inoFile = preferred;
    } else {
      try {
        const files = fs2.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".ino"));
        if (files.length > 0) inoFile = path3.join(dir, files[0]);
      } catch {
      }
    }
    if (!inoFile) {
      vscode4.window.showWarningMessage("Arduino Grease: No .ino file found in this example.");
      return;
    }
    const doc = await vscode4.workspace.openTextDocument(vscode4.Uri.file(inoFile));
    await vscode4.window.showTextDocument(doc, { preview: false });
  }
  async onMessage(msg, defaultFqbn) {
    if (!this.panel || !msg?.type) return;
    if (msg.type === "list") {
      try {
        const rows = await this.listExamples(defaultFqbn);
        this.panel.webview.postMessage({ type: "examples", rows });
      } catch (e) {
        this.panel.webview.postMessage({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
    } else if (msg.type === "openExample") {
      await this.openExampleAsTab(String(msg.path ?? ""));
    }
  }
  html() {
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
};

// src/ui/managersPanel.ts (parseInstalledBoards retained; ManagersPanel webview class removed — sidebar tab is used instead)
var vscode5 = __toESM(require("vscode"));
function parseInstalledBoards(rawJson) {
  const parsed = JSON.parse(rawJson);
  const platforms = Array.isArray(parsed?.platforms) ? parsed.platforms : [];
  const rows = [];
  for (const p of platforms) {
    const platformId = String(p?.id ?? "");
    const version = String(p?.installed_version ?? "");
    const releases = p?.releases ?? {};
    const release = releases?.[version] ?? null;
    const boards = Array.isArray(release?.boards) ? release.boards : [];
    for (const b of boards) {
      const name = String(b?.name ?? "").trim();
      const fqbn = String(b?.fqbn ?? "").trim();
      if (!name || !fqbn) continue;
      rows.push({ name, fqbn, platform: platformId, version });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}
function parseLibraries(rawJson) {
  const parsed = JSON.parse(rawJson);
  const libraries = Array.isArray(parsed?.installed_libraries) ? parsed.installed_libraries : Array.isArray(parsed?.libraries) ? parsed.libraries : [];
  const out = libraries.map((l) => ({
    name: String(l?.library?.name ?? l?.name ?? "").trim(),
    version: String(l?.library?.version ?? l?.version ?? "").trim() || void 0,
    author: String(l?.library?.author ?? l?.author ?? "").trim() || void 0,
    sentence: String(l?.library?.sentence ?? l?.sentence ?? "").trim() || void 0
  })).filter((x) => x.name.length > 0);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
// ManagersPanel webview class removed — the embedded sidebar managers tab (panel-managers) is the active UI.

// src/ui/boardTemplatePanel.ts
var vscode6 = __toESM(require("vscode"));
var BoardTemplatePanel = class {
  constructor(context) {
    this.context = context;
  }
  context;
  panel = null;
  show(_args) {
    if (!this.panel) {
      this.panel = vscode6.window.createWebviewPanel(
        "arduinoMcp.boardTemplate",
        "Arduino Grease: AI Prompt Template",
        vscode6.ViewColumn.Beside,
        { enableScripts: true }
      );
      this.panel.onDidDispose(() => this.panel = null);
      this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    } else {
      this.panel.reveal(vscode6.ViewColumn.Beside);
    }
    this.panel.webview.html = this.html();
  }
  async onMessage(msg) {
    if (!msg?.type) return;
    if (msg.type === "copy") {
      const text = String(msg.text ?? "");
      await vscode6.env.clipboard.writeText(text);
      vscode6.window.showInformationMessage("Arduino Grease: Copied prompt to clipboard.");
    }
  }
  html() {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #1f1f1f;
        --panel: #2b2b2b;
        --ink: #e6e6e6;
        --muted: #a6a6a6;
        --stroke: #3a3a3a;
      }
      body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
      .card { border: 2px solid var(--stroke); background: var(--panel); padding: 12px; border-radius: 12px; box-shadow: 6px 6px 0 #000; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
      label { font-size: 12px; color: var(--muted); }
      textarea, button {
        background: #171717;
        color: var(--ink);
        border: 2px solid var(--stroke);
        border-radius: 10px;
        padding: 10px 10px;
        font-size: 13px;
      }
      textarea { width: 100%; min-height: 120px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.35; }
      button { cursor: pointer; min-height: 44px; }
      .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .muted { color: var(--muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="muted">Answer these questions to structure your prompt</div>
    </div>

    <div class="grid">
      <div class="card">
        <label>Wires, motors and sensors</label>
        <textarea id="wires" placeholder="Example: Left motor on pins 5/6 (PWM), right motor on pins 9/10, ultrasonic trig=2 echo=3, LDR=A0..."></textarea>
      </div>
      <div class="card">
        <label>Other modules installed</label>
        <textarea id="modules" placeholder="Example: IMU (MPU6050) on I2C, OLED 128x64, BLE module..."></textarea>
      </div>
      <div class="card">
        <label>Robot structure</label>
        <textarea id="robot" placeholder="Example: 2-wheel differential drive, geared DC motors, chassis size, power source..."></textarea>
      </div>
      <div class="card">
        <label>Expected behavior</label>
        <textarea id="behavior" placeholder="Example: Follow wall, avoid obstacles, blink status LED, publish sensor data..."></textarea>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <button id="generate">Generate prompt</button>
        <button id="copy">Copy</button>
      </div>
      <textarea id="out" style="min-height: 220px" placeholder="Generated prompt will appear here..."></textarea>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);

      function addSection(lines, title, value) {
        const text = String(value || "").trim();
        if (!text) return;
        lines.push(title + ":");
        lines.push(text);
        lines.push("");
      }

      function generate() {
        const wires = $("wires").value;
        const modules = $("modules").value;
        const robot = $("robot").value;
        const behavior = $("behavior").value;

        const lines = ["Arduino prompt context", ""];
        addSection(lines, "Wires, motors and sensors", wires);
        addSection(lines, "Other modules installed", modules);
        addSection(lines, "Robot structure", robot);
        addSection(lines, "Expected behavior", behavior);

        while (lines.length > 0 && lines[lines.length - 1] === "") {
          lines.pop();
        }

        $("out").value = lines.join("\\n");
      }

      $("generate").addEventListener("click", generate);
      $("copy").addEventListener("click", () => vscode.postMessage({ type: "copy", text: $("out").value }));
    </script>
  </body>
</html>`;
  }
};

// src/views/toolbarView.ts
var vscode7 = __toESM(require("vscode"));
var ArduinoToolbarViewProvider = class {
  constructor(context, output, actions) {
    this.context = context;
    this.output = output;
    this.actions = actions;
  }
  context;
  output;
  actions;
  static viewType = "arduinoMcp.toolbar";
  view = null;
  state = {
    port: null,
    fqbn: null,
    connectedPorts: [],
    serverRunning: false,
    serverHealthy: false,
    lastScanAtMs: null,
    serialActive: false
  };
  setState(next) {
    this.state = next;
    this.postState();
  }
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode7.Uri.joinPath(this.context.extensionUri, "resources")] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    this.postState();
  }
  postState() {
    this.view?.webview.postMessage({ type: "state", state: this.state });
  }
  async onMessage(msg) {
    if (!msg?.type) return;
    if (msg.type === "cmd") {
      const command = String(msg.command ?? "");
      if (!command) return;
      await vscode7.commands.executeCommand(command);
    } else if (msg.type === "list") {
      try {
        const argsBase = ["lib", "examples", "--json"];
        const base = await runArduinoCli(argsBase);
        if (!base.success) throw new Error(base.stderr || base.stdout || "Failed to list examples");
        let rows = asRows(JSON.parse(base.stdout));
        const fqbn = this.state.fqbn;
        if (fqbn) {
          const b = await runArduinoCli(["lib", "examples", "--fqbn", fqbn, "--json"]);
          if (b.success) rows = rows.concat(asRows(JSON.parse(b.stdout)));
        }
        this.view?.webview.postMessage({ type: "examples", rows: uniqueRows(rows) });
      } catch (e) {
        this.view?.webview.postMessage({ type: "exError", error: e instanceof Error ? e.message : String(e) });
      }
    } else if (msg.type === "openExample") {
      const dir = String(msg.path ?? "").trim();
      if (!dir) return;
      const name = path3.basename(dir);
      const preferred = path3.join(dir, name + ".ino");
      let inoFile = null;
      if (fs2.existsSync(preferred)) {
        inoFile = preferred;
      } else {
        try {
          const files = fs2.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".ino"));
          if (files.length > 0) inoFile = path3.join(dir, files[0]);
        } catch { }
      }
      if (!inoFile) { vscode7.window.showWarningMessage("Arduino Grease: No .ino file found in this example."); return; }
      const doc = await vscode7.workspace.openTextDocument(vscode7.Uri.file(inoFile));
      await vscode7.window.showTextDocument(doc, { preview: false });
      await vscode7.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession");
      vscode7.window.showInformationMessage(
        "This is a read-only example. Save a copy to edit it.",
        "Save As New Sketch"
      ).then((choice) => {
        if (choice === "Save As New Sketch") vscode7.commands.executeCommand("workbench.action.files.saveAs");
      });
    } else {
      const post = (payload) => void this.view?.webview.postMessage(payload);
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
          post({ type: "boards", rows: parseInstalledBoards(boards.stdout), query: String(msg.query ?? "") });
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
          const res = await runArduinoCli(["lib", "install", name]);
          this.output.appendLine(res.stdout);
          this.output.appendLine(res.stderr);
          if (!res.success) {
            post({ type: "mgrError", error: res.stderr || res.stdout });
          } else {
            vscode7.window.showInformationMessage(`Arduino Grease: Library ${name} installed.`);
          }
        } else if (msg.type === "toggleSerial") {
          await vscode7.commands.executeCommand("arduinoMcp.toggleSerial");
        } else if (msg.type === "libInstallGit") {
          const input = String(msg.input ?? "").trim();
          if (!input) return;
          this.output.appendLine(`[Mngrs] Installing library from Github: ${input}...`);
          const url = `https://github.com/${input}.git`;
          const res = await runArduinoCli(["lib", "install", "--git-url", url]);
          this.output.appendLine(res.stdout);
          this.output.appendLine(res.stderr);
          if (!res.success) {
            post({ type: "mgrError", error: res.stderr || res.stdout });
          } else {
            vscode7.window.showInformationMessage(`Arduino Grease: Library ${input} installed.`);
          }
        } else if (msg.type === "boardCatalogInstall") {
          const entry = msg.entry;
          if (!entry?.installCommand) { post({ type: "mgrError", error: "Invalid board entry." }); return; }
          this.output.appendLine(`[Mngrs] Installing board platform: ${entry.name}...`);
          if (entry.url) {
            const addUrl = await runArduinoCli(["config", "add", "board_manager.additional_urls", entry.url]);
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
            vscode7.window.showInformationMessage(`Arduino Grease: ${entry.name} installed.`);
            const boards2 = await runArduinoCli(["core", "list", "--json"]);
            if (boards2.success) post({ type: "boards", rows: parseInstalledBoards(boards2.stdout) });
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
  }
  html(webview) {
    const iconUri = webview.asWebviewUri(vscode7.Uri.joinPath(this.context.extensionUri, "resources", "icon.png"));
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
              Please use &lt;IDE-Extension&gt; Arduino Grease &lt;/IDE-Extension&gt; to read signals from its MCP server, then generate and upload a new sketch to filter those incoming A0 analog signals. Check, within Arduino Grease's extension folder, for /server/server.mjs and /server/skill.md for existing Rest endpoints and your new skills. You should also use the randomly generated MCP_AUTH_KEY from server.mjs with the Arduino Grease 
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
const CHARS = 'abcdefghijklmnopqrstuvwxyzNH01+=-./\\[]{}()?!<>:;'.split('');
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
};

// src/extension.ts
var OUTPUT_CHANNEL_NAME = "Arduino Grease";
function delay2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function activate(context) {
  const output = vscode8.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(output);
  output.appendLine("Arduino Grease activating...");
  // ── First-install setup: apply Grease theme + move Activity Bar to top ───
  vscode8.workspace.getConfiguration().update("output.smartScroll.enabled", false, vscode8.ConfigurationTarget.Global).then(void 0, () => {});
  const FIRST_INSTALL_KEY = "arduinoMcp.firstInstallDone_1_0_6";
  const firstInstallDone = context.globalState.get(FIRST_INSTALL_KEY);
  if (!firstInstallDone) {
    try {
      const wbConfig = vscode8.workspace.getConfiguration("workbench");
      await wbConfig.update("colorTheme", "Grease", vscode8.ConfigurationTarget.Global);
      await wbConfig.update("activityBar.location", "top", vscode8.ConfigurationTarget.Global);
      output.appendLine("First install: Applied Grease theme and moved Activity Bar to top.");
    } catch (e) {
      output.appendLine("First install theme setup failed: " + (e instanceof Error ? e.message : String(e)));
    }
    await context.globalState.update(FIRST_INSTALL_KEY, true);
  }
  // ── Arduino diagnostics collection for clangd bridge ──────────────────
  const arduinoDiagnostics = vscode8.languages.createDiagnosticCollection("arduino");
  context.subscriptions.push(arduinoDiagnostics);
  let serverProcess = null;
  let serverHealthy = false;
  let sawServerProblem = false;
  let lastScanAtMs = null;
  let portsRefreshArmed = false;
  const startServer = async () => {
    if (serverProcess) return true;
    try {
      serverProcess = await startBundledServer(context, output, 3333);
      setServerBaseUrl(`http://127.0.0.1:${serverProcess.port}`);
      setAuthKey(serverProcess.authKey);
      output.appendLine(`Arduino Grease server started on port ${serverProcess.port}.`);
      return true;
    } catch (e) {
      output.appendLine(`Failed to start bundled server: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };
  const stopServer = async () => {
    if (!serverProcess) return;
    await serverProcess.stop();
    serverProcess = null;
    serverHealthy = false;
    sawServerProblem = false;
    output.appendLine("Arduino Grease server stopped.");
  };
  await startServer();
  // ── arduino-cli presence check ────────────────────────────────────────────
  {
    const check = await runArduinoCli(["version"]);
    if (!check.success && (check.stderr?.includes("ENOENT") || check.exitCode === null)) {
      const installGuide = os.platform() === "win32"
        ? "Run: winget install ArduinoSA.ArduinoCLI"
        : os.platform() === "darwin"
          ? "Run: brew install arduino-cli"
          : "Run: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh";
      const action = await vscode8.window.showWarningMessage(
        `Arduino Grease: arduino-cli not found on PATH. ${installGuide} — then restart your IDE.`,
        "Open Install Guide"
      );
      if (action === "Open Install Guide") {
        vscode8.env.openExternal(vscode8.Uri.parse("https://arduino.github.io/arduino-cli/latest/installation/"));
      }
    } else {
      await runArduinoCli(["config", "set", "library.enable_unsafe_install", "true"]).catch(() => {});
    }
  }
  context.subscriptions.push({
    dispose: () => {
      void stopServer();
    }
  });
  const status = vscode8.window.createStatusBarItem(vscode8.StatusBarAlignment.Left, 100);
  status.name = "Arduino Grease Target";
  status.command = "arduinoMcp.refreshPortsBoards";
  status.show();
  context.subscriptions.push(status);
  const serialMonitorPanel = new SerialMonitorPanel(output);
  const serialPlotterPanel = new SerialPlotterPanel(output);
  const examplesPanel = new ExamplesPanel(context, output);
  const boardTemplatePanel = new BoardTemplatePanel(context);
  const toolbar = new ArduinoToolbarViewProvider(context, output, {
    chooseTarget: async (fqbn) => {
      // Match port by FQBN core family first (e.g. esp32:esp32:XIAO matches esp32:esp32:esp32)
      const corePrefix = fqbn.split(":").slice(0, 2).join(":");
      const candidate =
        lastCandidates.find((c) => c.fqbn?.startsWith(corePrefix + ":") && typeof c.port === "string") ??
        lastCandidates.find((c) => c.port === currentTarget?.port) ??
        lastCandidates.find((c) => typeof c.port === "string") ??
        null;
      const port = candidate?.port ?? currentTarget?.port ?? null;
      if (!port) {
        vscode8.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");
        return;
      }
      const memCandidate = candidate ?? lastCandidates.find((c) => c.port === port);
      const keysToSave = boardMemoryKeys(memCandidate);
      if (keysToSave.length > 0) {
        const mem = await loadBoardMemory(context);
        for (const k of keysToSave) mem[k] = { fqbn };
        await saveBoardMemory(context, mem);
        output.appendLine(`[BoardMemory] Saved (${keysToSave.join(", ")}) → ${fqbn}`);
      } else {
        output.appendLine(`[BoardMemory] Warning: no identifiers found for ${port} — memory not saved`);
      }
      currentTarget = { port, fqbn, userChosen: true };
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
    },
    uploadFirmwareToTarget: async (fqbn) => {
      const port = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      if (!port) {
        vscode8.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");
        return;
      }
      currentTarget = { port, fqbn, userChosen: true };
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
      await runFirmwareUpload(fqbn, port);
    },
    serialOff: async () => {
      if (serialMonitorPanel.isConnected) {
        await serialMonitorPanel.stop();
        output.appendLine("Serial disconnected (panel switch).");
        refreshToolbarState();
      }
    },
    cycleAccent: async (color) => {
      const config = vscode8.workspace.getConfiguration("workbench");
      const current = config.get("colorCustomizations") || {};
      const updated = { ...current, 
        "statusBar.background": color, 
        "statusBar.noFolderBackground": color,
        "statusBar.debuggingBackground": color,
        "statusBarItem.remoteBackground": color,
        "focusBorder": color, 
        "activityBarBadge.background": color, 
        "panelTitle.activeBorder": color 
      };
      const target = (vscode8.workspace.workspaceFolders && vscode8.workspace.workspaceFolders.length > 0) ? vscode8.ConfigurationTarget.Workspace : vscode8.ConfigurationTarget.Global;
      await config.update("colorCustomizations", updated, target);
      output.appendLine(`Accent color set to ${color} (Target: ${target === vscode8.ConfigurationTarget.Workspace ? 'Workspace' : 'Global'})`);
      refreshToolbarState();
    }
  });
  context.subscriptions.push(vscode8.window.registerWebviewViewProvider(ArduinoToolbarViewProvider.viewType, toolbar));
  let lastCandidates = [];
  let lastPorts = /* @__PURE__ */ new Set();
  let lastServerState = null;
  let lastPortChangeVersion = 0;
  let currentTarget = await loadTarget(context);
  if (currentTarget) await syncTargetToServer(currentTarget);
  const refreshToolbarState = () => {
    const config = vscode8.workspace.getConfiguration("workbench");
    const customizations = config.get("colorCustomizations") || {};
    toolbar.setState({
      port: currentTarget?.port ?? null,
      fqbn: currentTarget?.fqbn ?? null,
      connectedPorts: Array.from(lastPorts),
      serverRunning: serverProcess !== null,
      serverHealthy,
      lastScanAtMs,
      serialActive: serialMonitorPanel.isConnected,
      uploading: !!lastServerState?.uploading,
      accentColor: customizations["statusBar.background"] || "#007ACC"
    });
  };
  const setWarning = (text) => {
    status.text = `$(warning) ${text}`;
    status.backgroundColor = new vscode8.ThemeColor("statusBarItem.warningBackground");
    status.tooltip = "Arduino Grease needs a board/port selection";
  };
  const setOk = (target) => {
    if (target.fqbn) {
      status.text = `$(circuit-board) ${target.fqbn} @ ${target.port}`;
      status.backgroundColor = void 0;
      status.tooltip = "Arduino Grease target";
    } else {
      status.text = `$(plug) ${target.port} (board unknown)`;
      status.backgroundColor = new vscode8.ThemeColor("statusBarItem.warningBackground");
      status.tooltip = "Port detected but board not resolved. Use 'arduino-cli board list' and 'arduino-cli core install <package>' to install the correct driver.";
    }
  };
  const checkServerHealth = async (verbose = false) => {
    if (!serverProcess) {
      serverHealthy = false;
      refreshToolbarState();
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:${serverProcess.port}/state`, {
        headers: { "x-grease-auth": serverProcess.authKey }
      });
      const s = await res.json();
      const ok = !!s.target;
      serverHealthy = ok;
      
      if (s.uploading) {
        toolbar.view?.webview.postMessage({ type: "rainState", state: "thrust" });
      } else if (lastServerState?.uploading) {
        // Transition from uploading to idle
        toolbar.view?.webview.postMessage({ type: "rainState", state: "idle" });
      }
      lastServerState = s;
      if (typeof s.portChangeVersion === "number" && s.portChangeVersion !== lastPortChangeVersion) {
        lastPortChangeVersion = s.portChangeVersion;
        if (!s.uploading) void reconcileTarget();
      }

      if (!ok) {
        output.appendLine("Problem with MCP Server");
        sawServerProblem = true;
      } else if (sawServerProblem) {
        output.appendLine("MCP Server recovered.");
        sawServerProblem = false;
      }
      if (verbose) {
        output.appendLine(`Server status: ${ok ? "running and healthy" : "running but unhealthy"}`);
      }
    } catch (e) {
      serverHealthy = false;
      output.appendLine("Problem with MCP Server");
      if (verbose) {
        output.appendLine(`Server health check failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      sawServerProblem = true;
    }
    refreshToolbarState();
  };
  const reconcileTarget = async () => {
    lastScanAtMs = Date.now();
    const detection = await refreshBoards(output);
    lastCandidates = detection.candidates;
    const portsNow = new Set(lastCandidates.map((c) => c.port).filter((p) => typeof p === "string"));
    const changed = portsNow.size !== lastPorts.size || Array.from(portsNow).some((p) => !lastPorts.has(p)) || Array.from(lastPorts).some((p) => !portsNow.has(p));
    lastPorts = portsNow;
    if (currentTarget?.port && !portsNow.has(currentTarget.port)) {
      output.appendLine(`Port ${currentTarget.port} disconnected. Clearing selected target.`);
      currentTarget = null;
      await saveTarget(context, null);
      await syncTargetToServer(null);
    }
    // Apply board memory, then deduplicate to one best candidate per port
    const boardMem = await loadBoardMemory(context);
    const resolvedCandidates = lastCandidates.map((c) => {
      for (const k of boardMemoryKeys(c)) {
        if (boardMem[k]) {
          output.appendLine(`[BoardMemory] Restored ${boardMem[k].fqbn} for ${c.port} via ${k}`);
          return { ...c, fqbn: boardMem[k].fqbn, fromMemory: true };
        }
      }
      return c;
    });
    // Collapse multiple candidates at the same port into one, preferring fromMemory
    const portMap = new Map();
    for (const c of resolvedCandidates) {
      if (typeof c.port !== "string") continue;
      const existing = portMap.get(c.port);
      if (!existing || (!existing.fromMemory && c.fromMemory)) portMap.set(c.port, c);
    }
    const deduped = Array.from(portMap.values());
    const candidatesWithFqbn = deduped.filter((c) => typeof c.fqbn === "string" && typeof c.port === "string");
    const portsOnly = deduped.filter((c) => !c.fqbn && typeof c.port === "string");
    if (!currentTarget?.userChosen && candidatesWithFqbn.length === 1) {
      const only = candidatesWithFqbn[0];
      const remembered = only.fromMemory;
      currentTarget = { port: only.port, fqbn: only.fqbn, userChosen: !!remembered };
      if (remembered) output.appendLine(`[BoardMemory] Restored ${only.fqbn} for ${vidPidKey(only.vid, only.pid) ?? only.port}`);
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
    } else if (!currentTarget?.userChosen && candidatesWithFqbn.length === 0 && portsOnly.length === 1) {
      const onlyPort = portsOnly[0];
      currentTarget = { port: onlyPort.port, fqbn: null };
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
    }
    // FQBN is never auto-overridden once chosen — only the user can change it via ||Choose as target||
    if (!currentTarget) {
      if (portsNow.size === 0) {
        setWarning("No serial ports detected");
        if (changed) output.appendLine("No Arduino port detected.");
      } else {
        setWarning("Select board/port");
      }
    } else {
      setOk(currentTarget);
      if (changed) {
        output.appendLine(`Port ${currentTarget.port} and Board ${currentTarget.fqbn ?? "unknown"} detected.`);
      }
      // ── Auto board core detection & install prompt ──────────────────────
      if (currentTarget.fqbn && changed) {
        const corePkg = extractCoreFromFqbn(currentTarget.fqbn);
        if (corePkg) {
          const installed = await isCoreInstalled(corePkg);
          if (installed) {
            output.appendLine(`Board core ${corePkg} is already installed.`);
          } else {
            const choice = await vscode8.window.showInformationMessage(
              `Arduino Grease: Board core "${corePkg}" is not installed. Would you like me to install the driver for this board?`,
              "Install",
              "Cancel"
            );
            if (choice === "Install") {
              output.appendLine(`Installing board core ${corePkg}...`);
              const up = await updateIndexes();
              output.appendLine(up.stdout);
              output.appendLine(up.stderr);
              const res = await installCore(corePkg);
              output.appendLine(res.stdout);
              output.appendLine(res.stderr);
              if (res.success) {
                vscode8.window.showInformationMessage(`Arduino Grease: Board core ${corePkg} installed successfully.`);
              } else {
                vscode8.window.showErrorMessage(`Arduino Grease: Failed to install board core ${corePkg}. See Output.`);
              }
            }
          }
        }
      }
    }
    refreshToolbarState();
  };
  const refreshPortsAndBoard = async () => {
    output.show(true);
    const detection = await refreshBoards(output);
    lastCandidates = detection.candidates;
    if (currentTarget?.port && currentTarget?.fqbn) {
      // Board already chosen — let the user pick a new one instead of silently refreshing
      const picked = await promptForTarget(context, lastCandidates, currentTarget);
      if (picked) {
        currentTarget = { ...picked, userChosen: true };
        await syncTargetToServer(currentTarget);
        setOk(currentTarget);
        refreshToolbarState();
      }
      return;
    }
    if (portsRefreshArmed) {
      await vscode8.commands.executeCommand("workbench.action.closeQuickOpen");
      portsRefreshArmed = false;
      return;
    }
    portsRefreshArmed = true;
    setTimeout(() => {
      portsRefreshArmed = false;
    }, 6e3);
    const picked = await promptForTarget(context, lastCandidates, currentTarget);
    if (picked) {
      currentTarget = { ...picked, userChosen: true };
      await syncTargetToServer(currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
    }
  };
  const getValidSketchPath = async () => {
    const sketchPath = getSketchFolder();
    if (!sketchPath) {
      return null;
    }
    const mainIno = findMainSketchFile(sketchPath);
    if (mainIno) {
      return sketchPath;
    }
    output.appendLine(`Invalid sketch folder (main .ino missing): ${sketchPath}`);
    const choice = await vscode8.window.showWarningMessage(
      "Arduino Grease: Current folder is not a valid sketch (missing main .ino).",
      "Start Sketch",
      "Cancel"
    );
    if (choice === "Start Sketch") {
      await vscode8.commands.executeCommand("arduinoMcp.startSketch");
    }
    return null;
  };
  const runVerifyOnly = async (fqbnOverride) => {
    output.show(true);
    const sketchPath = await getValidSketchPath();
    if (!sketchPath) {
      vscode8.window.showErrorMessage("Arduino Grease: No valid sketch folder found.");
      return { ok: false };
    }
    const fqbn = fqbnOverride ?? currentTarget?.fqbn ?? null;
    if (!fqbn) {
      const choice = await vscode8.window.showWarningMessage(
        "Arduino Grease: Board unknown. Install/select a core so an FQBN is available.",
        "Install core...",
        "Select board/port..."
      );
      if (choice === "Install core...") {
        await vscode8.commands.executeCommand("arduinoMcp.installCore");
      } else {
        await vscode8.commands.executeCommand("arduinoMcp.refreshPortsBoards");
      }
      return { ok: false };
    }
    const verifyCmd = `$ arduino-cli compile --fqbn ${fqbn} "${sketchPath}"`;
    output.appendLine(verifyCmd);
    const res = await runArduinoCli(["compile", "--fqbn", fqbn, sketchPath], sketchPath);
    output.appendLine(res.stdout);
    output.appendLine(res.stderr);
    if (!res.success) {
      // Parse compiler errors into diagnostics
      const diagMap = new Map();
      const errorRegex = /^(.+):([0-9]+):([0-9]+):\s*(error|warning):\s*(.+)$/gm;
      let m;
      const combinedOutput = (res.stdout + "\n" + res.stderr);
      while ((m = errorRegex.exec(combinedOutput)) !== null) {
        const filePath = m[1];
        const line = Math.max(0, parseInt(m[2], 10) - 1);
        const col = Math.max(0, parseInt(m[3], 10) - 1);
        const severity = m[4] === "error" ? vscode8.DiagnosticSeverity.Error : vscode8.DiagnosticSeverity.Warning;
        const message = m[5];
        const range = new vscode8.Range(line, col, line, col + 1);
        const diag = new vscode8.Diagnostic(range, message, severity);
        diag.source = "Arduino Grease";
        const uri = vscode8.Uri.file(filePath);
        const key = uri.toString();
        if (!diagMap.has(key)) diagMap.set(key, []);
        diagMap.get(key).push(diag);
      }
      arduinoDiagnostics.clear();
      for (const [uriStr, diags] of diagMap) {
        arduinoDiagnostics.set(vscode8.Uri.parse(uriStr), diags);
      }
      vscode8.window.showErrorMessage("Arduino Grease: Verify failed (see Output).");
      return { ok: false };
    }
    arduinoDiagnostics.clear();
    // Generate compile_commands.json for clangd IntelliSense
    void generateCompileCommands(fqbn, sketchPath, output);
    vscode8.window.showInformationMessage("Arduino Grease: Verify succeeded.");
    return { ok: true, sketchPath, fqbn };
  };
  const runUpload = async (opts) => {
    output.show(true);
    await vscode8.workspace.saveAll(false);
    let sketchPath = null;
    let fqbn = opts?.fqbnOverride ?? currentTarget?.fqbn ?? null;
    if (opts?.verifyFirst !== false) {
      const verify = await runVerifyOnly(fqbn ?? void 0);
      if (!verify.ok) return false;
      sketchPath = verify.sketchPath ?? null;
      fqbn = verify.fqbn ?? fqbn;
    } else {
      sketchPath = await getValidSketchPath();
      if (!sketchPath) return false;
    }
    const port = opts?.portOverride ?? currentTarget?.port ?? null;
    if (!port) {
      vscode8.window.showWarningMessage("Arduino Grease: Select a port first.");
      await vscode8.commands.executeCommand("arduinoMcp.refreshPortsBoards");
      return false;
    }
    if (!fqbn || !sketchPath) {
      vscode8.window.showWarningMessage("Arduino Grease: Select a board first.");
      await vscode8.commands.executeCommand("arduinoMcp.refreshPortsBoards");
      return false;
    }
    const uploadCmd = `$ arduino-cli upload -p ${port} --fqbn ${fqbn} "${sketchPath}"`;
    output.appendLine(uploadCmd);
    toolbar.view?.webview.postMessage({ type: "rainState", state: "thrust" });
    const res = await runArduinoCli(["upload", "-p", port, "--fqbn", fqbn, sketchPath], sketchPath);
    output.appendLine(res.stdout);
    output.appendLine(res.stderr);
    toolbar.view?.webview.postMessage({ type: "uploadResult", success: res.success });
    if (!res.success) {
      vscode8.window.showErrorMessage("Arduino Grease: Upload failed (see Output).");
      return false;
    }
    vscode8.window.showInformationMessage("Arduino Grease: Upload succeeded.");
    return true;
  };
  const runFirmwareUpload = async (fqbn, port) => {
    output.show(true);
    const programmer = await vscode8.window.showInputBox({
      title: "Programmer",
      prompt: "Enter programmer (e.g., avrispmkii, usbtinyisp) or leave empty for default",
      ignoreFocusOut: false
    });
    if (programmer === undefined) return;
    output.appendLine(`[Mngrs] Burning bootloader for ${fqbn} on ${port}...`);
    const args = ["burn-bootloader", "-b", fqbn, "-p", port];
    if (programmer) {
      args.push("-P", programmer);
    }
    const up = await runArduinoCli(args);
    output.appendLine(up.stdout);
    output.appendLine(up.stderr);
    if (!up.success) {
      vscode8.window.showErrorMessage("Arduino Grease: Burn bootloader failed (see Output).");
      return;
    }
    vscode8.window.showInformationMessage("Arduino Grease: Bootloader burned to target.");
  };
  await reconcileTarget();
  await delay(3000);
  await checkServerHealth(true);
  const healthInterval = setInterval(() => {
    void checkServerHealth(false);
  }, 2000);
  context.subscriptions.push({ dispose: () => clearInterval(healthInterval) });
  context.subscriptions.push(
    vscode8.commands.registerCommand("arduinoMcp.serverStatus", async () => {
      output.show(true);
      output.appendLine("Checking MCP server status...");
      if (!serverProcess) {
        output.appendLine("Server status: stopped");
        serverHealthy = false;
        refreshToolbarState();
        return;
      }
      await checkServerHealth(true);
    }),
    vscode8.commands.registerCommand("arduinoMcp.refreshServer", async () => {
      output.show(true);
      if (!serverProcess) {
        await startServer();
        await delay2(1e3);
        await checkServerHealth(true);
        return;
      }
      if (serverProcess && !serverHealthy) {
        await stopServer();
        await delay2(1e3);
        await startServer();
        await delay2(1e3);
        await checkServerHealth(true);
        return;
      }
      if (serverProcess && serverHealthy) {
        await stopServer();
        refreshToolbarState();
      }
    }),
    vscode8.commands.registerCommand("arduinoMcp.startServer", async () => {
      output.show(true);
      const ok = await startServer();
      if (ok) {
        await checkServerHealth(true);
        output.appendLine("Server start command completed.");
      }
      refreshToolbarState();
    }),
    vscode8.commands.registerCommand("arduinoMcp.stopServer", async () => {
      output.show(true);
      await stopServer();
      refreshToolbarState();
    }),
    vscode8.commands.registerCommand("arduinoMcp.toggleServer", async () => {
      output.show(true);
      if (serverProcess) {
        await stopServer();
      } else {
        await startServer();
        await checkServerHealth(true);
      }
      refreshToolbarState();
    }),
    vscode8.commands.registerCommand("arduinoMcp.startSketch", async () => {
      output.show(true);
      const name = await vscode8.window.showInputBox({
        title: "Start new sketch",
        prompt: "Sketch name",
        placeHolder: "BlinkNano33",
        ignoreFocusOut: false,
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) return "Sketch name is required.";
          if (!/^[A-Za-z0-9_\-]+$/.test(trimmed)) return "Use only letters, numbers, underscore, or dash.";
          return null;
        }
      });
      if (!name) return;
      const defaultParent = vscode8.workspace.workspaceFolders?.[0]?.uri ?? vscode8.Uri.file(path4.join(os.homedir(), "Documents"));
      const pickedFolder = await vscode8.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: defaultParent,
        openLabel: "Create Sketch Here",
        title: "Choose parent folder"
      });
      if (!pickedFolder?.[0]) return;
      const parent = pickedFolder[0].fsPath;
      const sketchPath = path4.join(parent, name.trim());
      output.appendLine(`$ arduino-cli sketch new "${sketchPath}"`);
      const res = await runArduinoCli(["sketch", "new", sketchPath]);
      output.appendLine(res.stdout);
      output.appendLine(res.stderr);
      if (!res.success) {
        vscode8.window.showErrorMessage("Arduino Grease: Failed to create sketch. See output.");
        return;
      }
      const inoPath = path4.join(sketchPath, `${name.trim()}.ino`);
      try {
        const doc = await vscode8.workspace.openTextDocument(vscode8.Uri.file(inoPath));
        await vscode8.window.showTextDocument(doc, { preview: false });
      } catch (e) {
        output.appendLine(`Could not open sketch file automatically: ${e instanceof Error ? e.message : String(e)}`);
      }
      output.appendLine(`Sketch created: ${sketchPath}`);
      vscode8.window.showInformationMessage(`Arduino Grease: Sketch created (${name.trim()}).`);
    }),
    vscode8.commands.registerCommand("arduinoMcp.installCore", async () => {
      output.show(true);
      const items = [
        { label: "Arduino AVR (Uno/Nano/Mega)", description: "arduino:avr", pkg: "arduino:avr" },
        { label: "Arduino SAMD (Nano 33 IoT, MKR)", description: "arduino:samd", pkg: "arduino:samd" },
        { label: "Arduino Mbed OS (Nano 33 BLE, Portenta)", description: "arduino:mbed", pkg: "arduino:mbed" },
        { label: "ESP32", description: "esp32:esp32", pkg: "esp32:esp32" },
        { label: "RP2040", description: "rp2040:rp2040", pkg: "rp2040:rp2040" }
      ];
      const picked = await vscode8.window.showQuickPick(items, {
        title: "Install board core",
        placeHolder: "Pick a core package",
        ignoreFocusOut: false
      });
      if (!picked) return;
      const up = await updateIndexes();
      output.appendLine(up.stdout);
      output.appendLine(up.stderr);
      const res = await installCore(picked.pkg);
      output.appendLine(res.stdout);
      output.appendLine(res.stderr);
      if (!res.success) {
        vscode8.window.showErrorMessage(`Arduino Grease: Core install failed for ${picked.pkg}.`);
      } else {
        vscode8.window.showInformationMessage(`Arduino Grease: Core installed: ${picked.pkg}.`);
        await reconcileTarget();
      }
    }),
    vscode8.commands.registerCommand("arduinoMcp.verify", async () => {
      const res = await runVerifyOnly();
      toolbar.view?.webview.postMessage({ type: 'verifyResult', success: res.ok === true });
    }),
    vscode8.commands.registerCommand("arduinoMcp.upload", async () => {
      const ok = await runUpload({ verifyFirst: true });
      toolbar.view?.webview.postMessage({ type: 'uploadResult', success: ok === true });
    }),
    vscode8.commands.registerCommand("arduinoMcp.refreshPortsBoards", async () => {
      await refreshPortsAndBoard();
    }),
    vscode8.commands.registerCommand("arduinoMcp.selectTarget", async () => {
      await refreshPortsAndBoard();
    }),
    vscode8.commands.registerCommand("arduinoMcp.toggleSerial", async () => {
      if (serialMonitorPanel.isConnected) {
        await serialMonitorPanel.stop();
      } else {
        await vscode8.commands.executeCommand("arduinoMcp.openSerialMonitor");
      }
      refreshToolbarState();
    }),
    vscode8.commands.registerCommand("arduinoMcp.openSerialMonitor", async () => {
      output.show(true);
      const defaultPort = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      await serialMonitorPanel.start(defaultPort, 9600);
      output.appendLine(
        `Type "baud=X" to set a new baud rate, or try any of the following commands: 'send="Hello World"', "clear", "disconnect", or "connect". Transmitting from ${defaultPort ?? "(unknown port)"} below:`
      );
    }),
    vscode8.commands.registerCommand("arduinoMcp.serialCommand", async () => {
      output.show(true);
      const command = await vscode8.window.showInputBox({
        title: "Serial command",
        prompt: "Enter serial command",
        placeHolder: 'baud=9600 | send="Hello World" | clear | disconnect | connect',
        ignoreFocusOut: false
      });
      if (!command) return;
      await serialMonitorPanel.handleConsoleCommand(command);
    }),
    vscode8.commands.registerCommand("arduinoMcp.openSerialPlotter", async () => {
      output.show(true);
      const defaultPort = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      serialPlotterPanel.show(defaultPort, true);
      if (!serialMonitorPanel.isConnected && defaultPort) {
        void serialMonitorPanel.start(defaultPort, 9600);
      }
      setTimeout(() => {
        void vscode8.commands.executeCommand("workbench.action.moveEditorToNewWindow");
      }, 500);
      refreshToolbarState();
    }),
    vscode8.commands.registerCommand("arduinoMcp.openExamples", async () => {
      output.show(true);
      if (serialMonitorPanel.isConnected) {
        await serialMonitorPanel.stop();
        output.appendLine("Serial disconnected (Examples panel opened).");
        refreshToolbarState();
      }
      examplesPanel.show(currentTarget?.fqbn ?? null);
    }),
    vscode8.commands.registerCommand("arduinoMcp.openBoardTemplate", async () => {
      output.show(true);
      boardTemplatePanel.show({ fqbn: currentTarget?.fqbn ?? null, port: currentTarget?.port ?? null });
    }),
    vscode8.commands.registerCommand("arduinoMcp.cycleAccentColor", async () => {
      const ACCENT_COLORS = ["#005FA0", "#6B0000", "#A34300", "#8F6809", "#6B004A", "#520A85", "#004D00"];
      const config = vscode8.workspace.getConfiguration("workbench");
      const current = config.get("colorCustomizations") || {};
      const currentColor = current["statusBar.background"] || "#007ACC";
      const idx = ACCENT_COLORS.indexOf(currentColor);
      const nextIdx = (idx + 1) % ACCENT_COLORS.length;
      const color = ACCENT_COLORS[nextIdx];
      const updated = { ...current, 
        "statusBar.background": color, 
        "statusBar.noFolderBackground": color,
        "statusBar.debuggingBackground": color,
        "statusBarItem.remoteBackground": color,
        "focusBorder": color, 
        "activityBarBadge.background": color, 
        "panelTitle.activeBorder": color 
      };
      const target = (vscode8.workspace.workspaceFolders && vscode8.workspace.workspaceFolders.length > 0) ? vscode8.ConfigurationTarget.Workspace : vscode8.ConfigurationTarget.Global;
      await config.update("colorCustomizations", updated, target);
      output.appendLine(`Accent color cycled to ${color} (Target: ${target === vscode8.ConfigurationTarget.Workspace ? 'Workspace' : 'Global'})`);
      refreshToolbarState();
      toolbar.view?.webview.postMessage({ type: 'accentColor', color: color });
    })
  );
  refreshToolbarState();
  output.appendLine("Arduino Grease activated.");
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
