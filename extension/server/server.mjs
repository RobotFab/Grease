import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import express from "express";
import { z } from "zod";

import { detectBoards, compileSketch, uploadSketch, enableUnsafeInstall, installLibrary } from "./lib/arduinoCli.mjs";
import { SerialManager } from "./lib/serialManager.mjs";

const PORT = Number(process.env.MCP_PORT || process.env.PORT || "3333");
const HOST = process.env.MCP_HOST || "127.0.0.1";
const AUTH_KEY = process.env.MCP_AUTH_KEY || "";

// Path to SKILL.md — lives alongside server.mjs so it travels with the extension.
const SKILL_PATH = path.join(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "SKILL.md");

const state = {
  target: /** @type {{ port: string|null, fqbn: string|null }} */ ({ port: null, fqbn: null }),
  sketchPath: process.cwd(),
};

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
    async () => asTextResult({ skill: readSkillMd(), path: SKILL_PATH })
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
      const result = await uploadSketch({ fqbn: effectiveFqbn, port: effectivePort, sketchPath: effectiveSketchPath });
      return asTextResult({ ...result, sketchPath: effectiveSketchPath });
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

  app.post("/serial/open", async (req, res) => {
    try {
      const { path, baudRate } = req.body ?? {};
      await serial.open({ path, baudRate });
      res.json({ ok: true, serial: serial.status() });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message ?? String(e) });
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

    // Run library installations in the background so as not to block server startup
    void (async () => {
      try {
        await enableUnsafeInstall();
        await installLibrary("Romi32U4");
        await installLibrary("wpi-32u4-library-with-bluemotor");
      } catch (e) {
        console.error("Background task failed:", e);
      }
    })();
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
