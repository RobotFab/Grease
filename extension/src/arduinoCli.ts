/**
 * arduinoCli.ts
 * ─────────────
 * Thin async wrappers around the `arduino-cli` binary that Arduino Grease
 * shells out to. Everything in this module is pure plumbing: spawn the CLI,
 * collect stdout/stderr, parse the JSON it emits, and return shaped results.
 *
 * No VS Code APIs are imported here on purpose — keeping this module
 * UI-agnostic makes it easy to unit-test and reuse from the MCP server.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** A normalized result from any arduino-cli invocation. */
export interface CliResult {
  /** True when the child exited with code 0. */
  success: boolean;
  /** Exit code, or null when the process never started (ENOENT, etc.). */
  exitCode: number | null;
  /** Everything the child wrote to stdout. */
  stdout: string;
  /** Everything the child wrote to stderr (plus the spawn error, if any). */
  stderr: string;
}

/**
 * Spawn arduino-cli with the given args.
 *
 * Honours the optional ARDUINO_CLI_PATH env var so power users can point at a
 * non-default binary (e.g. a Homebrew install or a CI cache). On Windows we
 * have to set `shell: true` because Node otherwise refuses to resolve the
 * `arduino-cli.exe` shim that ships with the official installer.
 */
export async function runArduinoCli(args: string[], cwd?: string): Promise<CliResult> {
  const cmd = process.env.ARDUINO_CLI_PATH || "arduino-cli";
  return new Promise<CliResult>((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: os.platform() === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) =>
      resolve({
        success: false,
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${String(err)}`,
      }),
    );
    child.on("close", (code) =>
      resolve({ success: code === 0, exitCode: code, stdout, stderr }),
    );
  });
}

/** Refresh the local cache of available boards and libraries from the Arduino index. */
export async function updateIndexes(): Promise<CliResult> {
  return runArduinoCli(["core", "update-index"]);
}

/** Install a board core (e.g. "esp32:esp32" or "arduino:avr"). */
export async function installCore(pkg: string): Promise<CliResult> {
  return runArduinoCli(["core", "install", pkg]);
}

/**
 * An FQBN looks like `vendor:arch:board[:menu=value...]`. The "core package"
 * is the first two segments — that's what gets installed via `core install`.
 * Example: `esp32:esp32:XIAO_ESP32C6` → `esp32:esp32`.
 */
export function extractCoreFromFqbn(fqbn: string | null | undefined): string | null {
  if (!fqbn || typeof fqbn !== "string") return null;
  const parts = fqbn.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return null;
}

/** Return true if the given core package is already present in `core list`. */
export async function isCoreInstalled(corePkg: string): Promise<boolean> {
  const result = await runArduinoCli(["core", "list", "--json"]);
  if (!result.success) return false;
  try {
    const parsed = JSON.parse(result.stdout);
    const platforms = Array.isArray(parsed?.platforms) ? parsed.platforms : [];
    for (const p of platforms) {
      const id = String(p?.id ?? "");
      if (id === corePkg) return true;
    }
  } catch {
    /* arduino-cli sometimes prints non-JSON warnings before the JSON body; ignore */
  }
  return false;
}

/**
 * Tells arduino-cli to dry-run a compile and emit a `compile_commands.json`
 * file in the sketch root — the file clangd reads to know how to parse every
 * translation unit (which flags to pass, which include paths exist, etc.).
 *
 * Without this file, clangd will refuse `.ino` files or, worse, parse them
 * with default C flags and surface hundreds of false-positive errors.
 *
 * The companion `writeClangdConfig()` in src/clangdConfig.ts drops a `.clangd`
 * file next to this one so clangd treats `.ino` as C++ and force-includes
 * `Arduino.h` (which is what the Arduino preprocessor does anyway).
 *
 * Implementation note: arduino-cli writes compile_commands.json into its own
 * build directory, not the sketch folder. We force the build dir to
 * `<sketchPath>/.grease-build` via `--build-path` so the path is predictable,
 * then copy the generated file up into the sketch root where clangd searches
 * for it. Without this copy clangd never sees the database and every Arduino
 * symbol shows up as "undeclared identifier" in hovers.
 */
export async function generateCompileCommands(
  fqbn: string | null,
  sketchPath: string,
  outputChannel: { appendLine(s: string): void },
): Promise<void> {
  if (!fqbn || !sketchPath) return;
  const buildPath = path.join(sketchPath, ".grease-build");
  try {
    const result = await runArduinoCli(
      [
        "compile",
        "--fqbn",
        fqbn,
        "--only-compilation-database",
        "--build-path",
        buildPath,
        sketchPath,
      ],
      sketchPath,
    );
    if (!result.success) {
      outputChannel.appendLine(
        "[clangd] Failed to generate compile_commands.json: " + result.stderr,
      );
      return;
    }
    const src = path.join(buildPath, "compile_commands.json");
    const dst = path.join(sketchPath, "compile_commands.json");
    if (!fs.existsSync(src)) {
      outputChannel.appendLine(
        `[clangd] arduino-cli reported success but ${src} is missing — clangd will not have a compilation database.`,
      );
      return;
    }
    fs.copyFileSync(src, dst);
    outputChannel.appendLine("[clangd] compile_commands.json generated for IntelliSense.");
  } catch (e) {
    outputChannel.appendLine(
      "[clangd] Error generating compile_commands.json: " +
        (e instanceof Error ? e.message : String(e)),
    );
  }
}

/** A single board+port discovery row from `arduino-cli board list --format json`. */
export interface BoardCandidate {
  port: string;
  protocol?: string;
  fqbn?: string;
  name?: string;
  vid?: string | null;
  pid?: string | null;
  serialNumber?: string | null;
}

export interface BoardDetection {
  success: boolean;
  candidates: BoardCandidate[];
  raw: string;
  stderr: string;
}

/**
 * Ask arduino-cli to enumerate connected boards. The CLI returns a tree where
 * each detected port may have zero, one, or many "matching boards" (USB VID/PID
 * matches). We flatten that into one candidate per (port × board) pair so the
 * UI can show the user a single picker list.
 *
 * Ports with no recognized board still get an entry — that lets users connect
 * a generic board (e.g. a bare ATmega) and then pick the FQBN manually.
 */
export async function detectBoardCandidates(): Promise<BoardDetection> {
  const result = await runArduinoCli(["board", "list", "--format", "json"]);
  const raw = result.stdout;
  const stderr = result.stderr;
  if (!result.success) {
    return { success: false, candidates: [], raw, stderr };
  }
  // arduino-cli occasionally prefixes its JSON with a deprecation banner.
  // Grab the trailing {…} or […] block.
  const match = raw.match(/\{[\s\S]*\}\s*$/) || raw.match(/\[[\s\S]*\]\s*$/);
  const jsonStr = match ? match[0] : raw;
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      success: false,
      candidates: [],
      raw,
      stderr: `${stderr}\nFailed to parse JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const ports = Array.isArray(parsed?.detected_ports) ? parsed.detected_ports : [];
  const candidates: BoardCandidate[] = [];
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
        serialNumber,
      });
    }
  }
  return { success: true, candidates, raw, stderr };
}

/**
 * Some older Arduino libraries fail to install unless the unsafe-install flag
 * is set. Call this once at activation; failure is non-fatal.
 */
export async function enableUnsafeInstall(): Promise<void> {
  try {
    await runArduinoCli(["config", "set", "library.enable_unsafe_install", "true"]);
  } catch {
    /* not fatal — the user can install libraries one at a time if needed */
  }
}
