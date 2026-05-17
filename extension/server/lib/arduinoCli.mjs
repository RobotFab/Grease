import path from "node:path";
import { runProcess } from "./runProcess.mjs";

function getArduinoCliPath() {
  return process.env.ARDUINO_CLI_PATH || "arduino-cli";
}

function normalizeSketchPath(sketchPath) {
  const resolved = path.resolve(String(sketchPath || ""));
  if (path.extname(resolved).toLowerCase() === ".ino") {
    return path.dirname(resolved);
  }
  return resolved;
}

/**
 * @returns {Promise<{ success: boolean, boardsJson: any, raw: string, stderr: string }>}
 */
export async function detectBoards() {
  const cmd = getArduinoCliPath();
  const result = await runProcess(cmd, ["board", "list", "--format", "json"]);

  const raw = `${result.stdout ?? ""}`;
  const stderr = `${result.stderr ?? ""}`;

  if (!result.success) {
    const hint = stderr.includes("arduino-cli not found") || stderr.includes("ENOENT")
      ? "" // hint already injected by runProcess
      : (result.exitCode === null && !raw ? "\n\nHint: make sure arduino-cli is installed and on your PATH." : "");
    return { success: false, boardsJson: null, raw, stderr: stderr + hint };
  }

  const match = raw.match(/\{[\s\S]*\}\s*$/) || raw.match(/\[[\s\S]*\]\s*$/);
  const jsonStr = match ? match[0] : raw;
  try {
    return { success: true, boardsJson: JSON.parse(jsonStr), raw, stderr };
  } catch (e) {
    return { success: false, boardsJson: null, raw, stderr: `${stderr}\nFailed to parse JSON: ${e?.message ?? String(e)}` };
  }
}

/**
 * @param {{ fqbn: string, sketchPath: string }} args
 */
export async function compileSketch({ fqbn, sketchPath }) {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["compile", "--fqbn", fqbn, normalizeSketchPath(sketchPath)]);
}

/**
 * @param {{ fqbn: string, port: string, sketchPath: string }} args
 */
export async function uploadSketch({ fqbn, port, sketchPath }) {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["upload", "-p", port, "--fqbn", fqbn, normalizeSketchPath(sketchPath)]);
}

export async function enableUnsafeInstall() {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["config", "set", "library.enable_unsafe_install", "true"]);
}

export async function installLibrary(name) {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["lib", "install", name]);
}

