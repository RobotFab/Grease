## Arduino Grease

tl;dr Program robots to do what you say and let them help debug themselves through Serial.

Arduino tooling + a bundled local MCP server for **agentic debugging** inside VS Code, Cursor, and Antigravity.

### Prerequisites
- Node.js
- `arduino-cli` installed (and accessible on `PATH`)

### What this extension does (MVP)
- Connects to your microcontroller using arduino-cli, but communicates through Serial Port using a node.js MCP server.
- Starts a bundled MCP server at `127.0.0.1:3333` (MCP endpoint: `/mcp`, health: `/health`) to handle the communication.
- Runs a SKILL file at the MCP, defining embedded debugging tools for agents.
- Auto-selects a target if exactly one recognized board is present; otherwise prompts you to pick.
- Adds Activity Bar actions for Verify/Upload/Serial Monitor/Serial Plotter/Examples/Managers/Board Template, to create an user friendly environment.

### Install (VSIX / VSX)
1. Build and package:

```bash
npm install
npm run build
npx @vscode/vsce package --skip-license --allow-missing-repository
```

2. Install the generated `arduino-grease-x-x-x.vsix` from your IDE’s extension installer (VS Code/Cursor/Antigravity/Other VS-based IDEs).

### Credits

As I always told my students, "If mechanical engineers are the knights, and computer scientists are wizards, then we roboticists are the paladins." 

Designing algorithms is getting easier. The real bottleneck is experimental, practical work. That's where the software meets the hardware.

This package was developed by Prof. Andre Rosendo.
