/**
 * boards.ts
 * ─────────
 * Persists the user's chosen board target across sessions and helps re-pick it
 * automatically when the same physical board comes back on a different port.
 *
 * Two persisted maps live in VS Code's `globalState`:
 *   - `arduinoMcp.target`       → the *active* target ({port, fqbn, userChosen})
 *   - `arduinoMcp.boardMemory`  → identity → FQBN, keyed by USB serial number,
 *                                  VID:PID, and previously-seen FQBN. Lets us
 *                                  silently restore the FQBN when the same
 *                                  physical board reappears.
 */

import * as vscode from "vscode";
import { detectBoardCandidates, type BoardCandidate } from "./arduinoCli";

export interface Target {
  port: string | null;
  fqbn: string | null;
  /** True when the user *actively* chose this target (vs. auto-detected). */
  userChosen?: boolean;
}

export type BoardMemory = Record<string, { fqbn: string }>;

const TARGET_KEY = "arduinoMcp.target";
const BOARD_MEMORY_KEY = "arduinoMcp.boardMemory";

export async function loadTarget(context: vscode.ExtensionContext): Promise<Target | null> {
  return context.globalState.get<Target>(TARGET_KEY) ?? null;
}

export async function saveTarget(
  context: vscode.ExtensionContext,
  target: Target | null,
): Promise<void> {
  if (!target) {
    await context.globalState.update(TARGET_KEY, undefined);
    return;
  }
  await context.globalState.update(TARGET_KEY, target);
}

export async function loadBoardMemory(context: vscode.ExtensionContext): Promise<BoardMemory> {
  return context.globalState.get<BoardMemory>(BOARD_MEMORY_KEY) ?? {};
}

export async function saveBoardMemory(
  context: vscode.ExtensionContext,
  memory: BoardMemory,
): Promise<void> {
  await context.globalState.update(BOARD_MEMORY_KEY, memory);
}

/** Normalize VID/PID into a stable lowercase key (or null if either is missing). */
export function vidPidKey(vid?: string | null, pid?: string | null): string | null {
  if (!vid || !pid) return null;
  return `${String(vid).toLowerCase()}:${String(pid).toLowerCase()}`;
}

/**
 * Compute the lookup keys for a candidate. We try keys in order of specificity
 * (serial number → VID:PID → FQBN) so a swapped-out board with the same VID/PID
 * still picks the right FQBN, but a chip-level identity (serial number) wins
 * if available.
 */
export function boardMemoryKeys(candidate: BoardCandidate | null | undefined): string[] {
  const keys: string[] = [];
  if (candidate?.serialNumber) keys.push(`serial:${candidate.serialNumber}`);
  const vpKey = vidPidKey(candidate?.vid, candidate?.pid);
  if (vpKey) keys.push(vpKey);
  if (candidate?.fqbn) keys.push(`fqbn:${candidate.fqbn}`);
  return keys;
}

/** Re-run `arduino-cli board list` and shape the result for the UI. */
export async function refreshBoards(output: vscode.OutputChannel): Promise<{
  success: boolean;
  candidates: BoardCandidate[];
  stderr?: string;
}> {
  const result = await detectBoardCandidates();
  if (!result.success) {
    output.appendLine(`Board detect failed: ${result.stderr}`);
    return { success: false, candidates: [], stderr: result.stderr };
  }
  return { success: true, candidates: result.candidates };
}

function pickLabel(c: BoardCandidate): string {
  const parts = [c.name || "Unknown board", c.fqbn ? `(${c.fqbn})` : "(no fqbn)", c.port];
  return parts.join("  ");
}

/**
 * Show the QuickPick board selector and persist the user's choice.
 *
 * When the user already has a board set we also offer a "Change port only"
 * shortcut — useful when reconnecting the same board to a different USB hub
 * gives it a new device path.
 */
export async function promptForTarget(
  context: vscode.ExtensionContext,
  candidates: BoardCandidate[],
  currentTarget: Target | null,
): Promise<Target | null> {
  if (candidates.length === 0) return null;
  const items: (vscode.QuickPickItem & { target?: Target })[] = candidates.map((c) => {
    const fqbn = typeof c.fqbn === "string" ? c.fqbn : null;
    return {
      label: pickLabel(c),
      description: fqbn ? undefined : "Port detected (board unknown - install/select core)",
      target: { port: c.port, fqbn },
    };
  });
  if (currentTarget?.fqbn) {
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: "Change port only (keep current board)" });
    for (const c of candidates) {
      items.push({
        label: `$(plug) ${c.port}`,
        description: `Keep board: ${currentTarget.fqbn}`,
        target: { port: c.port, fqbn: currentTarget.fqbn },
      });
    }
  }
  const picked = await vscode.window.showQuickPick(items, {
    title: "Select Arduino board/port",
    placeHolder: "Pick the correct port (and board if known)",
    ignoreFocusOut: false,
  });
  if (!picked?.target) return null;
  await saveTarget(context, picked.target);
  return picked.target;
}
