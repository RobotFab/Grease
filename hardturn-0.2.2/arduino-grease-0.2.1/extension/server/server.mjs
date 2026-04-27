import http from "node:http";
import { randomUUID } from "node:crypto";

import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import express from "express";

import { detectBoards, compileSketch, uploadSketch } from "./lib/arduinoCli.mjs";
import { SerialManager } from "./lib/serialManager.mjs";

const PORT = Number(process.env.MCP_PORT || process.env.PORT || "3333");
const HOST = process.env.MCP_HOST || "127.0.0.1";

const state = {
  target: /** @type {{ port: string|null, fqbn: string|null }} */ ({ port: null, fqbn: null }),
  sketchPath: process.cwd(),
};

const serial = new SerialManager();

function asTextResult(obj) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
  };
}

async function main() {
  const server = new McpServer(
    { name: "arduino-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool("detectBoards", { title: "Detect connected Arduino boards", inputSchema: {} }, async () => {
    const result = await detectBoards();
    return asTextResult(result);
  });

  server.registerTool(
    "setTarget",
    {
      title: "Set Arduino target (port + fqbn)",
      inputSchema: {
        type: "object",
        properties: {
          port: { type: "string" },
          fqbn: { type: "string" },
        },
        required: ["port", "fqbn"],
        additionalProperties: false,
      },
    },
    async ({ port, fqbn }) => {
      state.target.port = port;
      state.target.fqbn = fqbn;
      return asTextResult({ success: true, target: state.target });
    }
  );

  server.registerTool("getState", { title: "Get current server state", inputSchema: {} }, async () => {
    return asTextResult({ ...state, serial: serial.status() });
  });

  server.registerTool(
    "compileSketch",
    {
      title: "Compile sketch folder with current fqbn",
      inputSchema: {
        type: "object",
        properties: {
          sketchPath: { type: "string" },
          fqbn: { type: "string" },
        },
        required: ["sketchPath"],
        additionalProperties: false,
      },
    },
    async ({ sketchPath, fqbn }) => {
      const effectiveFqbn = fqbn || state.target.fqbn;
      if (!effectiveFqbn) return asTextResult({ success: false, error: "Target fqbn not set" });
      const result = await compileSketch({ fqbn: effectiveFqbn, sketchPath });
      return asTextResult(result);
    }
  );

  server.registerTool(
    "uploadSketch",
    {
      title: "Upload sketch folder to current port/fqbn",
      inputSchema: {
        type: "object",
        properties: {
          sketchPath: { type: "string" },
          fqbn: { type: "string" },
          port: { type: "string" },
        },
        required: ["sketchPath"],
        additionalProperties: false,
      },
    },
    async ({ sketchPath, fqbn, port }) => {
      const effectiveFqbn = fqbn || state.target.fqbn;
      const effectivePort = port || state.target.port;
      if (!effectiveFqbn || !effectivePort) {
        return asTextResult({ success: false, error: "Target port/fqbn not set" });
      }
      const result = await uploadSketch({ fqbn: effectiveFqbn, port: effectivePort, sketchPath });
      return asTextResult(result);
    }
  );

  server.registerTool(
    "serialOpen",
    {
      title: "Open serial port",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          baudRate: { type: "number" },
          delimiter: { type: "string" },
        },
        required: ["path", "baudRate"],
        additionalProperties: false,
      },
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
      inputSchema: {
        type: "object",
        properties: { data: { type: "string" } },
        required: ["data"],
        additionalProperties: false,
      },
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
      inputSchema: {
        type: "object",
        properties: { clear: { type: "boolean" } },
        additionalProperties: false,
      },
    },
    async ({ clear }) => {
      const lines = serial.read({ clear });
      return asTextResult({ success: true, lines });
    }
  );

  server.registerTool("serialClose", { title: "Close serial port", inputSchema: {} }, async () => {
    await serial.close();
    return asTextResult({ success: true, serial: serial.status() });
  });

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);

  const app = createMcpExpressApp({
    host: HOST,
    allowedHosts: ["localhost", "127.0.0.1"],
  });

  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, name: "arduino-mcp", port: PORT }));
  app.get("/state", (_req, res) => res.json({ ...state, serial: serial.status() }));

  // Simple REST endpoints for the IDE UI (avoids needing an MCP client in the extension host).
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
    await transport.handleRequest(req, res);
  });

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Arduino MCP server listening on http://${HOST}:${PORT} (MCP at /mcp)`);
  });

  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      // ignore
    }
    try {
      await serial.close();
    } catch {
      // ignore
    }
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

