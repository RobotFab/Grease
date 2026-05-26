/**
 * extension.ts
 * ────────────
 * Entry point for the Arduino Grease VS Code extension.
 *
 * This file does three big things:
 *
 *   1. **Boot the bundled MCP server.** A Node child process running
 *      `dist/server.mjs` is started on a free local port. The server exposes
 *      a REST API (used by the UI) and an MCP JSON-RPC endpoint (used by AI
 *      assistants like Claude, Cursor, Windsurf, Antigravity).
 *
 *   2. **Reconcile the hardware target.** Polls `arduino-cli board list`,
 *      remembers boards by USB serial / VID:PID / FQBN so the same physical
 *      board reappears with the right driver, and offers a board-core install
 *      prompt when a new device is plugged in.
 *
 *   3. **Register every `arduinoMcp.*` command.** Each command below is a
 *      named action surfaced in the Command Palette and on the sidebar
 *      toolbar. The block comment above each registerCommand call explains
 *      WHAT the command does — read those if you want to learn how the
 *      extension is wired.
 *
 * New in v1.0.9 (final):
 *   - The clangd LSP extension is auto-installed (declared in
 *     `extensionDependencies` in package.json) so `.ino` files get rich
 *     hover/completion/go-to-definition out of the box.
 *   - A `.clangd` config file is dropped in each sketch root so clangd
 *     understands `.ino` as C++ with `Arduino.h` pre-included.
 *   - `compile_commands.json` is now regenerated on board change, on library
 *     install, and on first open of a stale sketch — not just on Verify.
 *   - A new `arduinoMcp.regenerateIntelliSense` command lets users force a
 *     refresh at any time.
 */

import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";

import {
  enableUnsafeInstall,
  extractCoreFromFqbn,
  generateCompileCommands,
  installCore,
  isCoreInstalled,
  runArduinoCli,
  updateIndexes,
  type BoardCandidate,
} from "./arduinoCli";
import {
  boardMemoryKeys,
  loadBoardMemory,
  promptForTarget,
  refreshBoards,
  saveBoardMemory,
  saveTarget,
  vidPidKey,
  type Target,
} from "./boards";
import { parseArduinoDocs, registerArduinoHoverProvider, injectClangdHoverFilter } from "./arduinoHover";
import { refreshIfFirstOpen, refreshIntelliSense, writeClangdForInoFile } from "./clangdConfig";
import { patchInstalledCores } from "./docsPatcher";
import {
  findMainSketchFile,
  getActiveInoPath,
  getSketchFolder,
  prepareSketchForBuild,
  type PreparedSketch,
} from "./sketch";
import { setAuthKey, setServerBaseUrl, syncTargetToServer } from "./serverHttpClient";
import { startBundledServer, type ServerHandle } from "./serverProcess";
import { BoardTemplatePanel } from "./ui/boardTemplatePanel";
import { ExamplesPanel } from "./ui/examplesPanel";
import { SerialMonitorPanel } from "./ui/serialMonitorPanel";
import { SerialPlotterPanel } from "./ui/serialPlotterPanel";
import { ArduinoToolbarViewProvider } from "./views/toolbarView";

const OUTPUT_CHANNEL_NAME = "Arduino Grease";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Re-associate `.ino` documents from the contributed `arduino` language ID
 * to `cpp` so clangd actually attaches.
 *
 * Background: vscode-clangd's document selector is hardcoded to
 * { c, cpp, cuda-cpp, objective-c, objective-cpp } — it ignores documents
 * with language id `arduino`. Because this extension contributes `.ino`
 * under the `arduino` language for syntax/theming purposes, clangd would
 * otherwise never see the file. Switching the language id at open time
 * lets clangd attach (paired with the `.clangd` file we drop in the sketch
 * root, which tells clangd to parse the file as C++ with Arduino.h
 * force-included).
 */
async function ensureCppLanguageForIno(doc: vscode.TextDocument): Promise<void> {
  if (doc.languageId !== "arduino") return;
  if (!doc.fileName.toLowerCase().endsWith(".ino")) return;
  try {
    await vscode.languages.setTextDocumentLanguage(doc, "cpp");
  } catch {
    /* doc may have been closed before we got here; safe to ignore */
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(output);
  output.appendLine("Arduino Grease activating...");

  // Absolute path to the bundled hover-doc sidecar header. Resolved once
  // here and threaded through every clangd refresh so the same path lands
  // in every `.clangd` we write — see docsPatcher.buildClangdYaml.
  const sidecarPath = context.asAbsolutePath(path.join("resources", "arduino_docs.h"));

  // Parse arduino_docs.h once — shared by the hover provider and the clangd filter.
  const docsMap = parseArduinoDocs(sidecarPath);

  // Register the Grease hover provider (shows brief + signature + @params for documented symbols).
  context.subscriptions.push(registerArduinoHoverProvider(docsMap, output));

  // Patch clangd's hover middleware: suppress its output for symbols Grease covers,
  // and strip "provided by ..." lines from everything else.
  void injectClangdHoverFilter(docsMap, output);

  // Re-associate any open `.ino` documents to `cpp` so clangd attaches,
  // and keep doing it for future opens. See ensureCppLanguageForIno for why.
  // ALSO drop a `.clangd` alongside every `.ino` the user touches — covers
  // the case where the user opens a loose .ino saved to an arbitrary folder
  // (e.g. ~/Documents/Arduino/BlinkLEDstest.ino) AFTER the extension is
  // already active. Without this hook, refreshIfFirstOpen runs once at
  // activation and any sketch opened later never gets a `.clangd` written.
  for (const doc of vscode.workspace.textDocuments) {
    void ensureCppLanguageForIno(doc);
    writeClangdForInoFile(doc.uri.fsPath, sidecarPath, output);
  }
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      void ensureCppLanguageForIno(doc);
      writeClangdForInoFile(doc.uri.fsPath, sidecarPath, output);
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed) writeClangdForInoFile(ed.document.uri.fsPath, sidecarPath, output);
    }),
  );

  // ── First-install setup: apply the Grease theme + move Activity Bar to top.
  //    The key is versioned so future major updates can re-apply themes if needed.
  vscode.workspace
    .getConfiguration()
    .update("output.smartScroll.enabled", false, vscode.ConfigurationTarget.Global)
    .then(undefined, () => {});
  const FIRST_INSTALL_KEY = "arduinoMcp.firstInstallDone_1_0_6";
  const firstInstallDone = context.globalState.get(FIRST_INSTALL_KEY);
  if (!firstInstallDone) {
    try {
      const wbConfig = vscode.workspace.getConfiguration("workbench");
      await wbConfig.update("colorTheme", "Grease", vscode.ConfigurationTarget.Global);
      await wbConfig.update("activityBar.location", "top", vscode.ConfigurationTarget.Global);
      output.appendLine("First install: Applied Grease theme and moved Activity Bar to top.");
    } catch (e) {
      output.appendLine(
        "First install theme setup failed: " + (e instanceof Error ? e.message : String(e)),
      );
    }
    await context.globalState.update(FIRST_INSTALL_KEY, true);
  }

  // ── Diagnostics collection for Verify errors.
  //    Populated by parsing arduino-cli stderr; clangd has its own collection
  //    (provided by the clangd extension) for in-editor squiggles.
  const arduinoDiagnostics = vscode.languages.createDiagnosticCollection("arduino");
  context.subscriptions.push(arduinoDiagnostics);

  // ── Bundled MCP server lifecycle ────────────────────────────────────────
  let serverProcess: ServerHandle | null = null;
  let serverHealthy = false;
  let sawServerProblem = false;
  let lastScanAtMs: number | null = null;
  let portsRefreshArmed = false;

  const startServer = async (): Promise<boolean> => {
    if (serverProcess) return true;
    try {
      serverProcess = await startBundledServer(context, output, 3333);
      setServerBaseUrl(`http://127.0.0.1:${serverProcess.port}`);
      setAuthKey(serverProcess.authKey);
      output.appendLine(`Arduino Grease server started on port ${serverProcess.port}.`);
      return true;
    } catch (e) {
      output.appendLine(
        `Failed to start bundled server: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  };

  const stopServer = async (): Promise<void> => {
    if (!serverProcess) return;
    await serverProcess.stop();
    serverProcess = null;
    serverHealthy = false;
    sawServerProblem = false;
    output.appendLine("Arduino Grease server stopped.");
  };

  await startServer();

  // ── arduino-cli presence check ──────────────────────────────────────────
  //    If the CLI is missing, show a one-time warning with the right install
  //    command for the current OS. Otherwise turn on unsafe library install
  //    so older GitHub libraries don't fail with a "this isn't a valid lib" error.
  {
    const check = await runArduinoCli(["version"]);
    if (!check.success && (check.stderr?.includes("ENOENT") || check.exitCode === null)) {
      const installGuide =
        os.platform() === "win32"
          ? "Run: winget install ArduinoSA.ArduinoCLI"
          : os.platform() === "darwin"
            ? "Run: brew install arduino-cli"
            : "Run: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh";
      const action = await vscode.window.showWarningMessage(
        `Arduino Grease: arduino-cli not found on PATH. ${installGuide} — then restart your IDE.`,
        "Open Install Guide",
      );
      if (action === "Open Install Guide") {
        vscode.env.openExternal(
          vscode.Uri.parse("https://arduino.github.io/arduino-cli/latest/installation/"),
        );
      }
    } else {
      await enableUnsafeInstall();
    }
  }

  context.subscriptions.push({
    dispose: () => {
      void stopServer();
    },
  });

  // ── Status bar: shows the current target (board @ port) and is clickable
  //    to re-pick. Warning state when no target is set.
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.name = "Arduino Grease Target";
  status.command = "arduinoMcp.refreshPortsBoards";
  status.show();
  context.subscriptions.push(status);

  // ── UI panel instances ──────────────────────────────────────────────────
  const serialMonitorPanel = new SerialMonitorPanel(output);
  const serialPlotterPanel = new SerialPlotterPanel(output);
  const examplesPanel = new ExamplesPanel(context, output);
  const boardTemplatePanel = new BoardTemplatePanel(context);

  // Forward declarations for closures the toolbar needs to call.
  let lastCandidates: BoardCandidate[] = [];
  let currentTarget: Target | null = null;

  /**
   * Helper used by the toolbar's library-install handler (new in v1.0.9).
   * After a library is installed, the new headers exist on disk — we
   * regenerate compile_commands.json so clangd picks them up immediately.
   */
  const refreshIntelliSenseAfterLibChange = async (): Promise<void> => {
    const sketchFolder = getSketchFolder();
    if (!sketchFolder) return;
    await refreshIntelliSense({
      sketchFolder,
      fqbn: currentTarget?.fqbn ?? null,
      sidecarPath,
      output,
    });
  };

  // ── Sidebar toolbar (the dark "command center" the user lives in) ───────
  const toolbar = new ArduinoToolbarViewProvider(context, output, {
    /**
     * User picked a board in the Managers tab. Find a matching port (prefer
     * one whose detected board family matches the chosen FQBN), save it,
     * push it to the server, and remember the (USB id → FQBN) mapping so the
     * same board reappears with the right driver next time.
     *
     * NEW in v1.0.9: a board change is a clangd-affecting event — switching
     * from XIAO ESP32C6 to Romi32U4 means completely different include paths
     * and compiler flags. Refresh IntelliSense after the change is committed.
     */
    chooseTarget: async (fqbn: string) => {
      const corePrefix = fqbn.split(":").slice(0, 2).join(":");
      const candidate =
        lastCandidates.find(
          (c) => c.fqbn?.startsWith(corePrefix + ":") && typeof c.port === "string",
        ) ??
        lastCandidates.find((c) => c.port === currentTarget?.port) ??
        lastCandidates.find((c) => typeof c.port === "string") ??
        null;
      const port = candidate?.port ?? currentTarget?.port ?? null;
      if (!port) {
        vscode.window.showWarningMessage(
          "Arduino Grease: No port detected. Connect a board first.",
        );
        return;
      }
      const memCandidate = candidate ?? lastCandidates.find((c) => c.port === port);
      const keysToSave = boardMemoryKeys(memCandidate);
      if (keysToSave.length > 0) {
        const mem = await loadBoardMemory(context);
        for (const k of keysToSave) mem[k] = { fqbn };
        await saveBoardMemory(context, mem);
        output.appendLine(`[BoardMemory] Saved (${keysToSave.join(", ")}) → ${fqbn}`);
      } else {
        output.appendLine(
          `[BoardMemory] Warning: no identifiers found for ${port} — memory not saved`,
        );
      }
      currentTarget = { port, fqbn, userChosen: true };
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
      // v1.0.9: regenerate IntelliSense for the new board
      void refreshIntelliSenseAfterLibChange();
    },
    /**
     * User chose "Upload firmware to target" — this is the bootloader-burn
     * flow, used when initially programming a bare chip. Sets the target
     * and then runs `arduino-cli burn-bootloader`.
     */
    uploadFirmwareToTarget: async (fqbn: string) => {
      const port = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      if (!port) {
        vscode.window.showWarningMessage(
          "Arduino Grease: No port detected. Connect a board first.",
        );
        return;
      }
      currentTarget = { port, fqbn, userChosen: true };
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
      await runFirmwareUpload(fqbn, port);
    },
    /** Close the serial port when the user navigates away from the Board tab. */
    serialOff: async () => {
      if (serialMonitorPanel.isConnected) {
        await serialMonitorPanel.stop();
        output.appendLine("Serial disconnected (panel switch).");
        refreshToolbarState();
      }
    },
    /** Apply a new accent color across status bar, focus border, and badges. */
    cycleAccent: async (color: string) => {
      const config = vscode.workspace.getConfiguration("workbench");
      const current = (config.get("colorCustomizations") as Record<string, string>) || {};
      const updated = {
        ...current,
        "statusBar.background": color,
        "statusBar.noFolderBackground": color,
        "statusBar.debuggingBackground": color,
        "statusBarItem.remoteBackground": color,
        focusBorder: color,
        "activityBarBadge.background": color,
        "panelTitle.activeBorder": color,
      };
      const target =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;
      await config.update("colorCustomizations", updated, target);
      output.appendLine(
        `Accent color set to ${color} (Target: ${target === vscode.ConfigurationTarget.Workspace ? "Workspace" : "Global"})`,
      );
      refreshToolbarState();
    },
    /**
     * NEW in v1.0.9: called by the toolbar after a successful
     * `lib install` (registry name OR git URL). Regenerates clangd's
     * compile database so freshly added headers become hover-able.
     */
    onLibraryInstalled: refreshIntelliSenseAfterLibChange,
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ArduinoToolbarViewProvider.viewType, toolbar),
  );

  // ── Detection loop state ────────────────────────────────────────────────
  let lastPorts: Set<string> = new Set();
  let lastServerState: any = null;
  let lastPortChangeVersion = 0;
  // Intentionally do NOT restore the persisted target at activation.
  //
  // VS Code globalState survives a reinstall, so loading the last-used
  // target made the UI "guess" a board (e.g. a previously-used
  // Seeed XIAO ESP32C6) even when nothing was plugged in — confusing
  // and contrary to the 1.0.8 behavior where startup was always blank.
  // boardMemory (USB serial → FQBN) still handles fast reconnect inside
  // `reconcileTarget`, so an actually-connected board with a known USB
  // identity is restored as soon as `arduino-cli board list` runs.
  currentTarget = null;
  await syncTargetToServer(null);

  const refreshToolbarState = (): void => {
    const config = vscode.workspace.getConfiguration("workbench");
    const customizations = (config.get("colorCustomizations") as Record<string, string>) || {};
    toolbar.setState({
      port: currentTarget?.port ?? null,
      fqbn: currentTarget?.fqbn ?? null,
      connectedPorts: Array.from(lastPorts),
      serverRunning: serverProcess !== null,
      serverHealthy,
      lastScanAtMs,
      serialActive: serialMonitorPanel.isConnected,
      uploading: !!lastServerState?.uploading,
      accentColor: customizations["statusBar.background"] || "#007ACC",
    });
  };

  const setWarning = (text: string): void => {
    status.text = `$(warning) ${text}`;
    status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    status.tooltip = "Arduino Grease needs a board/port selection";
  };

  const setOk = (target: Target): void => {
    if (target.fqbn) {
      status.text = `$(circuit-board) ${target.fqbn} @ ${target.port}`;
      status.backgroundColor = undefined;
      status.tooltip = "Arduino Grease target";
    } else {
      status.text = `$(plug) ${target.port} (board unknown)`;
      status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      status.tooltip =
        "Port detected but board not resolved. Use 'arduino-cli board list' and 'arduino-cli core install <package>' to install the correct driver.";
    }
  };

  const checkArduinoCliProcess = (): Promise<boolean> =>
    new Promise(resolve => {
      // pgrep on macOS only returns PIDs, not full command lines — use ps/PowerShell instead.
      const cmd = process.platform === "win32"
        ? 'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine"'
        : "ps -eo args";
      require("child_process").exec(cmd, { timeout: 3000 }, (err: Error | null, stdout: string) => {
        if (err) return resolve(false);
        resolve(/arduino-cli\s+(compile|upload)/.test(stdout));
      });
    });

  /** Hit `/state` and update the toolbar's health indicator. */
  const checkServerHealth = async (verbose = false): Promise<void> => {
    if (!serverProcess) {
      serverHealthy = false;
      refreshToolbarState();
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:${serverProcess.port}/state`, {
        headers: { "x-grease-auth": serverProcess.authKey },
      });
      const s: any = await res.json();
      const ok = !!s.target;
      serverHealthy = ok;

      const wasActive = lastServerState?.uploading || lastServerState?.compiling || lastServerState?.serial?.isOpen || lastServerState?._cliActive;
      const hasCliProcess = await checkArduinoCliProcess();
      const isActive  = s.uploading || s.compiling || s.serial?.isOpen || hasCliProcess || s.agentActive;
      s._cliActive = hasCliProcess;
      if (isActive)       toolbar.view?.webview.postMessage({ type: "rainState", state: "thrust" });
      else if (wasActive) toolbar.view?.webview.postMessage({ type: "rainState", state: "idle" });
      lastServerState = s;
      if (
        typeof s.portChangeVersion === "number" &&
        s.portChangeVersion !== lastPortChangeVersion
      ) {
        lastPortChangeVersion = s.portChangeVersion;
        if (!s.uploading) void reconcileTarget();
      }

      if (!ok) {
        output.appendLine("Problem with MCP Server");
        sawServerProblem = true;
      } else if (sawServerProblem) {
        output.appendLine("MCP Server recovered.");
        sawServerProblem = false;
      }
      if (verbose) {
        output.appendLine(`Server status: ${ok ? "running and healthy" : "running but unhealthy"}`);
      }
    } catch (e) {
      serverHealthy = false;
      output.appendLine("Problem with MCP Server");
      if (verbose) {
        output.appendLine(
          `Server health check failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      sawServerProblem = true;
    }
    refreshToolbarState();
  };

  // Tracks which board+port combos have already been logged by BoardMemory
  // so the 5-second reconcile loop doesn't spam the Output channel on every cycle.
  const loggedRestores = new Set<string>();

  /**
   * Walk `arduino-cli board list`, apply remembered FQBNs to ports whose
   * USB identity we've seen before, then decide whether to auto-set a
   * target (only when there's exactly one unambiguous candidate and the
   * user hasn't chosen one explicitly).
   */
  const reconcileTarget = async (): Promise<void> => {
    lastScanAtMs = Date.now();
    const detection = await refreshBoards(output);
    lastCandidates = detection.candidates;
    const portsNow = new Set(
      lastCandidates.map((c) => c.port).filter((p): p is string => typeof p === "string"),
    );
    const changed =
      portsNow.size !== lastPorts.size ||
      Array.from(portsNow).some((p) => !lastPorts.has(p)) ||
      Array.from(lastPorts).some((p) => !portsNow.has(p));
    lastPorts = portsNow;
    if (changed) loggedRestores.clear();
    if (currentTarget?.port && !portsNow.has(currentTarget.port)) {
      output.appendLine(`Port ${currentTarget.port} disconnected. Clearing selected target.`);
      currentTarget = null;
      await saveTarget(context, null);
      await syncTargetToServer(null);
    }
    // Apply board memory, then dedupe to one best candidate per port.
    const boardMem = await loadBoardMemory(context);
    const resolvedCandidates: (BoardCandidate & { fromMemory?: boolean })[] = lastCandidates.map(
      (c) => {
        for (const k of boardMemoryKeys(c)) {
          if (boardMem[k]) {
            const logKey = `${c.port}:${k}:${boardMem[k].fqbn}`;
            if (!loggedRestores.has(logKey)) {
              output.appendLine(`[BoardMemory] Restored ${boardMem[k].fqbn} for ${c.port} via ${k}`);
              loggedRestores.add(logKey);
            }
            return { ...c, fqbn: boardMem[k].fqbn, fromMemory: true };
          }
        }
        return c;
      },
    );
    const portMap = new Map<string, BoardCandidate & { fromMemory?: boolean }>();
    for (const c of resolvedCandidates) {
      if (typeof c.port !== "string") continue;
      const existing = portMap.get(c.port);
      if (!existing || (!existing.fromMemory && c.fromMemory)) portMap.set(c.port, c);
    }
    const deduped = Array.from(portMap.values());
    const candidatesWithFqbn = deduped.filter(
      (c) => typeof c.fqbn === "string" && typeof c.port === "string",
    );
    const portsOnly = deduped.filter((c) => !c.fqbn && typeof c.port === "string");
    if (!currentTarget?.userChosen && candidatesWithFqbn.length === 1) {
      const only = candidatesWithFqbn[0];
      const remembered = only.fromMemory;
      currentTarget = { port: only.port, fqbn: only.fqbn!, userChosen: !!remembered };
      if (remembered) {
        const logKey2 = `auto:${only.fqbn}:${only.port}`;
        if (!loggedRestores.has(logKey2)) {
          output.appendLine(`[BoardMemory] Restored ${only.fqbn} for ${vidPidKey(only.vid, only.pid) ?? only.port}`);
          loggedRestores.add(logKey2);
        }
      }
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
    } else if (
      !currentTarget?.userChosen &&
      candidatesWithFqbn.length === 0 &&
      portsOnly.length === 1
    ) {
      const onlyPort = portsOnly[0];
      currentTarget = { port: onlyPort.port, fqbn: null };
      await saveTarget(context, currentTarget);
      await syncTargetToServer(currentTarget);
    }
    if (!currentTarget) {
      if (portsNow.size === 0) {
        setWarning("No serial ports detected");
        if (changed) output.appendLine("No Arduino port detected.");
      } else {
        setWarning("Select board/port");
      }
    } else {
      setOk(currentTarget);
      if (changed) {
        output.appendLine(
          `Port ${currentTarget.port} and Board ${currentTarget.fqbn ?? "unknown"} detected.`,
        );
      }
      // Auto board core detection — prompt to install missing core.
      if (currentTarget.fqbn && changed) {
        const corePkg = extractCoreFromFqbn(currentTarget.fqbn);
        if (corePkg) {
          const installed = await isCoreInstalled(corePkg);
          if (installed) {
            output.appendLine(`Board core ${corePkg} is already installed.`);
          } else {
            const choice = await vscode.window.showInformationMessage(
              `Arduino Grease: Board core "${corePkg}" is not installed. Would you like me to install the driver for this board?`,
              "Install",
              "Cancel",
            );
            if (choice === "Install") {
              output.appendLine(`Installing board core ${corePkg}...`);
              const up = await updateIndexes();
              output.appendLine(up.stdout);
              output.appendLine(up.stderr);
              const res = await installCore(corePkg);
              output.appendLine(res.stdout);
              output.appendLine(res.stderr);
              if (res.success) {
                vscode.window.showInformationMessage(
                  `Arduino Grease: Board core ${corePkg} installed successfully.`,
                );
              } else {
                vscode.window.showErrorMessage(
                  `Arduino Grease: Failed to install board core ${corePkg}. See Output.`,
                );
              }
            }
          }
        }
      }
    }
    refreshToolbarState();
  };

  /** Show the QuickPick board selector and persist whatever the user picks. */
  const refreshPortsAndBoard = async (): Promise<void> => {
    output.show(true);
    const detection = await refreshBoards(output);
    lastCandidates = detection.candidates;
    if (currentTarget?.port && currentTarget?.fqbn) {
      const picked = await promptForTarget(context, lastCandidates, currentTarget);
      if (picked) {
        currentTarget = { ...picked, userChosen: true };
        await syncTargetToServer(currentTarget);
        setOk(currentTarget);
        refreshToolbarState();
      }
      return;
    }
    if (portsRefreshArmed) {
      await vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      portsRefreshArmed = false;
      return;
    }
    portsRefreshArmed = true;
    setTimeout(() => {
      portsRefreshArmed = false;
    }, 6000);
    const picked = await promptForTarget(context, lastCandidates, currentTarget);
    if (picked) {
      currentTarget = { ...picked, userChosen: true };
      await syncTargetToServer(currentTarget);
      setOk(currentTarget);
      refreshToolbarState();
    }
  };

  /** Resolve a valid sketch folder or offer to start a new sketch. */
  const getValidSketchPath = async (): Promise<string | null> => {
    const sketchPath = getSketchFolder();
    if (!sketchPath) return null;
    const mainIno = findMainSketchFile(sketchPath);
    if (mainIno) return sketchPath;
    output.appendLine(`Invalid sketch folder (main .ino missing): ${sketchPath}`);
    const choice = await vscode.window.showWarningMessage(
      "Arduino Grease: Current folder is not a valid sketch (missing main .ino).",
      "Start Sketch",
      "Cancel",
    );
    if (choice === "Start Sketch") {
      await vscode.commands.executeCommand("arduinoMcp.startSketch");
    }
    return null;
  };

  /**
   * Resolve the sketch the user wants to build, staged into a folder that
   * arduino-cli will accept.
   *
   * Priority (matches user intent — "compile the file in front of me"):
   *   1. The .ino in the active editor (or any visible editor). If its parent
   *      folder name doesn't match the .ino basename — the common loose-.ino
   *      case — copy it plus sibling .h/.cpp into a temp folder of the right
   *      shape and use that.
   *   2. Fall back to folder-based detection (workspace root / subfolder
   *      sketch) for the legacy "no editor open but workspace IS a sketch"
   *      case.
   *
   * Returns null if no sketch is resolvable; the caller surfaces an error.
   */
  const resolveSketchForBuild = async (): Promise<PreparedSketch | null> => {
    const activeIno = getActiveInoPath();
    if (activeIno) {
      const prepared = prepareSketchForBuild(activeIno);
      if (prepared) return prepared;
      output.appendLine(`[verify] Could not stage active sketch: ${activeIno}`);
    }
    const folder = await getValidSketchPath();
    if (!folder) return null;
    const mainIno = findMainSketchFile(folder);
    if (!mainIno) return null;
    return { sketchDir: folder, mainIno, isTemp: false };
  };

  /**
   * After a failed compile, arduino-cli prints error paths pointing into our
   * temp staging dir (e.g. `/tmp/arduino-grease-sketches/X/X/X.ino:42`). Map
   * those back to the user's real file so the squiggles land on the code
   * they're editing.
   */
  const remapTempPathToOriginal = (filePath: string, prepared: PreparedSketch): string => {
    if (!prepared.isTemp || !prepared.originalDir) return filePath;
    const normalizedTemp = path.normalize(filePath);
    const normalizedSketchDir = path.normalize(prepared.sketchDir);
    if (!normalizedTemp.startsWith(normalizedSketchDir)) return filePath;
    const rel = path.relative(normalizedSketchDir, normalizedTemp);
    // The main .ino lives at `<sketchDir>/<base>.ino` but the user's file may
    // have a different basename — remap that one specifically.
    if (
      prepared.originalIno &&
      path.basename(rel).toLowerCase() === path.basename(prepared.mainIno).toLowerCase() &&
      path.dirname(rel) === "."
    ) {
      return prepared.originalIno;
    }
    return path.join(prepared.originalDir, rel);
  };

  /**
   * Verify a sketch (compile only, no upload). On success we ALSO regenerate
   * compile_commands.json so clangd picks up any changes. On failure we parse
   * arduino-cli's stderr into VS Code Diagnostics so red squiggles appear on
   * the offending lines.
   */
  const runVerifyOnly = async (
    fqbnOverride?: string,
  ): Promise<{
    ok: boolean;
    sketchPath?: string;
    fqbn?: string;
    prepared?: PreparedSketch;
  }> => {
    output.show(true);
    const prepared = await resolveSketchForBuild();
    if (!prepared) {
      vscode.window.showErrorMessage(
        "Arduino Grease: No .ino file open or valid sketch folder found.",
      );
      return { ok: false };
    }
    const sketchPath = prepared.sketchDir;
    const fqbn = fqbnOverride ?? currentTarget?.fqbn ?? null;
    if (!fqbn) {
      const choice = await vscode.window.showWarningMessage(
        "Arduino Grease: Board unknown. Install/select a core so an FQBN is available.",
        "Install core...",
        "Select board/port...",
      );
      if (choice === "Install core...") {
        await vscode.commands.executeCommand("arduinoMcp.installCore");
      } else {
        await vscode.commands.executeCommand("arduinoMcp.refreshPortsBoards");
      }
      return { ok: false };
    }
    // Log the user-facing path (the .ino they're editing), not the temp copy.
    const displayPath = prepared.isTemp ? prepared.originalIno! : sketchPath;
    output.appendLine(`$ arduino-cli compile --fqbn ${fqbn} "${displayPath}"`);
    if (prepared.isTemp) {
      output.appendLine(
        `  (staged into temp sketch folder: ${sketchPath} — original folder name '${path.basename(
          prepared.originalDir!,
        )}' doesn't match .ino basename '${path.basename(prepared.mainIno, ".ino")}')`,
      );
    }
    const res = await runArduinoCli(["compile", "--fqbn", fqbn, sketchPath], sketchPath);
    output.appendLine(res.stdout);
    output.appendLine(res.stderr);
    if (!res.success) {
      // Parse `file:line:col: error: message` into VS Code Diagnostics.
      const diagMap = new Map<string, vscode.Diagnostic[]>();
      const errorRegex = /^(.+):([0-9]+):([0-9]+):\s*(error|warning):\s*(.+)$/gm;
      let m: RegExpExecArray | null;
      const combinedOutput = res.stdout + "\n" + res.stderr;
      while ((m = errorRegex.exec(combinedOutput)) !== null) {
        const filePath = remapTempPathToOriginal(m[1], prepared);
        const line = Math.max(0, parseInt(m[2], 10) - 1);
        const col = Math.max(0, parseInt(m[3], 10) - 1);
        const severity =
          m[4] === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning;
        const message = m[5];
        const range = new vscode.Range(line, col, line, col + 1);
        const diag = new vscode.Diagnostic(range, message, severity);
        diag.source = "Arduino Grease";
        const uri = vscode.Uri.file(filePath);
        const key = uri.toString();
        if (!diagMap.has(key)) diagMap.set(key, []);
        diagMap.get(key)!.push(diag);
      }
      arduinoDiagnostics.clear();
      for (const [uriStr, diags] of diagMap) {
        arduinoDiagnostics.set(vscode.Uri.parse(uriStr), diags);
      }
      vscode.window.showErrorMessage("Arduino Grease: Verify failed (see Output).");
      return { ok: false, prepared };
    }
    arduinoDiagnostics.clear();
    // Refresh clangd's compile database after a successful verify. When we
    // built in a temp staging dir, we still want compile_commands.json next
    // to the user's actual .ino so clangd in the open editor picks it up.
    const ccTarget = prepared.isTemp && prepared.originalDir ? prepared.originalDir : sketchPath;
    void generateCompileCommands(fqbn, ccTarget, output);
    vscode.window.showInformationMessage("Arduino Grease: Verify succeeded.");
    return { ok: true, sketchPath, fqbn, prepared };
  };

  /**
   * Verify (unless skipped) then upload. Saves all dirty files first so
   * what's compiled matches what's on screen.
   */
  const runUpload = async (opts?: {
    verifyFirst?: boolean;
    fqbnOverride?: string;
    portOverride?: string;
  }): Promise<boolean> => {
    output.show(true);
    await vscode.workspace.saveAll(false);
    let prepared: PreparedSketch | null = null;
    let fqbn: string | null = opts?.fqbnOverride ?? currentTarget?.fqbn ?? null;
    if (opts?.verifyFirst !== false) {
      const verify = await runVerifyOnly(fqbn ?? undefined);
      if (!verify.ok) return false;
      prepared = verify.prepared ?? null;
      fqbn = verify.fqbn ?? fqbn;
    } else {
      prepared = await resolveSketchForBuild();
    }
    if (!prepared) {
      vscode.window.showErrorMessage("Arduino Grease: No .ino file to upload.");
      return false;
    }
    const sketchPath = prepared.sketchDir;
    const port = opts?.portOverride ?? currentTarget?.port ?? null;
    if (!port) {
      vscode.window.showWarningMessage("Arduino Grease: Select a port first.");
      await vscode.commands.executeCommand("arduinoMcp.refreshPortsBoards");
      return false;
    }
    if (!fqbn) {
      vscode.window.showWarningMessage("Arduino Grease: Select a board first.");
      await vscode.commands.executeCommand("arduinoMcp.refreshPortsBoards");
      return false;
    }
    const displayPath = prepared.isTemp ? prepared.originalIno! : sketchPath;
    output.appendLine(`$ arduino-cli upload -p ${port} --fqbn ${fqbn} "${displayPath}"`);
    toolbar.view?.webview.postMessage({ type: "rainState", state: "thrust" });
    const res = await runArduinoCli(
      ["upload", "-p", port, "--fqbn", fqbn, sketchPath],
      sketchPath,
    );
    output.appendLine(res.stdout);
    output.appendLine(res.stderr);
    toolbar.view?.webview.postMessage({ type: "uploadResult", success: res.success });
    if (!res.success) {
      vscode.window.showErrorMessage("Arduino Grease: Upload failed (see Output).");
      return false;
    }
    vscode.window.showInformationMessage("Arduino Grease: Upload succeeded.");
    return true;
  };

  /** Bootloader-burn flow for bare chips; programmer is optional. */
  const runFirmwareUpload = async (fqbn: string, port: string): Promise<void> => {
    output.show(true);
    const programmer = await vscode.window.showInputBox({
      title: "Programmer",
      prompt: "Enter programmer (e.g., avrispmkii, usbtinyisp) or leave empty for default",
      ignoreFocusOut: false,
    });
    if (programmer === undefined) return;
    output.appendLine(`[Mngrs] Burning bootloader for ${fqbn} on ${port}...`);
    const args = ["burn-bootloader", "-b", fqbn, "-p", port];
    if (programmer) {
      args.push("-P", programmer);
    }
    const up = await runArduinoCli(args);
    output.appendLine(up.stdout);
    output.appendLine(up.stderr);
    if (!up.success) {
      vscode.window.showErrorMessage("Arduino Grease: Burn bootloader failed (see Output).");
      return;
    }
    vscode.window.showInformationMessage("Arduino Grease: Bootloader burned to target.");
  };

  // ── Initial reconciliation + health checks ──────────────────────────────
  await reconcileTarget();

  // NEW in v1.0.9: first-open IntelliSense refresh.
  //   When the extension activates and there's a sketch open, write the
  //   .clangd file (cheap) and regenerate compile_commands.json if it's
  //   missing or older than the main .ino source. This is what guarantees
  //   that a user opening a sketch for the first time gets working hovers
  //   without having to run Verify manually.
  void refreshIfFirstOpen({ fqbn: currentTarget?.fqbn ?? null, sidecarPath, output });

  // NEW in v1.0.9: one-shot Doxygen-comment patcher for installed cores.
  //   Free Arduino functions get their hover docs from the sidecar header,
  //   but C++ classes (Serial, Stream, Print) can't be redeclared — their
  //   hover docs have to live in the real core headers. This walks every
  //   installed core and adds Doxygen comments to Print.h / Stream.h /
  //   HardwareSerial.h. Idempotent (marker comment guards re-runs); fire-
  //   and-forget so activation doesn't block on disk I/O.
  void patchInstalledCores({
    log: (msg) => output.appendLine(msg),
    arduinoCliPath: process.env.ARDUINO_CLI_PATH,
  });

  await delay(3000);
  await checkServerHealth(true);
  const healthInterval = setInterval(() => {
    void checkServerHealth(false);
  }, 500);
  context.subscriptions.push({ dispose: () => clearInterval(healthInterval) });

  // Periodic board re-poll as a fallback to the server's USB attach/detach
  // events. The bundled `usb` package fires those reliably most of the time,
  // but if it misses (permissions, hub quirks, board plugged in before
  // activation finished), we'd otherwise leave the user without a board for
  // the entire session. Polling arduino-cli every 5s is cheap and self-heals.
  const reconcileInterval = setInterval(() => {
    if (lastServerState?.uploading) return;
    void reconcileTarget();
  }, 5000);
  context.subscriptions.push({ dispose: () => clearInterval(reconcileInterval) });

  // ── COMMAND REGISTRATIONS ────────────────────────────────────────────────
  // Each command below is exposed in the Command Palette and (mostly) wired
  // to a button in the sidebar toolbar. The comment above each one explains
  // WHAT the command does — useful when reading the source to learn.

  context.subscriptions.push(
    /**
     * `arduinoMcp.serverStatus`
     * Print the current state of the bundled MCP server to the Output panel.
     * Useful when you're debugging "is my AI client actually talking to me?".
     */
    vscode.commands.registerCommand("arduinoMcp.serverStatus", async () => {
      output.show(true);
      output.appendLine("Checking MCP server status...");
      if (!serverProcess) {
        output.appendLine("Server status: stopped");
        serverHealthy = false;
        refreshToolbarState();
        return;
      }
      await checkServerHealth(true);
    }),

    /**
     * `arduinoMcp.refreshServer`
     * Smart cycle: starts the server if stopped; restarts it if running but
     * unhealthy; stops it if running and healthy. Mapped to the ||R|| link
     * next to "AI Tether" in the sidebar.
     */
    vscode.commands.registerCommand("arduinoMcp.refreshServer", async () => {
      output.show(true);
      if (!serverProcess) {
        await startServer();
        await delay(1000);
        await checkServerHealth(true);
        return;
      }
      if (serverProcess && !serverHealthy) {
        await stopServer();
        await delay(1000);
        await startServer();
        await delay(1000);
        await checkServerHealth(true);
        return;
      }
      if (serverProcess && serverHealthy) {
        await stopServer();
        refreshToolbarState();
      }
    }),

    /** `arduinoMcp.startServer` — explicit start. */
    vscode.commands.registerCommand("arduinoMcp.startServer", async () => {
      output.show(true);
      const ok = await startServer();
      if (ok) {
        await checkServerHealth(true);
        output.appendLine("Server start command completed.");
      }
      refreshToolbarState();
    }),

    /** `arduinoMcp.stopServer` — explicit stop. */
    vscode.commands.registerCommand("arduinoMcp.stopServer", async () => {
      output.show(true);
      await stopServer();
      refreshToolbarState();
    }),

    /** `arduinoMcp.toggleServer` — start ↔ stop in one keystroke. */
    vscode.commands.registerCommand("arduinoMcp.toggleServer", async () => {
      output.show(true);
      if (serverProcess) {
        await stopServer();
      } else {
        await startServer();
        await checkServerHealth(true);
      }
      refreshToolbarState();
    }),

    /**
     * `arduinoMcp.startSketch`
     * Prompt for a name + parent folder, then call `arduino-cli sketch new`
     * to create a properly-structured sketch folder, and open the new
     * `.ino` in the editor.
     */
    vscode.commands.registerCommand("arduinoMcp.startSketch", async () => {
      output.show(true);
      const name = await vscode.window.showInputBox({
        title: "Start new sketch",
        prompt: "Sketch name",
        placeHolder: "BlinkNano33",
        ignoreFocusOut: false,
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) return "Sketch name is required.";
          if (!/^[A-Za-z0-9_\-]+$/.test(trimmed))
            return "Use only letters, numbers, underscore, or dash.";
          return null;
        },
      });
      if (!name) return;
      const defaultParent =
        vscode.workspace.workspaceFolders?.[0]?.uri ??
        vscode.Uri.file(path.join(os.homedir(), "Documents"));
      const pickedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: defaultParent,
        openLabel: "Create Sketch Here",
        title: "Choose parent folder",
      });
      if (!pickedFolder?.[0]) return;
      const parent = pickedFolder[0].fsPath;
      const sketchPath = path.join(parent, name.trim());
      output.appendLine(`$ arduino-cli sketch new "${sketchPath}"`);
      const res = await runArduinoCli(["sketch", "new", sketchPath]);
      output.appendLine(res.stdout);
      output.appendLine(res.stderr);
      if (!res.success) {
        vscode.window.showErrorMessage("Arduino Grease: Failed to create sketch. See output.");
        return;
      }
      const inoPath = path.join(sketchPath, `${name.trim()}.ino`);
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(inoPath));
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (e) {
        output.appendLine(
          `Could not open sketch file automatically: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      output.appendLine(`Sketch created: ${sketchPath}`);
      vscode.window.showInformationMessage(`Arduino Grease: Sketch created (${name.trim()}).`);
    }),

    /**
     * `arduinoMcp.installCore`
     * Quick-pick a common core (AVR, SAMD, Mbed, ESP32, RP2040) and run
     * `arduino-cli core install`. After install, reconcile so the new
     * board becomes pickable in the QuickPick.
     */
    vscode.commands.registerCommand("arduinoMcp.installCore", async () => {
      output.show(true);
      const items = [
        { label: "Arduino AVR (Uno/Nano/Mega)", description: "arduino:avr", pkg: "arduino:avr" },
        {
          label: "Arduino SAMD (Nano 33 IoT, MKR)",
          description: "arduino:samd",
          pkg: "arduino:samd",
        },
        {
          label: "Arduino Mbed OS (Nano 33 BLE, Portenta)",
          description: "arduino:mbed",
          pkg: "arduino:mbed",
        },
        { label: "ESP32", description: "esp32:esp32", pkg: "esp32:esp32" },
        { label: "RP2040", description: "rp2040:rp2040", pkg: "rp2040:rp2040" },
      ];
      const picked = await vscode.window.showQuickPick(items, {
        title: "Install board core",
        placeHolder: "Pick a core package",
        ignoreFocusOut: false,
      });
      if (!picked) return;
      const up = await updateIndexes();
      output.appendLine(up.stdout);
      output.appendLine(up.stderr);
      const res = await installCore(picked.pkg);
      output.appendLine(res.stdout);
      output.appendLine(res.stderr);
      if (!res.success) {
        vscode.window.showErrorMessage(`Arduino Grease: Core install failed for ${picked.pkg}.`);
      } else {
        vscode.window.showInformationMessage(
          `Arduino Grease: Core installed: ${picked.pkg}.`,
        );
        await reconcileTarget();
      }
    }),

    /**
     * `arduinoMcp.verify`
     * Compile the current sketch without uploading. Also refreshes
     * compile_commands.json for clangd on success.
     */
    vscode.commands.registerCommand("arduinoMcp.verify", async () => {
      const res = await runVerifyOnly();
      toolbar.view?.webview.postMessage({ type: "verifyResult", success: res.ok === true });
    }),

    /**
     * `arduinoMcp.upload`
     * Verify-then-upload the current sketch to the selected board+port.
     * Bound to F5 / Shift+Enter on `.ino` files (see package.json keybindings).
     */
    vscode.commands.registerCommand("arduinoMcp.upload", async () => {
      const ok = await runUpload({ verifyFirst: true });
      toolbar.view?.webview.postMessage({ type: "uploadResult", success: ok === true });
    }),

    /**
     * `arduinoMcp.refreshPortsBoards`
     * Show the QuickPick board/port selector. Mapped to ||R|| in the sidebar.
     */
    vscode.commands.registerCommand("arduinoMcp.refreshPortsBoards", async () => {
      await refreshPortsAndBoard();
    }),

    /** `arduinoMcp.selectTarget` — alias for refreshPortsBoards. */
    vscode.commands.registerCommand("arduinoMcp.selectTarget", async () => {
      await refreshPortsAndBoard();
    }),

    /**
     * `arduinoMcp.toggleSerial`
     * Open the serial monitor if disconnected, close it if connected.
     */
    vscode.commands.registerCommand("arduinoMcp.toggleSerial", async () => {
      if (serialMonitorPanel.isConnected) {
        await serialMonitorPanel.stop();
      } else {
        await vscode.commands.executeCommand("arduinoMcp.openSerialMonitor");
      }
      refreshToolbarState();
    }),

    /**
     * `arduinoMcp.openSerialMonitor`
     * Start the serial monitor at 9600 baud on the currently selected port
     * and print a help line of console verbs (baud=, send=, clear,
     * disconnect, connect).
     */
    vscode.commands.registerCommand("arduinoMcp.openSerialMonitor", async () => {
      output.show(true);
      const defaultPort = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      await serialMonitorPanel.start(defaultPort, 9600);
      output.appendLine(
        `Type "baud=X" to set a new baud rate, or try any of the following commands: 'send="Hello World"', "clear", "disconnect", or "connect". Transmitting from ${defaultPort ?? "(unknown port)"} below:`,
      );
    }),

    /**
     * `arduinoMcp.serialCommand`
     * Prompt for a single serial-monitor command (without opening a new
     * monitor session). Useful for one-off `send=...` calls from the
     * Command Palette.
     */
    vscode.commands.registerCommand("arduinoMcp.serialCommand", async () => {
      output.show(true);
      const command = await vscode.window.showInputBox({
        title: "Serial command",
        prompt: "Enter serial command",
        placeHolder: 'baud=9600 | send="Hello World" | clear | disconnect | connect',
        ignoreFocusOut: false,
      });
      if (!command) return;
      await serialMonitorPanel.handleConsoleCommand(command);
    }),

    /**
     * `arduinoMcp.openSerialPlotter`
     * Open the canvas-based serial plotter in a webview, auto-connect to
     * the current port, and move it to a new VS Code window so it can sit
     * beside the editor.
     */
    vscode.commands.registerCommand("arduinoMcp.openSerialPlotter", async () => {
      output.show(true);
      const defaultPort = currentTarget?.port ?? lastCandidates[0]?.port ?? null;
      serialPlotterPanel.show(defaultPort, true);
      if (!serialMonitorPanel.isConnected && defaultPort) {
        void serialMonitorPanel.start(defaultPort, 9600);
      }
      setTimeout(() => {
        void vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
      }, 500);
      refreshToolbarState();
    }),

    /**
     * `arduinoMcp.openExamples`
     * Open the standalone Examples webview. The serial monitor is closed
     * first so it can't conflict with the panel.
     */
    vscode.commands.registerCommand("arduinoMcp.openExamples", async () => {
      output.show(true);
      if (serialMonitorPanel.isConnected) {
        await serialMonitorPanel.stop();
        output.appendLine("Serial disconnected (Examples panel opened).");
        refreshToolbarState();
      }
      examplesPanel.show(currentTarget?.fqbn ?? null);
    }),

    /**
     * `arduinoMcp.openBoardTemplate`
     * Open the "AI Prompt Template" panel that helps users write structured
     * prompts about wiring, modules, robot structure, and expected behavior.
     */
    vscode.commands.registerCommand("arduinoMcp.openBoardTemplate", async () => {
      output.show(true);
      boardTemplatePanel.show({
        fqbn: currentTarget?.fqbn ?? null,
        port: currentTarget?.port ?? null,
      });
    }),

    /**
     * `arduinoMcp.cycleAccentColor`
     * Walk through 7 dark accent colors for the status bar / focus border /
     * activity bar badges. Workspace-scoped if a workspace is open,
     * otherwise global.
     */
    vscode.commands.registerCommand("arduinoMcp.cycleAccentColor", async () => {
      const ACCENT_COLORS = [
        "#005FA0",
        "#6B0000",
        "#A34300",
        "#8F6809",
        "#6B004A",
        "#520A85",
        "#004D00",
      ];
      const config = vscode.workspace.getConfiguration("workbench");
      const current = (config.get("colorCustomizations") as Record<string, string>) || {};
      const currentColor = current["statusBar.background"] || "#007ACC";
      const idx = ACCENT_COLORS.indexOf(currentColor);
      const nextIdx = (idx + 1) % ACCENT_COLORS.length;
      const color = ACCENT_COLORS[nextIdx];
      const updated = {
        ...current,
        "statusBar.background": color,
        "statusBar.noFolderBackground": color,
        "statusBar.debuggingBackground": color,
        "statusBarItem.remoteBackground": color,
        focusBorder: color,
        "activityBarBadge.background": color,
        "panelTitle.activeBorder": color,
      };
      const target =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;
      await config.update("colorCustomizations", updated, target);
      output.appendLine(
        `Accent color cycled to ${color} (Target: ${target === vscode.ConfigurationTarget.Workspace ? "Workspace" : "Global"})`,
      );
      refreshToolbarState();
      toolbar.view?.webview.postMessage({ type: "accentColor", color });
    }),

    /**
     * NEW in v1.0.9: `arduinoMcp.regenerateIntelliSense`
     *
     * Forces a refresh of the clangd IntelliSense database for the current
     * sketch. Useful when:
     *   - You just installed a new library and want the symbols to show up
     *     without restarting VS Code.
     *   - clangd's hover/completion got out of sync (e.g. you edited
     *     compile_commands.json by hand).
     *   - You want to manually re-create the `.clangd` config after deleting it.
     *
     * What it does:
     *   1. Writes `.clangd` into the sketch root (idempotent).
     *   2. Runs `arduino-cli compile --only-compilation-database` to
     *      regenerate `compile_commands.json` for the current FQBN.
     *
     * Clangd watches both files and re-parses automatically after they change.
     */
    vscode.commands.registerCommand("arduinoMcp.regenerateIntelliSense", async () => {
      output.show(true);
      const sketchFolder = getSketchFolder();
      if (!sketchFolder) {
        vscode.window.showWarningMessage(
          "Arduino Grease: Open a sketch first to regenerate IntelliSense.",
        );
        return;
      }
      output.appendLine(`[clangd] Manual IntelliSense refresh for ${sketchFolder}...`);
      const ok = await refreshIntelliSense({
        sketchFolder,
        fqbn: currentTarget?.fqbn ?? null,
        sidecarPath,
        output,
        // Not silent — the manual command should surface validation issues
        // (e.g. loose .ino files) with an actionable popup.
        silent: false,
      });
      // Only show the "success" toast when compile_commands.json actually got
      // generated. If validation failed, the validator already showed its own
      // warning popup with an Auto-fix action.
      if (ok) {
        vscode.window.showInformationMessage(
          "Arduino Grease: IntelliSense refreshed for clangd.",
        );
      } else if (!currentTarget?.fqbn) {
        vscode.window.showInformationMessage(
          "Arduino Grease: .clangd written. Pick a board to also refresh compile_commands.json.",
        );
      }
    }),
  );

  refreshToolbarState();
  output.appendLine("Arduino Grease activated.");
}

export function deactivate(): void {
  // Resources are cleaned up via the subscriptions array.
}
