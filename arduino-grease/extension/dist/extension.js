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
  const serverPath = context.asAbsolutePath(path.join("server", "server.mjs"));
  output.appendLine(`Starting bundled Arduino MCP server on port ${port}...`);
  const child = (0, import_node_child_process.spawn)(nodePath, [serverPath], {
    cwd: context.extensionPath,
    env: { ...process.env, MCP_PORT: String(port), MCP_HOST: "127.0.0.1" }
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
    const child = (0, import_node_child_process2.spawn)(cmd, args, { cwd, env: process.env, shell: false });
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
    const matching = Array.isArray(p?.matching_boards) ? p.matching_boards : [];
    if (matching.length === 0) {
      if (typeof address === "string") {
        candidates.push({ port: address, protocol });
      }
      continue;
    }
    for (const b of matching) {
      candidates.push({
        port: address,
        protocol,
        fqbn: b?.fqbn,
        name: b?.name
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
async function promptForTarget(context, candidates) {
  const items = candidates.map((c) => {
    const fqbn = typeof c.fqbn === "string" ? c.fqbn : null;
    return {
      label: pickLabel(c),
      description: fqbn ? void 0 : "Port detected (board unknown - install/select core)",
      target: { port: c.port, fqbn }
    };
  });
  if (items.length === 0) return null;
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
function setServerBaseUrl(url) {
  const clean = String(url || "").trim();
  if (!clean) return;
  baseUrl = clean.replace(/\/$/, "");
}
async function postJson(path5, body) {
  const res = await fetch(`${baseUrl}${path5}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path5}`);
  return await res.json();
}
async function getHealth() {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status} /health`);
  return await res.json();
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
    await serialOpen({ path: port, baudRate });
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
function parseFirstNumber(line) {
  const m = line.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
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
    } else {
      this.panel.title = "Arduino Grease: Plttr";
      this.panel.reveal(vscode3.ViewColumn.Beside);
    }
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
    await serialOpen({ path: port, baudRate });
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
          for (const line of r.lines ?? []) {
            const n = parseFirstNumber(String(line));
            if (n !== null) points.push(n);
          }
          if (points.length) this.panel?.webview.postMessage({ type: "points", points });
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
    return `<!doctype html>
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
      canvas { width: 100%; height: calc(100vh - 106px); border: 1px solid var(--stroke); border-radius: 8px; background: #020502; box-shadow: inset 0 0 35px rgba(0, 255, 90, 0.08); }
    </style>
  </head>
  <body>
    <div class="card" style="margin-bottom:8px">
      <div class="row">
        <div>
          <label>Port</label><br/>
          <input id="port" placeholder="/dev/cu.usbmodem..." value="${portValue}"/>
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

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);
      const canvas = $("canvas");
      const ctx = canvas.getContext("2d");

      const maxPoints = 650;
      const series = [];
      let yMin = -0.2;
      let yMax = 1.2;

      function setStatus(s) {
        if (!s) return;
        const connected = !!s.isOpen;
        $("status").textContent = connected ? ("Connected: " + s.path + " @ " + s.baudRate) : "Disconnected";
        $("toggle").textContent = connected ? "||S|| █running " : "||S|| █stopped ";
        $("toggle").style.color = connected ? "#49c06b" : "#6f6f6f";
      }

      function drawGrid(w, h) {
        ctx.strokeStyle = "rgba(62, 255, 120, 0.12)";
        ctx.lineWidth = 1;
        for (let x = 50; x < w - 20; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 20);
          ctx.lineTo(x, h - 36);
          ctx.stroke();
        }
        for (let y = 20; y < h - 36; y += 32) {
          ctx.beginPath();
          ctx.moveTo(50, y);
          ctx.lineTo(w - 20, y);
          ctx.stroke();
        }
      }

      function draw() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        drawGrid(w, h);

        ctx.strokeStyle = "rgba(80,255,140,0.35)";
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

        ctx.shadowColor = "rgba(140,255,170,0.55)";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#7dff9e";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < series.length; i++) {
          const x = x0 + (i / (maxPoints - 1)) * plotW;
          const v = series[i];
          const y = y0 - ((v - yMin) / (yMax - yMin)) * plotH;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#8de0a0";
        ctx.font = "11px Consolas, Menlo, Monaco, monospace";
        ctx.fillText("min " + yMin.toFixed(2), x0, 14);
        ctx.fillText("max " + yMax.toFixed(2), x0 + 130, 14);
        ctx.fillText("last " + series[series.length - 1].toFixed(3), x0 + 260, 14);
      }

      $("toggle").addEventListener("click", () => {
        vscode.postMessage({ type: "toggle", path: $("port").value, baudRate: Number($("baud").value || 9600) });
      });
      $("clear").addEventListener("click", () => vscode.postMessage({ type: "clear" }));

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "points") {
          for (const p of msg.points) {
            series.push(p);
            if (series.length > maxPoints) series.shift();
            if (p > yMax) yMax = p + 0.1;
          }
          draw();
        } else if (msg.type === "status") {
          setStatus(msg.status);
        } else if (msg.type === "clear") {
          series.length = 0;
          yMin = -0.2;
          yMax = 1.2;
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
    const customLibPath = "/Users/arosendo/Documents/Arduino/libraries/AdvancedAnalog/";
    if (fs2.existsSync(customLibPath)) {
      const exDir = path3.join(customLibPath, "examples");
      if (fs2.existsSync(exDir)) {
        try {
          const subdirs = fs2.readdirSync(exDir, { withFileTypes: true }).filter(d => d.isDirectory());
          for (const sd of subdirs) {
            rows.push({ library: "Filtered analog", example: sd.name, fullPath: path3.join(exDir, sd.name) });
          }
        } catch(e) {}
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
    return `<!doctype html>
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
      .refresh { width:30px; text-align:center; font-size:13px; border:1px solid var(--stroke); border-radius:6px; padding:4px 0; color:var(--soft); background:#0d130d; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="row">
        <div>
          <div class="muted">Search Text</div>
          <input id="query" placeholder="blink, imu, wifi" />
        </div>
        <a class="refresh" href="#" onclick="vscode.postMessage({type:'list',library:''});return false">\u21BB</a>
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

// src/ui/managersPanel.ts
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
var ManagersPanel = class {
  constructor(context, output, actions) {
    this.context = context;
    this.output = output;
    this.actions = actions;
  }
  context;
  output;
  actions;
  panel = null;
  show() {
    if (!this.panel) {
      this.panel = vscode5.window.createWebviewPanel(
        "arduinoMcp.managers",
        "Mngrs",
        vscode5.ViewColumn.Beside,
        { enableScripts: true }
      );
      this.panel.onDidDispose(() => this.panel = null);
      this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    } else {
      this.panel.title = "Mngrs";
      this.panel.reveal(vscode5.ViewColumn.Beside);
    }
    this.panel.webview.html = this.html();
  }
  async onMessage(msg) {
    if (!this.panel || !msg?.type) return;
    const post = (payload) => void this.panel?.webview.postMessage(payload);
    try {
      if (msg.type === "updateIndexes") {
        this.output.appendLine("[Mngrs] Updating board and library indexes...");
        const res1 = await runArduinoCli(["core", "update-index"]);
        this.output.appendLine(res1.stdout);
        this.output.appendLine(res1.stderr);
        const res2 = await runArduinoCli(["lib", "update-index"]);
        this.output.appendLine(res2.stdout);
        this.output.appendLine(res2.stderr);
        const boards = await runArduinoCli(["core", "list", "--json"]);
        if (boards.success) {
          const rows = parseInstalledBoards(boards.stdout);
          post({ type: "boards", rows });
          this.output.appendLine(`[Mngrs] Loaded ${rows.length} installed boards.`);
        } else {
          post({ type: "error", error: boards.stderr || boards.stdout });
        }
      } else if (msg.type === "boardSearch") {
        const boards = await runArduinoCli(["core", "list", "--json"]);
        if (!boards.success) {
          post({ type: "error", error: boards.stderr || boards.stdout });
          return;
        }
        post({ type: "boards", rows: parseInstalledBoards(boards.stdout), query: String(msg.query ?? "") });
      } else if (msg.type === "chooseTarget") {
        const fqbn = String(msg.fqbn ?? "").trim();
        if (!fqbn) {
          post({ type: "error", error: "Select a board first." });
          return;
        }
        this.output.appendLine(`[Mngrs] Choosing target ${fqbn}...`);
        await this.actions.chooseTarget(fqbn);
      } else if (msg.type === "uploadFirmwareToTarget") {
        const fqbn = String(msg.fqbn ?? "").trim();
        if (!fqbn) {
          post({ type: "error", error: "Select a board first." });
          return;
        }
        this.output.appendLine(`[Mngrs] Upload firmware to target ${fqbn}...`);
        await this.actions.uploadFirmwareToTarget(fqbn);
      } else if (msg.type === "libList") {
        const res = await runArduinoCli(["lib", "list", "--json"]);
        if (!res.success) {
          post({ type: "error", error: res.stderr || res.stdout });
          return;
        }
        post({ type: "libraries", rows: parseLibraries(res.stdout) });
      } else if (msg.type === "libSearch") {
        const q = String(msg.query ?? "").trim();
        const res = await runArduinoCli(["lib", "search", q, "--json"]);
        if (!res.success) {
          post({ type: "error", error: res.stderr || res.stdout });
          return;
        }
        post({ type: "libraries", rows: parseLibraries(res.stdout) });
      } else if (msg.type === "libInstallSelected") {
        const name = String(msg.name ?? "").trim();
        if (!name) {
          post({ type: "error", error: "Select a library first." });
          return;
        }
        this.output.appendLine(`[Mngrs] Installing library ${name}...`);
        const res = await runArduinoCli(["lib", "install", name]);
        this.output.appendLine(res.stdout);
        this.output.appendLine(res.stderr);
        if (!res.success) {
          post({ type: "error", error: res.stderr || res.stdout });
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.output.appendLine(`[Mngrs] Error: ${err}`);
      post({ type: "error", error: err });
    }
  }
  html() {
    return `<!doctype html>
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
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      input, button {
        background: #0d130d;
        color: var(--ink);
        border: 1px solid var(--stroke);
        border-radius: 6px;
        padding: 6px 7px;
        font-size: 11px;
      }
      input { min-width: 200px; }
      a { color: var(--ink); cursor: pointer; font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size: 11px; text-decoration: none; display: inline; }
      a:hover { text-decoration: underline; }
      a.c-std { color: var(--ink); }
      a.c-green { color: #55efc4; }
      a.c-amber { color: #f6c542; }
      .muted { color: var(--muted); font-size: 10px; }
      .split { display: grid; grid-template-columns: 1.1fr 1fr; gap: 9px; }
      @media (max-width: 980px) { .split { grid-template-columns: 1fr; } }
      .list { max-height: 40vh; overflow:auto; display:flex; flex-direction:column; gap:7px; margin-top:8px; }
      .item { border: 1px solid var(--stroke); border-radius: 7px; padding: 7px; background: #0d130d; cursor: pointer; }
      .item.active { border-color: #58aa58; box-shadow: 0 0 0 1px #58aa58 inset; }
      .name { font-weight: 700; font-size: 11px; color: var(--soft); }
      .meta { color: var(--muted); font-size: 10px; margin-top: 2px; overflow-wrap: anywhere; }
      #err { color:#ffb4b4; white-space:pre-wrap; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="row">
        <div class="muted">Mngrs</div>
        <div style="margin-left:auto"><a class="c-std" id="update" href="#" onclick="event.preventDefault()">||Update indexes||</a></div>
      </div>
      <div id="err"></div>
    </div>

    <div class="split">
      <div class="card">
        <div class="row">
          <a class="c-std" id="chooseTarget" href="#" onclick="event.preventDefault()">||Choose as target||</a>
          <a class="c-amber" id="uploadFirmware" href="#" onclick="event.preventDefault()">||Upload firmware||</a>
        </div>
        <div class="row" style="margin-top:8px">
          <input id="boardQuery" placeholder="Search board"/>
          <a class="c-std" id="boardSearch" href="#" onclick="event.preventDefault()">||Search||</a>
        </div>
        <div class="list" id="boardsList"></div>
      </div>

      <div class="card">
        <div class="row">
          <a class="c-std" id="libList" href="#" onclick="event.preventDefault()">||List installed||</a>
          <a class="c-green" id="libInstallSelected" href="#" onclick="event.preventDefault()">||Install library||</a>
        </div>
        <div class="row" style="margin-top:8px">
          <input id="libQuery" placeholder="Search library"/>
          <a class="c-std" id="libSearch" href="#" onclick="event.preventDefault()">||Search||</a>
        </div>
        <div class="list" id="libsList"></div>
      </div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);

      let boards = [];
      let libs = [];
      let selectedFqbn = "";
      let selectedLib = "";
      let boardQuery = "";

      function esc(s) {
        return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      }

      function renderBoards() {
        const filtered = boards.filter((b) => {
          const q = boardQuery.toLowerCase();
          if (!q) return true;
          return (b.name + " " + b.fqbn + " " + b.platform).toLowerCase().includes(q);
        });

        if (!filtered.length) {
          $("boardsList").innerHTML = "<div class='muted'>No installed boards found.</div>";
          return;
        }
        $("boardsList").innerHTML = filtered.map((b) => {
          const active = selectedFqbn === b.fqbn ? "active" : "";
          return "<div class='item " + active + "' data-fqbn='" + esc(b.fqbn) + "'><div class='name'>" + esc(b.name) + "</div><div class='meta'>" + esc(b.fqbn) + " | " + esc(b.platform) + " @ " + esc(b.version) + "</div></div>";
        }).join("");

        document.querySelectorAll("#boardsList .item").forEach((el) => {
          el.addEventListener("click", () => {
            selectedFqbn = el.getAttribute("data-fqbn") || "";
            renderBoards();
          });
        });
      }

      function renderLibs() {
        if (!libs.length) {
          $("libsList").innerHTML = "<div class='muted'>No libraries loaded.</div>";
          return;
        }
        $("libsList").innerHTML = libs.map((l) => {
          const active = selectedLib === l.name ? "active" : "";
          const right = l.version || l.author || l.sentence || "";
          return "<div class='item " + active + "' data-lib='" + esc(l.name) + "'><div class='name'>" + esc(l.name) + "</div><div class='meta'>" + esc(right) + "</div></div>";
        }).join("");

        document.querySelectorAll("#libsList .item").forEach((el) => {
          el.addEventListener("click", () => {
            selectedLib = el.getAttribute("data-lib") || "";
            renderLibs();
          });
        });
      }

      $("update").addEventListener("click", () => vscode.postMessage({ type: "updateIndexes" }));
      $("boardSearch").addEventListener("click", () => {
        boardQuery = $("boardQuery").value || "";
        vscode.postMessage({ type: "boardSearch", query: boardQuery });
      });
      $("chooseTarget").addEventListener("click", () => vscode.postMessage({ type: "chooseTarget", fqbn: selectedFqbn }));
      $("uploadFirmware").addEventListener("click", () => vscode.postMessage({ type: "uploadFirmwareToTarget", fqbn: selectedFqbn }));

      $("libList").addEventListener("click", () => vscode.postMessage({ type: "libList" }));
      $("libSearch").addEventListener("click", () => vscode.postMessage({ type: "libSearch", query: $("libQuery").value }));
      $("libInstallSelected").addEventListener("click", () => vscode.postMessage({ type: "libInstallSelected", name: selectedLib }));

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "error") {
          $("err").textContent = msg.error || "";
        } else if (msg.type === "boards") {
          boards = Array.isArray(msg.rows) ? msg.rows : [];
          if (!selectedFqbn && boards.length) selectedFqbn = boards[0].fqbn;
          if (typeof msg.query === "string") boardQuery = msg.query;
          renderBoards();
        } else if (msg.type === "libraries") {
          libs = Array.isArray(msg.rows) ? msg.rows : [];
          if (!selectedLib && libs.length) selectedLib = libs[0].name;
          renderLibs();
        }
      });

      vscode.postMessage({ type: "updateIndexes" });
      vscode.postMessage({ type: "libList" });
    </script>
  </body>
</html>`;
  }
};

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
    return `<!doctype html>
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
  constructor(context) {
    this.context = context;
  }
  context;
  static viewType = "arduinoMcp.toolbar";
  view = null;
  state = {
    port: null,
    fqbn: null,
    connectedPorts: [],
    serverRunning: false,
    serverHealthy: false,
    lastScanAtMs: null
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
        } catch {}
      }
      if (!inoFile) { vscode7.window.showWarningMessage("Arduino Grease: No .ino file found in this example."); return; }
      const doc = await vscode7.workspace.openTextDocument(vscode7.Uri.file(inoFile));
      await vscode7.window.showTextDocument(doc, { preview: false });
    }
  }
  html(webview) {
    const iconUri = webview.asWebviewUri(vscode7.Uri.joinPath(this.context.extensionUri, "resources", "icon.png"));
    return `<!doctype html>
<html>
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

<div class="panel-area" id="panelArea">
    <canvas class="rain" id="rainCanvas"></canvas>
    <div class="panel-content">

      <div class="tab-panel active" id="panel-board">
        <span class="ascii-line"><span class="dim">+------------ -  -   +</span></span>
        <span class="ascii-line"><span class="dim">| </span>Ports and Boards</span>
        <span class="ascii-line"><span class="dim">|</span></span>
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
          <div class="act-row"> <a class="c-blue"    href="#" onclick="cmd('arduinoMcp.openSerialMonitor');return false">||Serial||</a></div>
          <div class="act-row"> <a class="c-teal" href="#" onclick="cmd('arduinoMcp.openSerialPlotter');return false">||Plotter||</a></div>
          <div class="act-row"> <a class="c-blue"   href="#" onclick="switchTab('examples');return false">||Examples||</a></div>
          <div class="act-row"> <a class="c-teal"  href="#" onclick="switchTab('managers');return false">||Managers||</a></div>
          <div class="act-row"> <a class="c-purple"   href="#" onclick="switchTab('prompt');return false">||AI Prompt||</a></div>
          <div class="act-row"><span class="dim">+   -   -  - ----------+</span></div>
        </div>
        <div class="server-section">
          AI Tether <a class="dim" href="#" onclick="cmd('arduinoMcp.refreshServer');return false">||R||</a>
          <div class="server-line">
            <span class="sblock" id="serverBlock" style="color:#49c06b" onclick="cmd('arduinoMcp.toggleServer')">&#x2588;</span>
            <span style="color:var(--muted);font-size:10px" id="serverStatus">running</span>
          </div>
        </div>
        <div class="logo-area">
          <img class="logo-img" id="logoImg" src="${iconUri}" />
        </div>
      </div>

      <div class="tab-panel" id="panel-managers">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>Mngrs</span>
          <a class="c-std" href="#" onclick="cmd('arduinoMcp.openManagers');return false">||Update indexes||</a>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Library</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" href="#" onclick="cmd('arduinoMcp.openManagers');return false">||List installed||</a>
              <a class="c-green" href="#" onclick="cmd('arduinoMcp.openManagers');return false">||Install selected||</a>
            </div>
            <input class="libQuery" placeholder="wire, servo, wifi..." oninput="searchLibs(this.value)" onkeydown="if(event.key==='Enter')searchLibs(this.value)" />
            <div class="mgr-list libsList"></div>
          </div>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Board</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" href="#" onclick="cmd('arduinoMcp.openManagers');return false">||Choose as target||</a>
              <a class="c-amber" href="#" onclick="cmd('arduinoMcp.openManagers');return false">||Upload firmware||</a>
            </div>
            <input class="boardQuery" placeholder="arduino, esp32, rp2040..." oninput="searchBoards(this.value)" onkeydown="if(event.key==='Enter')searchBoards(this.value)" />
            <div class="mgr-list boardsList"></div>
          </div>
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
          <a class="c-std" href="#" onclick="cmd('arduinoMcp.openBoardTemplate');return false">||Update indexes||</a>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Library</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" href="#" onclick="cmd('arduinoMcp.openBoardTemplate');return false">||List installed||</a>
              <a class="c-green" href="#" onclick="cmd('arduinoMcp.openBoardTemplate');return false">||Install selected||</a>
            </div>
            <input class="libQuery" placeholder="wire, servo, wifi..." oninput="searchLibs(this.value)" onkeydown="if(event.key==='Enter')searchLibs(this.value)" />
            <div class="mgr-list libsList"></div>
          </div>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Board</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" href="#" onclick="cmd('arduinoMcp.openBoardTemplate');return false">||Choose as target||</a>
              <a class="c-amber" href="#" onclick="cmd('arduinoMcp.openBoardTemplate');return false">||Upload firmware||</a>
            </div>
            <input class="boardQuery" placeholder="arduino, esp32, rp2040..." oninput="searchBoards(this.value)" onkeydown="if(event.key==='Enter')searchBoards(this.value)" />
            <div class="mgr-list boardsList"></div>
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
  if (panel === 'examples') vscode.postMessage({type:'list',library:''});
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
    const inRepel = (st === 'thrust' ? dist < 40 : dist < 60);
    const inHalt = (st === 'thrust' && dist < 10);
    
    if(inHalt && !d.halted){
      d.halted = true;
      d.o = (d.o || 0) + 0.1;
      d.blue = true;
    } else if(!inHalt) {
      d.halted = false;
    }

    let bo,ho,fz,sp;
    if(st==='error'){bo=0.30;ho=0.30;fz=13;sp=0;}
    else if(st==='bright'){bo=Math.min(1,(inRepel?0.40:0.03)+0.12);ho=Math.min(1,(inRepel?0.80:0.10)+0.50);fz=13;sp=inRepel?(3+(60-dist)*0.08):(1.2+Math.random()*0.6);}
    else if(st==='thrust'){
      bo=(inRepel?0.40:0.08) + d.o + thrustOpacityBoost;
      ho=(inRepel?0.80:0.15) + d.o + thrustOpacityBoost;
      fz=inRepel?13:12;
      sp=inHalt?0:(inRepel?(3+(60-dist)*0.08):2.8) * thrustSpeedMult;
    }
    else{bo=Math.min(1,(inRepel?0.40:0.03)+d.o); ho=Math.min(1,(inRepel?0.80:0.10)+d.o); fz=inRepel?13:12; sp=inRepel?(3+(60-dist)*0.08):(1.2+Math.random()*0.6);}
    
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


function setServer(state) {
  const block = document.getElementById('serverBlock');
  const status = document.getElementById('serverStatus');
  if (!state.serverRunning) { block.style.color='#6f6f6f'; status.textContent='stopped'; return; }
  if (state.serverHealthy) { block.style.color='#49c06b'; status.textContent='running'; return; }
  block.style.color='#d2b046'; status.textContent='starting...';
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
    document.getElementById('fqbnVal').textContent = s.fqbn || '?';
    setServer(s);
  } else if (msg.type === 'verifyResult') {
    if(msg.success && rainState === 'thrust') {
      thrustOpacityBoost += 0.1;
      thrustSpeedMult *= (1.3 + Math.random() * 1.2);
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
  }
});



const boardsMock=[{name:'Arduino AVR Boards',id:'arduino:avr',version:'1.8.6'},{name:'ESP32 Arduino',id:'esp32:esp32',version:'2.0.14'},{name:'Raspberry Pi Pico',id:'rp2040:rp2040',version:'3.9.3'},{name:'Arduino SAMD',id:'arduino:samd',version:'1.8.14'},{name:'STM32 Arduino',id:'STM:stm32',version:'2.7.1'},{name:'nRF52 Boards',id:'adafruit:nrf52',version:'1.3.0'}];
const libsMock=[{name:'Wire',version:'1.0.0',desc:'I2C protocol'},{name:'Servo',version:'1.2.1',desc:'Servo motors'},{name:'WiFi',version:'1.2.7',desc:'WiFi connectivity'},{name:'FastLED',version:'3.6.0',desc:'LED animation'},{name:'ArduinoJson',version:'7.1.0',desc:'JSON parsing'},{name:'PubSubClient',version:'2.8.0',desc:'MQTT messaging'}];
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function searchBoards(q){const els=document.querySelectorAll('.boardsList');const f=boardsMock.filter(b=>!q||b.name.toLowerCase().includes(q.toLowerCase())||b.id.toLowerCase().includes(q.toLowerCase()));const html=f.length?f.map(b=>'<div class="mgr-item"><div class="name">'+esc(b.name)+'</div><div class="meta">'+esc(b.id)+' v'+b.version+'</div></div>').join(''):'<div style="color:var(--muted);font-size:10px">No boards found.</div>';els.forEach(el=>el.innerHTML=html);}
function searchLibs(q){const els=document.querySelectorAll('.libsList');const f=libsMock.filter(l=>!q||l.name.toLowerCase().includes(q.toLowerCase())||l.desc.toLowerCase().includes(q.toLowerCase()));const html=f.length?f.map(l=>'<div class="mgr-item"><div class="name">'+esc(l.name)+'</div><div class="meta">v'+l.version+' '+esc(l.desc)+'</div></div>').join(''):'<div style="color:var(--muted);font-size:10px">No libraries found.</div>';els.forEach(el=>el.innerHTML=html);}
searchBoards('');searchLibs('');
function onUploadClick(){setRainState('thrust');cmd('arduinoMcp.upload');}
</script>

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
  const toolbar = new ArduinoToolbarViewProvider(context);
  context.subscriptions.push(vscode8.window.registerWebviewViewProvider(ArduinoToolbarViewProvider.viewType, toolbar));
  let lastCandidates = [];
  let lastPorts = /* @__PURE__ */ new Set();
  let currentTarget = await loadTarget(context);
  const refreshToolbarState = () => {
    toolbar.setState({
      port: currentTarget?.port ?? null,
      fqbn: currentTarget?.fqbn ?? null,
      connectedPorts: Array.from(lastPorts),
      serverRunning: serverProcess !== null,
      serverHealthy,
      lastScanAtMs
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
      status.tooltip = "Port detected but board not resolved";
    }
  };
  const checkServerHealth = async (verbose = false) => {
    if (!serverProcess) {
      serverHealthy = false;
      refreshToolbarState();
      return;
    }
    try {
      const health = await getHealth();
      const ok = Boolean(health.ok && health.name === "arduino-mcp");
      serverHealthy = ok;
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
    }
    const candidatesWithFqbn = lastCandidates.filter((c) => typeof c.fqbn === "string" && typeof c.port === "string");
    const portsOnly = lastCandidates.filter((c) => !c.fqbn && typeof c.port === "string");
    if (!currentTarget && candidatesWithFqbn.length === 1) {
      const only = candidatesWithFqbn[0];
      currentTarget = { port: only.port, fqbn: only.fqbn };
      await saveTarget(context, currentTarget);
    } else if (!currentTarget && candidatesWithFqbn.length === 0 && portsOnly.length === 1) {
      const onlyPort = portsOnly[0];
      currentTarget = { port: onlyPort.port, fqbn: null };
      await saveTarget(context, currentTarget);
    }
    if (currentTarget?.port) {
      const samePort = lastCandidates.filter((c) => c.port === currentTarget.port && typeof c.fqbn === "string");
      if (samePort.length > 0) {
        const detectedFqbn = samePort[0].fqbn;
        if (detectedFqbn && detectedFqbn !== currentTarget.fqbn) {
          currentTarget = { port: currentTarget.port, fqbn: detectedFqbn };
          await saveTarget(context, currentTarget);
          output.appendLine(`Target updated to current port FQBN: ${detectedFqbn}`);
        }
      }
    }
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
    }
    refreshToolbarState();
  };
  const refreshPortsAndBoard = async () => {
    output.show(true);
    const detection = await refreshBoards(output);
    lastCandidates = detection.candidates;
    if (currentTarget?.port) {
      const samePort = lastCandidates.filter((c) => c.port === currentTarget.port && typeof c.fqbn === "string");
      if (samePort.length > 0) {
        const chosen = samePort[0];
        currentTarget = { port: chosen.port, fqbn: chosen.fqbn };
        await saveTarget(context, currentTarget);
        setOk(currentTarget);
        refreshToolbarState();
        output.appendLine(`Refreshed target on same port: ${currentTarget.fqbn} @ ${currentTarget.port}`);
        portsRefreshArmed = false;
        return;
      }
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
    const picked = await promptForTarget(context, lastCandidates);
    if (picked) {
      currentTarget = picked;
      setOk(picked);
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
      vscode8.window.showErrorMessage("Arduino Grease: Verify failed (see Output).");
      return { ok: false };
    }
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
    const res = await runArduinoCli(["upload", "-p", port, "--fqbn", fqbn, sketchPath], sketchPath);
    output.appendLine(res.stdout);
    output.appendLine(res.stderr);
    if (!res.success) {
      vscode8.window.showErrorMessage("Arduino Grease: Upload failed (see Output).");
      return false;
    }
    vscode8.window.showInformationMessage("Arduino Grease: Upload succeeded.");
    return true;
  };
  const runFirmwareUpload = async (fqbn, port) => {
    output.show(true);
    const parts = fqbn.split(":");
    const pkg = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : fqbn;
    output.appendLine(`[Mngrs] Downloading/updating core package ${pkg}...`);
    const core = await runArduinoCli(["core", "install", pkg]);
    output.appendLine(core.stdout);
    output.appendLine(core.stderr);
    const tmpRoot = fs3.mkdtempSync(path4.join(os.tmpdir(), "arduino-grease-fw-"));
    const sketchName = "FirmwareRecovery";
    const sketchDir = path4.join(tmpRoot, sketchName);
    fs3.mkdirSync(sketchDir, { recursive: true });
    const ino = path4.join(sketchDir, `${sketchName}.ino`);
    fs3.writeFileSync(
      ino,
      [
        "// Arduino Grease firmware recovery sketch",
        "void setup(){",
        "  pinMode(LED_BUILTIN, OUTPUT);",
        "}",
        "void loop(){",
        "  digitalWrite(LED_BUILTIN, HIGH);",
        "  delay(120);",
        "  digitalWrite(LED_BUILTIN, LOW);",
        "  delay(120);",
        "}"
      ].join("\n"),
      "utf8"
    );
    output.appendLine(`[Mngrs] Compiling recovery firmware for ${fqbn}...`);
    const comp = await runArduinoCli(["compile", "-v", "--fqbn", fqbn, sketchDir], sketchDir);
    output.appendLine(comp.stdout);
    output.appendLine(comp.stderr);
    if (!comp.success) {
      vscode8.window.showErrorMessage("Arduino Grease: Firmware compile failed (see Output).");
      return;
    }
    output.appendLine(`[Mngrs] Uploading firmware to ${port}...`);
    const up = await runArduinoCli(["upload", "-v", "-p", port, "--fqbn", fqbn, sketchDir], sketchDir);
    output.appendLine(up.stdout);
    output.appendLine(up.stderr);
    if (!up.success) {
      vscode8.window.showErrorMessage("Arduino Grease: Firmware upload failed (see Output).");
      return;
    }
    vscode8.window.showInformationMessage("Arduino Grease: Firmware uploaded to target.");
  };
  const managersPanel = new ManagersPanel(context, output, {
    chooseTarget: async (fqbn) => {
      const port = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      if (!port) {
        vscode8.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");
        return;
      }
      currentTarget = { port, fqbn };
      await saveTarget(context, currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
    },
    uploadFirmwareToTarget: async (fqbn) => {
      const port = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      if (!port) {
        vscode8.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");
        return;
      }
      currentTarget = { port, fqbn };
      await saveTarget(context, currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
      await runFirmwareUpload(fqbn, port);
    }
  });
  await reconcileTarget();
  await checkServerHealth(true);
  const targetInterval = setInterval(() => {
    void reconcileTarget();
  }, 3e4);
  const healthInterval = setInterval(() => {
    void checkServerHealth(false);
  }, 12e4);
  context.subscriptions.push({ dispose: () => clearInterval(targetInterval) });
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
      setTimeout(() => {
        void vscode8.commands.executeCommand("workbench.action.moveEditorToNewWindow");
      }, 200);
    }),
    vscode8.commands.registerCommand("arduinoMcp.openExamples", async () => {
      output.show(true);
      examplesPanel.show(currentTarget?.fqbn ?? null);
    }),
    vscode8.commands.registerCommand("arduinoMcp.openManagers", async () => {
      output.show(true);
      managersPanel.show();
    }),
    vscode8.commands.registerCommand("arduinoMcp.openBoardTemplate", async () => {
      output.show(true);
      boardTemplatePanel.show({ fqbn: currentTarget?.fqbn ?? null, port: currentTarget?.port ?? null });
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
