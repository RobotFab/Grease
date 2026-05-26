/**
 * serverProcess.ts
 * ────────────────
 * Spawns the bundled MCP server (extension/server/server.mjs → dist/server.mjs)
 * as a Node child process and returns a handle the extension can use to talk
 * to it (and to stop it on shutdown).
 *
 * Why a child process and not in-process?
 *   The MCP server uses `serialport` and `usb` native modules that link against
 *   the system's Node — running them inside the VS Code extension host can
 *   crash the IDE on incompatible ABI versions. A separate `node` process
 *   isolates that risk and lets us bind a unique port without conflicting
 *   with other VS Code windows.
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as net from "node:net";
import * as os from "node:os";
import * as fs from "node:fs";
import { randomBytes } from "node:crypto";
import type { ExtensionContext, OutputChannel } from "vscode";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Resolve to true if the port is bindable on 127.0.0.1, false if something already holds it. */
function canBind(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Try `preferred` first, then scan upward for ~60 ports. We do this because
 * users frequently run multiple VS Code windows on the same machine; each one
 * gets its own MCP server on its own port.
 */
async function pickPort(preferred = 3333): Promise<number> {
  if (await canBind(preferred)) return preferred;
  for (let p = preferred + 1; p < preferred + 60; p++) {
    if (await canBind(p)) return p;
  }
  throw new Error("No free local port found for Arduino MCP server");
}

export interface ServerHandle {
  port: number;
  authKey: string;
  stop: () => Promise<void>;
}

/**
 * Start the bundled `dist/server.mjs` as a Node child process.
 *
 * We pass three env vars:
 *   - `MCP_PORT`     — which port the server should bind (the one we picked above)
 *   - `MCP_HOST`     — loopback, never exposed externally
 *   - `MCP_AUTH_KEY` — shared secret used in the `x-grease-auth` header
 *
 * The server preserves auth keys across restarts via `~/.grease/mcp-auth.json`
 * (see server.mjs). If a previous key exists we reuse it so any AI agent
 * configs still authenticate.
 */
export async function startBundledServer(
  context: ExtensionContext,
  output: OutputChannel,
  preferredPort = 3333,
): Promise<ServerHandle> {
  const port = await pickPort(preferredPort);
  const nodePath = process.env.ARDUINO_MCP_NODE_PATH || "node";
  const serverPath = context.asAbsolutePath(path.join("dist", "server.mjs"));

  // Prefer the previously persisted auth key (so external AI clients don't break
  // on restart). Fall back to a fresh random one. The server itself will write
  // whatever key it ends up using back to ~/.grease/mcp-auth.json.
  let authKey: string | null = null;
  try {
    const newStore = path.join(os.homedir(), ".grease", "mcp-auth.json");
    const stored = JSON.parse(fs.readFileSync(newStore, "utf8"));
    authKey = stored.key || null;
  } catch {
    /* fall through to legacy path / random key */
  }
  if (!authKey) {
    try {
      const legacy = path.join(os.homedir(), ".grease-mcp-auth");
      const stored = JSON.parse(fs.readFileSync(legacy, "utf8"));
      authKey = stored.key || null;
    } catch {
      /* no stored key — generate a new one */
    }
  }
  if (!authKey) {
    authKey = randomBytes(24).toString("hex");
  }

  output.appendLine(`Starting bundled Arduino MCP server on port ${port}...`);
  const child: ChildProcess = spawn(nodePath, [serverPath], {
    cwd: context.extensionPath,
    env: {
      ...process.env,
      MCP_PORT: String(port),
      MCP_HOST: "127.0.0.1",
      MCP_AUTH_KEY: authKey,
    },
    shell: false,
  });
  child.stdout?.on("data", (d) => output.appendLine(`[server] ${String(d).trimEnd()}`));
  child.stderr?.on("data", (d) => output.appendLine(`[server:err] ${String(d).trimEnd()}`));
  child.on("exit", (code) => output.appendLine(`[server] exited with code ${code}`));

  // Give the server a moment to crash if it's going to (e.g. port collision
  // we didn't anticipate). 250 ms is enough — startup beyond that is healthy.
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
    },
  };
}
