/**
 * serverHttpClient.ts
 * ───────────────────
 * Tiny REST client for the bundled MCP server (the Node process spawned in
 * src/serverProcess.ts, code in extension/server/server.mjs).
 *
 * Everything in the extension that needs to *talk to* the running server goes
 * through this module — board target sync, serial port open/read/write/close,
 * and health checks. The MCP `/mcp` JSON-RPC endpoint is handled separately
 * by AI clients; we only use the REST surface here.
 */

/** Base URL of the running server. Updated whenever the server actually binds a port. */
let baseUrl = "http://127.0.0.1:3333";

/**
 * Shared-secret auth key sent as the `x-grease-auth` header.
 * Set by setAuthKey() once the server starts and reports its key.
 */
let _authKey = "";

export function setAuthKey(key: string): void {
  _authKey = key;
}

export function setServerBaseUrl(url: string): void {
  const clean = String(url || "").trim();
  if (!clean) return;
  baseUrl = clean.replace(/\/$/, "");
}

/** POST JSON to a server path and return the parsed JSON response. */
async function postJson<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-grease-auth": _authKey },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return (await res.json()) as T;
}

/** GET /health — returns `{ ok, name, port }`. Open endpoint, but we still send auth. */
export async function getHealth(): Promise<any> {
  const res = await fetch(`${baseUrl}/health`, { headers: { "x-grease-auth": _authKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status} /health`);
  return await res.json();
}

/**
 * Push the user's chosen (port, fqbn) to the MCP server so AI tool calls like
 * `compileSketch` and `uploadSketch` know what hardware to talk to.
 * Swallows errors silently — the server may still be coming up.
 */
export async function syncTargetToServer(
  target: { port: string | null; fqbn: string | null } | null,
): Promise<void> {
  try {
    await postJson("/target", { port: target?.port ?? null, fqbn: target?.fqbn ?? null });
  } catch {
    /* server may not be ready */
  }
}

export async function serialOpen(args: { path: string; baudRate: number; delimiter?: string }) {
  return postJson("/serial/open", args);
}

export async function serialClose() {
  return postJson("/serial/close", {});
}

export async function serialWrite(args: { data: string }) {
  return postJson("/serial/write", args);
}

export async function serialRead(): Promise<{
  ok: boolean;
  lines: string[];
  serial: { isOpen: boolean; path?: string; baudRate?: number };
}> {
  return postJson("/serial/read", {});
}
