import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import express from "express";
import { z } from "zod";

import { detectBoards, compileSketch, uploadSketch, enableUnsafeInstall, installLibrary } from "./lib/arduinoCli.mjs";
import { SerialManager } from "./lib/serialManager.mjs";
import { usb } from "usb";

const PORT = Number(process.env.MCP_PORT || process.env.PORT || "3333");
const HOST = process.env.MCP_HOST || "127.0.0.1";

// ── Shared Grease state directory (vendor-neutral, lives outside the extension
//    folder so it survives version upgrades) ─────────────────────────────────
const _greaseDir = path.join(os.homedir(), ".grease");
try { fs.mkdirSync(_greaseDir, { recursive: true }); } catch (_e) {}

// ── Stable auth key (persists across restarts and version updates) ───────────
const _authStore       = path.join(_greaseDir, "mcp-auth.json");
const _legacyAuthStore = path.join(os.homedir(), ".grease-mcp-auth");
let AUTH_KEY;
try { AUTH_KEY = JSON.parse(fs.readFileSync(_authStore, "utf8")).key || null; } catch (_e) {}
if (!AUTH_KEY) {
  // One-time migration from the pre-v1.0.9 location at ~/.grease-mcp-auth
  try { AUTH_KEY = JSON.parse(fs.readFileSync(_legacyAuthStore, "utf8")).key || null; } catch (_e) {}
}
if (!AUTH_KEY) { AUTH_KEY = process.env.MCP_AUTH_KEY || randomUUID(); }
try {
  fs.writeFileSync(_authStore, JSON.stringify({ key: AUTH_KEY, port: PORT, updatedAt: new Date().toISOString() }));
  if (fs.existsSync(_legacyAuthStore)) {
    try { fs.unlinkSync(_legacyAuthStore); } catch (_e) {}
  }
} catch (_e) {}

// ── SKILL.md — bundled copy is the canonical source; auto-deployed to ~/.grease/SKILL.md ──
const _userSkill    = path.join(_greaseDir, "SKILL.md");
const _bundledSkill = path.join(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "SKILL.md");
function _getSkillVersion(filePath) {
  try {
    const firstLine = fs.readFileSync(filePath, "utf8").split("\n")[0];
    const m = firstLine.match(/grease-skill-version:\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  } catch { return 0; }
}
try {
  const bundledVersion = _getSkillVersion(_bundledSkill);
  const userVersion    = _getSkillVersion(_userSkill);
  if (!fs.existsSync(_userSkill) || bundledVersion > userVersion) {
    fs.copyFileSync(_bundledSkill, _userSkill);
  }
} catch (_e) {}
const SKILL_PATH = fs.existsSync(_userSkill) ? _userSkill : _bundledSkill;

// ── Multi-IDE MCP auto-registration ──────────────────────────────────────────
const _ideConfigs = [
  path.join(os.homedir(), ".claude", "settings.json"),
  ...(os.platform() === "darwin"
    ? [path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")]
    : []),
  ...(os.platform() === "win32" && process.env.APPDATA
    ? [path.join(process.env.APPDATA, "Claude", "claude_desktop_config.json")]
    : []),
  path.join(os.homedir(), ".cursor", "mcp.json"),
  path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
];
const _mcpEntry = { type: "http", url: `http://127.0.0.1:${PORT}/mcp`, headers: { "x-grease-auth": AUTH_KEY } };
for (const cfgPath of _ideConfigs) {
  if (!fs.existsSync(cfgPath)) continue;
  try {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch (_e) {}
    if (!cfg.mcpServers) cfg.mcpServers = {};
    // Skip writing only when the existing entry matches BOTH the auth key and
    // the URL. Checking only the key (pre-v1.0.9) left the URL stale whenever
    // the server bound to a different port across restarts.
    const _existing = cfg.mcpServers["arduino-grease"];
    if (
      _existing?.headers?.["x-grease-auth"] === AUTH_KEY &&
      _existing?.url === _mcpEntry.url
    ) continue;
    cfg.mcpServers["arduino-grease"] = _mcpEntry;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  } catch (_e) {}
}

const state = {
  target: /** @type {{ port: string|null, fqbn: string|null }} */ ({ port: null, fqbn: null }),
  sketchPath: process.cwd(),
  uploading: false,
  portChangeVersion: 0,
};

let _usbDebounce = null;
usb.on("attach", () => {
  if (state.uploading) return;
  clearTimeout(_usbDebounce);
  _usbDebounce = setTimeout(() => { state.portChangeVersion++; }, 1500);
});
usb.on("detach", () => {
  if (state.uploading) return;
  clearTimeout(_usbDebounce);
  state.portChangeVersion++;
});

const serial = new SerialManager();

function resolveSketchPath(sketchPath) {
  if (!sketchPath) return state.sketchPath;
  return path.resolve(sketchPath);
}

function asTextResult(obj) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
  };
}

/** Read SKILL.md, returning its text or a helpful fallback. */
function readSkillMd() {
  try {
    if (fs.existsSync(SKILL_PATH)) return fs.readFileSync(SKILL_PATH, "utf8");
    return "(SKILL.md not found — create it at: " + SKILL_PATH + ")";
  } catch (e) {
    return "(Error reading SKILL.md: " + (e?.message ?? String(e)) + ")";
  }
}

async function main() {
  // Log skill on startup so the IDE output channel shows it immediately.
  console.log("=== Arduino Grease SKILL.md ===");
  console.log(readSkillMd());
  console.log("================================");



  const server = new McpServer(
    { name: "arduino-mcp", version: "1.0" },
    {
      capabilities: {
        tools: {},
        prompts: {},
        tasks: { requests: { tools: { call: {} } } },
      },
    }
  );

  // ── SKILL tool ─────────────────────────────────────────────────────────────
  server.registerTool(
    "readSkill",
    {
      title: "Read Arduino Grease SKILL.md — read this FIRST before doing any work",
      description:
        "Returns the content of SKILL.md, which defines robot-specific behaviours, " +
        "constraints, and preferences for this project. Always call this tool at the " +
        "start of every session before writing or uploading any code.",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      const { port, fqbn } = state.target;
      const bothSet    = port !== null && fqbn !== null;
      const neitherSet = port === null && fqbn === null;
      let targetBlock;
      if (bothSet) {
        targetBlock =
          "\n\n---\n\n## Current Hardware Target\n\n" +
          `- **Port:** \`${port}\`\n` +
          `- **FQBN:** \`${fqbn}\`\n\n` +
          "> Target is already set. You do not need to call `detectBoards` or `getState` " +
          "before compiling or uploading — proceed directly to editing the sketch.\n";
      } else if (neitherSet) {
        targetBlock =
          "\n\n---\n\n## Current Hardware Target\n\n" +
          "> No board is currently selected. Call `detectBoards` to find connected hardware, " +
          "then call `setTarget` with the correct port and fqbn before compiling or uploading.\n";
      } else {
        targetBlock =
          "\n\n---\n\n## Current Hardware Target\n\n" +
          `- **Port:** \`${port ?? "(not set)"}\`\n` +
          `- **FQBN:** \`${fqbn ?? "(not set)"}\`\n\n` +
          "> Target is partially configured. Call `detectBoards` then `setTarget` to supply " +
          "the missing value before compiling or uploading.\n";
      }
      return asTextResult({ skill: readSkillMd() + targetBlock, path: SKILL_PATH });
    }
  );

  // ── Session-init prompt ─────────────────────────────────────────────────────
  server.registerPrompt(
    "grease-init",
    {
      title: "Arduino Grease: Initialize Session",
      description:
        "Inject at the start of every Arduino Grease session. Instructs the AI to " +
        "read SKILL.md, server.mjs, and the current board state before doing any work.",
    },
    () => {
      const authFile = _authStore;
      const skillPath = SKILL_PATH;
      const serverSrcPath = _bundledSkill.replace("SKILL.md", "server.mjs");
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "Arduino Grease is installed and active. Before doing any work, perform these three reads in order:",
                "",
                `1. **Read SKILL.md** — located at: \`${skillPath}\``,
                "   This file defines the robot skill, constraints, and operating rules for this project.",
                "",
                `2. **Read server.mjs** — located at: \`${serverSrcPath}\``,
                "   This is the MCP server source. It shows available tools, REST endpoints, and auth setup.",
                "",
                `3. **Fetch /state** — read the auth key and port from \`${authFile}\`, then:`,
                "   ```",
                "   GET http://127.0.0.1:<port>/state",
                "   Header: x-grease-auth: <key>",
                "   ```",
                "   This returns the current board target (port + fqbn), sketch path, and serial status.",
                "",
                "Do not write, compile, or upload any code until all three reads are complete.",
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── Board tools ─────────────────────────────────────────────────────────────
  server.registerTool(
    "detectBoards",
    {
      title: "Detect connected Arduino boards",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      const result = await detectBoards();
      return asTextResult(result);
    }
  );

  server.registerTool(
    "setTarget",
    {
      title: "Set Arduino target (port + fqbn)",
      inputSchema: z.object({
        port: z.string(),
        fqbn: z.string(),
      }).strict(),
    },
    async ({ port, fqbn }) => {
      state.target.port = port;
      state.target.fqbn = fqbn;
      return asTextResult({ success: true, target: state.target });
    }
  );

  server.registerTool(
    "getState",
    {
      title: "Get current server state",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      return asTextResult({ ...state, serial: serial.status() });
    }
  );

  server.registerTool(
    "compileSketch",
    {
      title: "Compile sketch folder with current fqbn",
      inputSchema: z.object({
        sketchPath: z.string().optional(),
        fqbn: z.string().optional(),
      }).strict(),
    },
    async ({ sketchPath, fqbn }) => {
      const effectiveFqbn = fqbn || state.target.fqbn;
      if (!effectiveFqbn) return asTextResult({ success: false, error: "Target fqbn not set" });
      const effectiveSketchPath = resolveSketchPath(sketchPath);
      if (!fs.existsSync(effectiveSketchPath)) {
        return asTextResult({ success: false, error: `Sketch path not found: ${effectiveSketchPath}` });
      }
      state.sketchPath = effectiveSketchPath;
      const result = await compileSketch({ fqbn: effectiveFqbn, sketchPath: effectiveSketchPath });
      return asTextResult({ ...result, sketchPath: effectiveSketchPath });
    }
  );

  server.registerTool(
    "uploadSketch",
    {
      title: "Upload sketch folder to current port/fqbn",
      inputSchema: z.object({
        sketchPath: z.string().optional(),
        fqbn: z.string().optional(),
        port: z.string().optional(),
      }).strict(),
    },
    async ({ sketchPath, fqbn, port }) => {
      const effectiveFqbn = fqbn || state.target.fqbn;
      const effectivePort = port || state.target.port;
      if (!effectiveFqbn || !effectivePort) {
        return asTextResult({ success: false, error: "Target port/fqbn not set" });
      }
      const effectiveSketchPath = resolveSketchPath(sketchPath);
      if (!fs.existsSync(effectiveSketchPath)) {
        return asTextResult({ success: false, error: `Sketch path not found: ${effectiveSketchPath}` });
      }
      state.sketchPath = effectiveSketchPath;
      state.uploading = true;
      try {
        const result = await uploadSketch({ fqbn: effectiveFqbn, port: effectivePort, sketchPath: effectiveSketchPath });
        return asTextResult({ ...result, sketchPath: effectiveSketchPath });
      } finally {
        state.uploading = false;
      }
    }
  );

  // ── Serial tools ────────────────────────────────────────────────────────────
  server.registerTool(
    "serialOpen",
    {
      title: "Open serial port",
      inputSchema: z.object({
        path: z.string(),
        baudRate: z.number(),
        delimiter: z.string().optional(),
      }).strict(),
    },
    async ({ path, baudRate, delimiter }) => {
      await serial.open({ path, baudRate, delimiter });
      return asTextResult({ success: true, serial: serial.status() });
    }
  );

  server.registerTool(
    "serialWrite",
    {
      title: "Write to serial port",
      inputSchema: z.object({
        data: z.string(),
      }).strict(),
    },
    async ({ data }) => {
      await serial.write({ data });
      return asTextResult({ success: true });
    }
  );

  server.registerTool(
    "serialRead",
    {
      title: "Read buffered serial lines",
      inputSchema: z.object({
        clear: z.boolean().optional(),
      }).strict(),
    },
    async ({ clear }) => {
      const lines = serial.read({ clear });
      return asTextResult({ success: true, lines });
    }
  );

  server.registerTool(
    "serialClose",
    {
      title: "Close serial port",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      await serial.close();
      return asTextResult({ success: true, serial: serial.status() });
    }
  );

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);

  const app = createMcpExpressApp({
    host: HOST,
    allowedHosts: ["localhost", "127.0.0.1"],
  });

  app.use(express.json({ limit: "1mb" }));

  // ── Auth middleware ─────────────────────────────────────────────────────────
  // All routes except /health require the shared auth key.
  app.use((req, res, next) => {
    if (req.path === "/health") return next();        // health check is always open
    if (!AUTH_KEY) return next();                     // dev fallback: no key set = open
    const provided = req.headers["x-grease-auth"];
    if (provided !== AUTH_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    next();
  });

  // ── REST endpoints ──────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ ok: true, name: "arduino-mcp", port: PORT }));
  app.get("/state", (_req, res) => res.json({ ...state, serial: serial.status() }));
  app.get("/skill", (_req, res) => res.type("text/plain").send(readSkillMd()));
  app.get("/detect", async (_req, res) => {
    const result = await detectBoards();
    res.json(result);
  });

  app.post("/serial/open", async (req, res) => {
    try {
      const { path, baudRate } = req.body ?? {};
      await serial.open({ path, baudRate });
      res.json({ ok: true, serial: serial.status() });
    } catch (e) {
      const msg = e?.message ?? String(e);
      const isPermDenied = msg.includes("Permission denied") || msg.includes("EACCES") || msg.includes("EPERM");
      const hint = isPermDenied && process.platform === "linux"
        ? " On Linux, add yourself to the dialout group: sudo usermod -a -G dialout $USER — then log out and back in."
        : "";
      res.status(400).json({ ok: false, error: msg + hint });
    }
  });
  app.post("/serial/close", async (_req, res) => {
    await serial.close();
    res.json({ ok: true, serial: serial.status() });
  });
  app.post("/serial/write", async (req, res) => {
    try {
      const { data } = req.body ?? {};
      await serial.write({ data: String(data ?? "") });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
  app.post("/serial/read", async (_req, res) => {
    const lines = serial.read({ clear: true });
    res.json({ ok: true, lines, serial: serial.status() });
  });

  app.post("/target", (req, res) => {
    const { port, fqbn } = req.body ?? {};
    state.target.port = port ?? null;
    state.target.fqbn = fqbn ?? null;
    res.json({ ok: true, target: state.target });
  });

  app.post("/mcp", async (req, res) => {
    const requestBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    try {
      await transport.handleRequest(req, res, requestBody);
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message ?? String(error) });
    }
  });

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Arduino MCP server listening on http://${HOST}:${PORT} (MCP at /mcp)`);
    // eslint-disable-next-line no-console
    console.log(`Arduino MCP auth key: ${AUTH_KEY}`);

    void enableUnsafeInstall().catch(() => {});
  });

  const shutdown = async () => {
    try { await server.close(); } catch { /* ignore */ }
    try { await serial.close(); } catch { /* ignore */ }
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
