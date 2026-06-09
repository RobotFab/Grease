/**
 * ui/serialPlotterPanel.ts
 * ────────────────────────
 * Live serial-port plotter that opens in a VS Code webview panel.
 *
 * Parses each incoming line for numbers and renders them as time-series
 * traces on an HTML <canvas>. Two parser formats are accepted:
 *   • Labeled:  `sensor = 123, output = 456`   → labels become legend entries
 *   • Anonymous: `1.23 4.56 7.89`              → channels labeled ch1, ch2, ch3
 *
 * The whole plotting UI lives inside the embedded HTML+JS string at the
 * bottom of this file — VS Code webviews are sandboxed iframes, so we send
 * data points across with `webview.postMessage()` and receive UI events back
 * via `webview.onDidReceiveMessage()`.
 */

import * as vscode from "vscode";
import * as os from "node:os";
import { serialClose, serialOpen, serialRead } from "../serverHttpClient";

/** Pull every number-shaped token out of a line. */
function parseAllNumbers(line: string): number[] {
  const matches = line.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  const numbers: number[] = [];
  for (const m of matches) {
    const n = Number(m);
    if (Number.isFinite(n)) numbers.push(n);
  }
  return numbers;
}

/**
 * Try the labeled format first (`label = value`); if there are no label=value
 * pairs, fall back to parseAllNumbers. Returns labels and numbers in matching
 * order so the legend stays in sync with the channels.
 */
function parseLabeled(line: string): { labels: string[]; numbers: number[] } {
  const pairs: { label: string; value: number }[] = [];
  const re = /([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(line))) !== null) {
    pairs.push({ label: m[1], value: Number(m[2]) });
  }
  if (pairs.length > 0) {
    return { labels: pairs.map((p) => p.label), numbers: pairs.map((p) => p.value) };
  }
  return { labels: [], numbers: parseAllNumbers(line) };
}

export class SerialPlotterPanel {
  private panel: vscode.WebviewPanel | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor(private output: vscode.OutputChannel) {}

  /** Reveal (creating if needed) the plotter webview and optionally auto-connect. */
  show(defaultPort: string | null | undefined, autoConnect = true): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "arduinoMcp.serialPlotter",
        "Arduino Grease: Plttr",
        vscode.ViewColumn.Beside,
        { enableScripts: true },
      );
      this.panel.onDidDispose(() => this.dispose());
      this.panel.webview.onDidReceiveMessage((msg) => void this.onMessage(msg));
    }
    this.panel.title = "Arduino Grease: Plttr";
    this.panel.reveal(vscode.ViewColumn.Beside);
    this.panel.webview.html = this.html(defaultPort);
    this.startPolling();
    this.postStatus();
    if (autoConnect && defaultPort && !this.isConnected) {
      void this.connect(defaultPort, 9600);
    }
  }

  private dispose(): void {
    this.panel = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.isConnected) {
      void serialClose();
      this.isConnected = false;
    }
  }

  /** Open the serial port via the MCP server, retrying on transient errors (e.g. after board reset). */
  private async connect(port: string, baudRate: number): Promise<void> {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 600;
    let lastMsg = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await serialOpen({ path: port, baudRate });
        this.output.appendLine(`Serial connected (plotter): ${port} @ ${baudRate}`);
        this.isConnected = true;
        this.postStatus();
        return;
      } catch (e) {
        lastMsg = e instanceof Error ? e.message : String(e);
        const isPermDenied =
          lastMsg.includes("Permission denied") || lastMsg.includes("EACCES") || lastMsg.includes("EPERM");
        if (isPermDenied) break; // permission errors won't resolve with retries
        if (attempt < MAX_ATTEMPTS) {
          this.output.appendLine(`Serial open failed (plotter, attempt ${attempt}/${MAX_ATTEMPTS}): ${lastMsg} — retrying in ${RETRY_DELAY_MS}ms`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    const isPermDenied =
      lastMsg.includes("Permission denied") || lastMsg.includes("EACCES") || lastMsg.includes("EPERM");
    if (isPermDenied && os.platform() === "linux") {
      vscode.window
        .showErrorMessage(
          `Serial: Permission denied on ${port}. On Linux, run: sudo usermod -a -G dialout $USER — then log out and back in.`,
          "Copy Command",
        )
        .then((action) => {
          if (action === "Copy Command") {
            vscode.env.clipboard.writeText(`sudo usermod -a -G dialout $USER`);
          }
        });
    } else {
      vscode.window.showErrorMessage(`Serial: Failed to open ${port}: ${lastMsg}`);
    }
    this.output.appendLine(`Serial open failed (plotter): ${lastMsg}`);
  }

  /** Poll the server every 180 ms for new lines and push them into the webview. */
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.panel) return;
      if (!this.isConnected) return;
      void (async () => {
        try {
          const r = await serialRead();
          const points: number[][] = [];
          const labelBatch: string[][] = [];
          for (const line of r.lines ?? []) {
            const parsed = parseLabeled(String(line));
            if (parsed.numbers.length > 0) {
              points.push(parsed.numbers);
              labelBatch.push(parsed.labels);
            }
          }
          if (points.length) {
            this.panel?.webview.postMessage({ type: "points", points, labels: labelBatch });
          }
          this.panel?.webview.postMessage({ type: "status", status: r.serial });
        } catch {
          this.panel?.webview.postMessage({ type: "status", status: { isOpen: false } });
        }
      })();
    }, 180);
  }

  private postStatus(): void {
    if (!this.panel) return;
    this.panel.webview.postMessage({ type: "status", status: { isOpen: this.isConnected } });
  }

  private async onMessage(msg: any): Promise<void> {
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
      vscode.window.showErrorMessage(`Arduino Grease Plotter: ${err}`);
      this.postStatus();
    }
  }

  /** The embedded webview HTML — canvas, controls, and a small JS plotting loop. */
  private html(defaultPort: string | null | undefined): string {
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
}
