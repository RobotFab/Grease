import { runProcess } from "./runProcess.mjs";

function getArduinoCliPath() {
  return process.env.ARDUINO_CLI_PATH || "arduino-cli";
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
    return { success: false, boardsJson: null, raw, stderr };
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
  return runProcess(cmd, ["compile", "--fqbn", fqbn, sketchPath]);
}

/**
 * @param {{ fqbn: string, port: string, sketchPath: string }} args
 */
export async function uploadSketch({ fqbn, port, sketchPath }) {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["upload", "-p", port, "--fqbn", fqbn, sketchPath]);
}

export async function enableUnsafeInstall() {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["config", "set", "library.enable_unsafe_install", "true"]);
}

export async function installLibrary(name) {
  const cmd = getArduinoCliPath();
  return runProcess(cmd, ["lib", "install", name]);
}

