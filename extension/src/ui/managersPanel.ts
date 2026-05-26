/**
 * ui/managersPanel.ts
 * ───────────────────
 * Parsing helpers for the Boards & Libraries managers tab.
 *
 * The actual UI lives inside the toolbar webview (views/toolbarView.ts) — this
 * file only owns the JSON → row shaping that the tab needs. Kept as a separate
 * module so unit tests can exercise the parsers without spinning up VS Code.
 */

export interface InstalledBoardRow {
  name: string;
  fqbn: string;
  platform: string;
  version: string;
}

export interface InstalledLibraryRow {
  name: string;
  version?: string;
  author?: string;
  sentence?: string;
}

/**
 * Flatten `arduino-cli core list --json` into one row per board (name × fqbn).
 * The CLI shape is platform → installed version → boards array, so we walk
 * each platform's released boards and emit the user-facing rows.
 */
export function parseInstalledBoards(rawJson: string): InstalledBoardRow[] {
  const parsed = JSON.parse(rawJson);
  const platforms = Array.isArray(parsed?.platforms) ? parsed.platforms : [];
  const rows: InstalledBoardRow[] = [];
  for (const p of platforms) {
    const platformId = String(p?.id ?? "");
    const version = String(p?.installed_version ?? "");
    const releases = p?.releases ?? {};
    const release = releases?.[version] ?? null;
    const boards = Array.isArray(release?.boards) ? release.boards : [];
    for (const b of boards) {
      const name = String(b?.name ?? "").trim();
      const fqbn = String(b?.fqbn ?? "").trim();
      if (!name || !fqbn) continue;
      rows.push({ name, fqbn, platform: platformId, version });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/**
 * Parse `arduino-cli lib list --json` (or `lib search --json`). Both forms
 * are handled — `installed_libraries` for the local list, `libraries` for
 * the search results from the registry.
 */
export function parseLibraries(rawJson: string): InstalledLibraryRow[] {
  const parsed = JSON.parse(rawJson);
  const libraries = Array.isArray(parsed?.installed_libraries)
    ? parsed.installed_libraries
    : Array.isArray(parsed?.libraries)
      ? parsed.libraries
      : [];
  const out: InstalledLibraryRow[] = libraries
    .map((l: any) => ({
      name: String(l?.library?.name ?? l?.name ?? "").trim(),
      version: String(l?.library?.version ?? l?.version ?? "").trim() || undefined,
      author: String(l?.library?.author ?? l?.author ?? "").trim() || undefined,
      sentence: String(l?.library?.sentence ?? l?.sentence ?? "").trim() || undefined,
    }))
    .filter((x: InstalledLibraryRow) => x.name.length > 0);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
