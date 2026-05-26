/**
 * ui/serialMonitorPanel.ts
 * ────────────────────────
 * Serial-monitor implementation that *reuses* the VS Code Output channel
 * (rather than a webview). Lines coming from the board are printed as
 * `[serial] <line>` so they're easy to spot among the other extension logs.
 *
 * The panel speaks to the MCP server's REST endpoints (`/serial/open`,
 * `/serial/read`, `/serial/write`, `/serial/close`) — it does not open the
 * port itself. That separation keeps the native `serialport` dependency
 * contained to the spawned server process.
 *
 * Users can type "console commands" while the monitor is connected:
 *   baud=115200            → reconnect at a new baud
 *   send="Hello World"     → write data to the board (quoted strings keep spaces)
 *   send=PWM:128           → unquoted form for simple payloads
 *   clear                  → flush the read buffer
 *   disconnect / connect   → toggle the link without changing the port
 */

import * as vscode from "vscode";
import * as os from "node:os";
import { serialClose, serialOpen, serialRead, serialWrite } from "../serverHttpClient";

export class SerialMonitorPanel {
  private pollTimer: NodeJS.Timeout | null = null;
  private connectedPort: string | null = null;
  private baudRate = 9600;
  isConnected = false;

  constructor(private output: vscode.OutputChannel) {}

  /** Open the port and start reading lines into the output channel. */
  async start(defaultPort: string | null | undefined, baud = 9600): Promise<void> {
    this.baudRate = baud;
    if (!defaultPort) {
      this.output.appendLine("Serial: no port selected.");
      return;
    }
    await this.connect(defaultPort, this.baudRate);
    this.startPolling();
  }

  /** Close the port and stop polling. Safe to call repeatedly. */
  async stop(): Promise<void> {
    if (!this.isConnected) return;
    await serialClose();
    this.isConnected = false;
    this.output.appendLine("Serial disconnected");
  }

  /**
   * Handle a single user-typed command from the input box.
   * Each recognised verb is its own regex branch — keep it explicit so the
   * parser is easy to extend later.
   */
  async handleConsoleCommand(raw: string): Promise<void> {
    const text = String(raw ?? "").trim();
    if (!text) return;

    // baud=<number> → reconnect with a new baud
    if (/^baud\s*=\s*\d+$/i.test(text)) {
      const next = Number(text.split("=")[1]);
      if (!Number.isFinite(next) || next <= 0) {
        this.output.appendLine("Serial: invalid baud value.");
        return;
      }
      this.baudRate = next;
      this.output.appendLine(`Serial baud set to ${next}`);
      if (this.connectedPort) {
        await this.connect(this.connectedPort, this.baudRate);
      }
      return;
    }

    // clear → drain whatever the read-side buffered without printing it
    if (/^clear$/i.test(text)) {
      const r = await serialRead();
      const dropped = r.lines?.length ?? 0;
      this.output.appendLine(`Serial buffer cleared (${dropped} lines dropped).`);
      return;
    }

    // disconnect / connect → cycle the link
    if (/^disconnect$/i.test(text)) {
      await this.stop();
      return;
    }
    if (/^connect$/i.test(text)) {
      if (!this.connectedPort) {
        this.output.appendLine("Serial: no known port to connect.");
        return;
      }
      await this.connect(this.connectedPort, this.baudRate);
      return;
    }

    // send="..." (quoted, preserves spaces) or send=... (everything after =)
    const sendQuoted = text.match(/^send\s*=\s*"([\s\S]*)"$/i);
    const sendPlain = text.match(/^send\s*=\s*(.+)$/i);
    if (sendQuoted || sendPlain) {
      const payload = sendQuoted ? sendQuoted[1] : sendPlain?.[1] ?? "";
      if (!this.isConnected) {
        this.output.appendLine("Serial: not connected.");
        return;
      }
      await serialWrite({ data: payload });
      this.output.appendLine(`[serial:tx] ${payload}`);
      return;
    }

    this.output.appendLine(`Serial: unknown command "${text}".`);
  }

  /**
   * Open the port via the MCP server. On Linux, permission errors typically
   * mean the user isn't in the `dialout` group — we surface a fix-it action
   * that copies the right command to the clipboard.
   */
  private async connect(port: string, baudRate: number): Promise<void> {
    try {
      await serialOpen({ path: port, baudRate });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isPermDenied =
        msg.includes("Permission denied") || msg.includes("EACCES") || msg.includes("EPERM");
      if (isPermDenied && os.platform() === "linux") {
        vscode.window
          .showErrorMessage(
            `Serial: Permission denied on ${port}. On Linux, run: sudo usermod -a -G dialout $USER — then log out and back in.`,
            "Copy Command",
          )
          .then((action) => {
            if (action === "Copy Command") {
              vscode.env.clipboard.writeText(`sudo usermod -a -G dialout $USER`);
            }
          });
      } else {
        vscode.window.showErrorMessage(`Serial: Failed to open ${port}: ${msg}`);
      }
      this.output.appendLine(`Serial open failed: ${msg}`);
      return;
    }
    this.connectedPort = port;
    this.baudRate = baudRate;
    this.isConnected = true;
    this.output.appendLine(`Serial connected: ${port} @ ${baudRate}`);
  }

  /** Poll the server every 250 ms for buffered lines. */
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.isConnected) return;
      void (async () => {
        try {
          const r = await serialRead();
          for (const line of r.lines ?? []) {
            this.output.appendLine(`[serial] ${line}`);
          }
        } catch {
          /* server may have restarted — keep polling */
        }
      })();
    }, 250);
  }
}
