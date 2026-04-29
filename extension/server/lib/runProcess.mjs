import { spawn } from "node:child_process";

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string,string|undefined> }} [options]
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

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      resolve({ success: false, exitCode: null, stdout, stderr: `${stderr}\n${String(err)}` });
    });
    child.on("close", (code) => {
      resolve({ success: code === 0, exitCode: code, stdout, stderr });
    });
  });
}

