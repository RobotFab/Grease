## Arduino Grease

Arduino tooling + a bundled local MCP server for agentic debugging inside VS Code, Cursor, and Antigravity.

### Prerequisites
- Node.js
- `arduino-cli` installed (and accessible on `PATH`)

### What this extension does (MVP)
- Starts a bundled MCP server at `127.0.0.1:3333` (MCP endpoint: `/mcp`, health: `/health`).
- Detects boards every 30s via `arduino-cli board list --format json`.
- Auto-selects a target if exactly one recognized board is present; otherwise prompts you to pick.
- Adds Activity Bar actions for Verify/Upload/Serial Monitor/Serial Plotter/Examples/Managers/Board Template.

### Install (VSIX / VSX)
1. Build and package:

```bash
npm install
npm run build
npx @vscode/vsce package --skip-license --allow-missing-repository
```

2. Install the generated `arduino-mcp-0.1.0.vsix` from your IDE’s extension installer (VS Code/Cursor/Antigravity).



This package was developed by Andre Rosendo.
