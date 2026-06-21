/**
 * serialManager.mjs
 * ─────────────────
 * Serial I/O via `arduino-cli monitor` — no native bindings required.
 *
 * arduino-cli is already a hard requirement for compile/upload, so spawning
 * it for serial monitoring adds zero new dependencies and works identically
 * on macOS, Linux, and Windows.
 */

import { spawn } from "node:child_process";

const CLI = process.env.ARDUINO_CLI_PATH || "arduino-cli";

export class SerialManager {
  constructor() {
    /** @type {import("node:child_process").ChildProcess|null} */
    this._proc  = null;
    /** @type {string[]} */
    this._buffer = [];
    this._maxBufferLines = 500;
    this.isOpen  = false;
    this._meta   = { path: null, baudRate: null };
    /** Accumulates bytes that haven't yet formed a complete line. */
    this._partial = "";
  }

  /**
   * Open a serial connection via `arduino-cli monitor`.
   * @param {{ path: string, baudRate?: number, delimiter?: string }} args
   *   `delimiter` is accepted for API compatibility but ignored — line
   *   splitting is handled by splitting on \r?\n from stdout.
   */
  async open({ path, baudRate = 9600 }) {
    await this.close();

    const proc = spawn(CLI, [
      "monitor",
      "-p", path,
      "--config", `baudrate=${baudRate}`,
      "--quiet",          // suppress the connection banner
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    this._partial = "";

    proc.stdout.on("data", (chunk) => {
      const text  = this._partial + String(chunk);
      const lines = text.split(/\r?\n/);
      // The last element is either "" (if chunk ended with \n) or a partial line.
      this._partial = lines.pop() ?? "";
      for (const line of lines) {
        this._buffer.push(line);
        if (this._buffer.length > this._maxBufferLines) {
          this._buffer.splice(0, this._buffer.length - this._maxBufferLines);
        }
      }
    });

    proc.on("exit", () => {
      if (this._proc === proc) {
        this._proc  = null;
        this.isOpen = false;
      }
    });

    // Give the process 500 ms to either stabilise or crash.
    // An early exit (bad port, permission denied, port in use) rejects here
    // so callers get a meaningful error instead of a silent open.
    await new Promise((resolve, reject) => {
      let settled = false;
      let stderrBuf = "";

      proc.stderr.on("data", (d) => { stderrBuf += String(d); });

      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(); }
      }, 500);

      proc.once("exit", (code) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error(
            stderrBuf.trim() || `arduino-cli monitor exited early (code ${code})`
          ));
        }
      });
    });

    this._proc  = proc;
    this.isOpen = true;
    this._meta  = { path, baudRate };
  }

  /**
   * Write data to the serial port (forwarded to arduino-cli monitor's stdin).
   * @param {{ data: string }} args
   */
  async write({ data }) {
    if (!this._proc || !this.isOpen) throw new Error("Serial port is not open");
    await new Promise((resolve, reject) => {
      this._proc.stdin.write(String(data), (err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * Return buffered lines. Clears the buffer by default.
   * @param {{ clear?: boolean }} [args]
   */
  read({ clear } = {}) {
    const lines = this._buffer.slice();
    if (clear !== false) this._buffer = [];
    return lines;
  }

  /** Close the serial connection and kill the arduino-cli monitor process. */
  async close() {
    if (!this._proc) return;
    const proc    = this._proc;
    this._proc    = null;
    this.isOpen   = false;
    this._meta    = { path: null, baudRate: null };
    this._partial = "";
    if (!proc.killed) {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 200));
      if (!proc.killed) proc.kill("SIGKILL");
    }
  }

  /** Current status snapshot (mirrors the old serialport API shape). */
  status() {
    return {
      isOpen:       this.isOpen,
      path:         this._meta.path,
      baudRate:     this._meta.baudRate,
      bufferedLines: this._buffer.length,
    };
  }
}
