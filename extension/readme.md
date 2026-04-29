## Arduino Grease

tl;dr Program robots to do what you say and let them help debug themselves through Serial.

Arduino tooling + a bundled local MCP server for **agentic debugging** inside VS Code, Cursor, and Antigravity.

### Prerequisites (Important!)
- Node.js
- `arduino-cli` installed (and accessible on `PATH`)
- For Windows users, install them here (<a href="https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.msi">arduino-cli</a>, <a href="https://nodejs.org/dist/v24.15.0/node-v24.15.0-arm64.msi">Node</a> and <a href="https://github.com/git-for-windows/git/releases/download/v2.54.0.windows.1/Git-2.54.0-64-bit.exe">Git (recommended)</a>)
- For Mac/Linux users, install them here (<a href="https://arduino.github.io/arduino-cli/1.4/installation/">arduino-cli</a>, <a href="https://nodejs.org/en/download">Node</a> and <a href="https://git-scm.com/install/">Git (recommended)</a>)

### What this extension does (MVP)
- Connects to your microcontroller using arduino-cli, but communicates through Serial Port using a node.js MCP server.
- Starts a bundled MCP server at `127.0.0.1:3333` (MCP endpoint: `/mcp`, health: `/health`) to handle the communication.
- Runs a SKILL file at the MCP, defining embedded debugging tools for agents.
- Auto-selects a target if exactly one recognized board is present; otherwise prompts you to pick.
- Adds Activity Bar actions for Verify/Upload/Serial Monitor/Serial Plotter/Examples/Managers/Board Template, to create an user friendly environment.

### Inspiration

This was inspired by my work in 2015 on the "Mother Robot" a system that could build and improve its own “children.”

The robots couldn’t effectively talk to themselves about what was happening in the real world, relying on us to be their sensors and set goals. Now they can debug themselves, while we set their goals.

### Install (VSIX / VSX)
1. Build and package:

```bash
npm install
npm run build
npx @vscode/vsce package --skip-license --allow-missing-repository
```

2. Install the generated `arduino-grease-1.0.0.vsix` from your IDE’s extension installer (VS Code/Cursor/Antigravity/Other VS-based IDEs).

### Credits

As I always told my students, "If mechanical engineers are the knights, and computer scientists are wizards, then we roboticists are the paladins." 

Designing algorithms is getting easier, and the next frontier is experimental.
The real Robotics bottleneck is where code meets metal.

This package was developed by Prof. Andre Rosendo.
