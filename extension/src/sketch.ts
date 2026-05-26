/**
 * sketch.ts
 * ─────────
 * Helpers that figure out *which folder* is the user's current Arduino sketch.
 *
 * Arduino sketches are folders, not files. A valid sketch folder contains at
 * least one `.ino` file whose basename matches the folder name (e.g.
 * `Blink/Blink.ino`). The rest of the extension uses these helpers whenever
 * it needs a sketch path to compile, upload, or generate IntelliSense for.
 */

import * as vscode from "vscode";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Like `fs.readdirSync` but returns `[]` instead of throwing on permission errors. */
function safeReadDir(folder: string): string[] {
  try {
    return fs.readdirSync(folder);
  } catch {
    return [];
  }
}

/**
 * Return the path of the sketch's "main" `.ino` file, or `null` if the folder
 * isn't a sketch. The preferred match is `<folder>/<folder-basename>.ino`; if
 * that's absent we accept a folder that contains exactly one `.ino`.
 */
export function findMainSketchFile(sketchFolder: string): string | null {
  const base = path.basename(sketchFolder);
  const preferred = path.join(sketchFolder, `${base}.ino`);
  if (fs.existsSync(preferred)) return preferred;
  const inoFiles = safeReadDir(sketchFolder).filter((f) => f.toLowerCase().endsWith(".ino"));
  if (inoFiles.length === 1) {
    return path.join(sketchFolder, inoFiles[0]);
  }
  return null;
}

/** True if the folder qualifies as an Arduino sketch (has a main .ino). */
export function isSketchFolder(folder: string): boolean {
  return findMainSketchFile(folder) !== null;
}

/**
 * Strict Arduino-CLI-compatible sketch validation.
 *
 * Arduino requires `<folder>/<folder-basename>.ino`. A loose `.ino` whose name
 * doesn't match its parent folder will fail `arduino-cli compile` with
 * "main file missing from sketch: <folder>/<folder>.ino".
 *
 * Returns:
 *   { kind: "ok",          folder, mainIno }      → safe to compile
 *   { kind: "missing-ino", folder }                → folder has zero .ino files
 *   { kind: "name-mismatch", folder, looseIno, expectedPath } → .ino exists but
 *                                                  the folder/file name pairing
 *                                                  is wrong (the common user mistake)
 *   { kind: "ambiguous",   folder, candidates }    → multiple .ino files, none matching folder
 */
export type SketchValidation =
  | { kind: "ok"; folder: string; mainIno: string }
  | { kind: "missing-ino"; folder: string }
  | { kind: "name-mismatch"; folder: string; looseIno: string; expectedPath: string }
  | { kind: "ambiguous"; folder: string; candidates: string[] };

export function validateSketchFolder(folder: string): SketchValidation {
  if (!folder) return { kind: "missing-ino", folder };
  const base = path.basename(folder);
  const preferred = path.join(folder, `${base}.ino`);
  if (fs.existsSync(preferred)) {
    return { kind: "ok", folder, mainIno: preferred };
  }
  const inoFiles = safeReadDir(folder).filter((f) => f.toLowerCase().endsWith(".ino"));
  if (inoFiles.length === 0) {
    return { kind: "missing-ino", folder };
  }
  if (inoFiles.length === 1) {
    // The only .ino has the wrong name — this is the bug we want to catch
    // (e.g. `examples/AnalogTester.ino` where the folder is named `examples`).
    const looseIno = path.join(folder, inoFiles[0]);
    const inoBase = path.basename(inoFiles[0], ".ino");
    const expectedPath = path.join(folder, inoBase, inoFiles[0]);
    return { kind: "name-mismatch", folder, looseIno, expectedPath };
  }
  return {
    kind: "ambiguous",
    folder,
    candidates: inoFiles.map((f) => path.join(folder, f)),
  };
}

/**
 * The active .ino the user is editing — preferred over folder-based detection
 * because the user's mental model is "compile the file in front of me".
 *
 * Checks the active editor first, then any *visible* editor (covers the case
 * where focus is on the Output panel or sidebar when a command fires).
 */
export function getActiveInoPath(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.fsPath.toLowerCase().endsWith(".ino")) {
    return editor.document.uri.fsPath;
  }
  for (const ve of vscode.window.visibleTextEditors) {
    if (ve.document.uri.fsPath.toLowerCase().endsWith(".ino")) {
      return ve.document.uri.fsPath;
    }
  }
  return null;
}

/** Result of staging a sketch for arduino-cli (Verify / Upload). */
export interface PreparedSketch {
  /** Folder to hand to arduino-cli (always contains `<basename>/<basename>.ino`). */
  sketchDir: string;
  /** Path to the main .ino inside `sketchDir`. */
  mainIno: string;
  /** True when sketchDir is a temp copy (caller may rewrite diagnostic paths). */
  isTemp: boolean;
  /** Original .ino path the user is editing; only set when `isTemp` is true. */
  originalIno?: string;
  /** Folder the original .ino lives in; only set when `isTemp` is true. */
  originalDir?: string;
}

/**
 * Stage an arbitrary `.ino` into a layout arduino-cli will accept.
 *
 * arduino-cli requires `<folder>/<folder-basename>.ino`. When the user opens a
 * loose .ino (e.g. `~/Documents/Arduino/BlinkLEDstest.ino` — folder named
 * `Arduino`, file named `BlinkLEDstest.ino`), arduino-cli rejects the compile
 * with "main file missing: Arduino.ino". Rather than blocking the user or
 * forcing them to rearrange their files, we transparently mirror the .ino
 * plus its sibling sources into a properly-named temp folder and compile from
 * there.
 *
 * Behavior:
 *   - If the original folder already satisfies arduino-cli (folder name ==
 *     .ino basename), returns it unchanged with `isTemp: false`.
 *   - Otherwise, builds `<os.tmpdir()>/arduino-grease-sketches/<base>-<hash>/<base>/<base>.ino`
 *     and copies the active .ino plus any sibling .h/.hpp/.cpp/.c files (local
 *     headers/sources the sketch likely depends on). Other .ino files are NOT
 *     copied — those would be unrelated sketches that arduino-cli would try to
 *     concatenate as extra tabs.
 *
 * The hash is derived from the original .ino path so re-builds reuse the same
 * temp dir and arduino-cli's build cache stays warm.
 */
export function prepareSketchForBuild(activeInoPath: string): PreparedSketch | null {
  if (!activeInoPath || !activeInoPath.toLowerCase().endsWith(".ino")) return null;
  if (!fs.existsSync(activeInoPath)) return null;

  const inoBase = path.basename(activeInoPath, path.extname(activeInoPath));
  const originalDir = path.dirname(activeInoPath);
  const folderName = path.basename(originalDir);

  if (folderName === inoBase) {
    return { sketchDir: originalDir, mainIno: activeInoPath, isTemp: false };
  }

  const hash = crypto.createHash("sha1").update(activeInoPath).digest("hex").slice(0, 10);
  const tempRoot = path.join(os.tmpdir(), "arduino-grease-sketches", `${inoBase}-${hash}`);
  const sketchDir = path.join(tempRoot, inoBase);
  const tempIno = path.join(sketchDir, `${inoBase}.ino`);

  try {
    fs.mkdirSync(sketchDir, { recursive: true });
    fs.copyFileSync(activeInoPath, tempIno);
    for (const sib of safeReadDir(originalDir)) {
      const lower = sib.toLowerCase();
      const isSource =
        lower.endsWith(".h") ||
        lower.endsWith(".hpp") ||
        lower.endsWith(".cpp") ||
        lower.endsWith(".c") ||
        lower.endsWith(".cc") ||
        lower.endsWith(".cxx");
      if (!isSource) continue;
      try {
        fs.copyFileSync(path.join(originalDir, sib), path.join(sketchDir, sib));
      } catch {
        /* skip unreadable siblings — they're optional */
      }
    }
  } catch {
    return null;
  }

  return {
    sketchDir,
    mainIno: tempIno,
    isTemp: true,
    originalIno: activeInoPath,
    originalDir,
  };
}

/**
 * Find the sketch folder the user is currently working with.
 *
 * Resolution order (each step prefers a *valid* sketch folder where possible):
 *   1. Active text editor is a `.ino` → use its parent folder.
 *   2. Any *visible* text editor (any editor group) is a `.ino` → use that one.
 *      Handles the common case where the user is editing the .ino but focus is
 *      on the Output channel or the sidebar when they run a command.
 *   3. Workspace root is itself a valid Arduino sketch folder → use it.
 *   4. A subfolder of the workspace root is a valid sketch folder → use the first.
 *   5. Fall back to the workspace root (commands will validate and warn).
 */
export function getSketchFolder(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const fsPath = editor.document.uri.fsPath;
    if (fsPath.toLowerCase().endsWith(".ino")) {
      return path.dirname(fsPath);
    }
  }
  // Try any visible editor for an .ino file — this rescues us when focus
  // is on the Output panel or sidebar at the moment a command is invoked.
  for (const ve of vscode.window.visibleTextEditors) {
    const fsPath = ve.document.uri.fsPath;
    if (fsPath.toLowerCase().endsWith(".ino")) {
      return path.dirname(fsPath);
    }
  }
  const wf = vscode.workspace.workspaceFolders?.[0];
  const root = wf?.uri.fsPath;
  if (!root) return null;
  if (isSketchFolder(root)) {
    return root;
  }
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = path.join(root, entry.name);
      if (isSketchFolder(child)) return child;
    }
  } catch {
    /* ignore unreadable workspaces */
  }
  return root;
}
