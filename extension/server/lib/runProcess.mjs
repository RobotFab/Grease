import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string,string|undefined>, timeoutMs?: number }} [options]
 * @returns {Promise<{ success: boolean, exitCode: number|null, stdout: string, stderr: string }>}
 */
export function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        success: false,
        exitCode: null,
        stdout,
        stderr: `${stderr}\nProcess timed out after ${timeoutMs / 1000}s and was killed.`,
      });
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const hint = err.code === "ENOENT"
        ? `\n\nArduino CLI not found. Install it at https://arduino.github.io/arduino-cli/latest/installation/ then restart your IDE.\nOn macOS: brew install arduino-cli\nOn Windows: winget install ArduinoSA.ArduinoCLI\nOn Linux: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh`
        : "";
      resolve({ success: false, exitCode: null, stdout, stderr: `${stderr}\n${String(err)}${hint}` });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: code === 0, exitCode: code, stdout, stderr });
    });
  });
}

