import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

/**
 * Single-port serial manager (MVP).
 */
export class SerialManager {
  constructor() {
    /** @type {import("serialport").SerialPort|null} */
    this.port = null;
    /** @type {import("@serialport/parser-readline").ReadlineParser|null} */
    this.parser = null;
    /** @type {string[]} */
    this.buffer = [];
    this.maxBufferLines = 500;
    this.isOpen = false;
    this.meta = { path: null, baudRate: null, delimiter: "\n" };
  }

  /**
   * @param {{ path: string, baudRate: number, delimiter?: string }} args
   */
  async open({ path, baudRate, delimiter }) {
    await this.close();

    const port = new SerialPort({ path, baudRate, autoOpen: false });
    const delim = delimiter ?? "\n";
    const parser = port.pipe(new ReadlineParser({ delimiter: delim }));

    parser.on("data", (line) => {
      this.buffer.push(String(line));
      if (this.buffer.length > this.maxBufferLines) {
        this.buffer.splice(0, this.buffer.length - this.maxBufferLines);
      }
    });

    await new Promise((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });

    this.port = port;
    this.parser = parser;
    this.isOpen = true;
    this.meta = { path, baudRate, delimiter: delim };
  }

  /**
   * @param {{ data: string }} args
   */
  async write({ data }) {
    if (!this.port || !this.isOpen) throw new Error("Serial port is not open");
    await new Promise((resolve, reject) => {
      this.port.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * @param {{ clear?: boolean }} args
   */
  read({ clear } = {}) {
    const lines = this.buffer.slice();
    if (clear !== false) this.buffer = [];
    return lines;
  }

  async close() {
    if (!this.port) return;
    const port = this.port;
    this.port = null;
    this.parser = null;
    this.isOpen = false;
    this.meta = { path: null, baudRate: null, delimiter: "\n" };
    await new Promise((resolve) => {
      port.close(() => resolve());
    });
  }

  status() {
    return {
      isOpen: this.isOpen,
      ...this.meta,
      bufferedLines: this.buffer.length,
    };
  }
}

