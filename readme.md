## Arduino Grease

Arduino Grease is a software to build microcontrollers and robots capable of debugging themselves. From LED blinking to Reinforcement Learning experiments, this is an all-in-one solution for your problems.

Arduino tooling + a bundled **Grease Server** for **agentic hardware debugging** inside VS Code, Cursor, and Antigravity.

### Prerequisites (Important!)
- Node.js
- `arduino-cli` installed (and accessible on `PATH`)
- For Windows users, install them here (<a href="https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.msi">arduino-cli Installer</a>, <a href="https://nodejs.org/dist/v24.15.0/node-v24.15.0-x64.msi">Node Installer</a> and <a href="https://github.com/git-for-windows/git/releases/download/v2.54.0.windows.1/Git-2.54.0-64-bit.exe">Git Installer(recommended)</a>)
- For Mac/Linux/Other users, install them here (<a href="https://arduino.github.io/arduino-cli/1.4/installation/">arduino-cli</a>, <a href="https://nodejs.org/en/download">Node</a> and <a href="https://git-scm.com/install/">Git (recommended)</a>)
- Restart your VS Code (maybe PC?) after it. Test "node -v" and "arduino-cli -v" on the terminal.
- Make sure your AI Tether is running.

### What this extension does (MVP)
- Connects to your microcontroller using arduino-cli, but communicates through Serial Port using the bundled Grease Server.
- Starts the Grease Server (random Auth) at `127.0.0.1:333X` (MCP endpoint: `/mcp`, health: `/health`) and REST endpoints to handle the communication.
- Runs a SKILL file at the MCP, defining embedded debugging tools for agents.
- Auto-selects a target if exactly one recognized board is present; otherwise prompts you to pick.
- Adds Activity Bar actions for Verify/Upload/Serial Monitor/Serial Plotter/Examples/Managers/Board Template, to create an user friendly environment.

### v1.0.5 — New Features
- **Arduino Syntax Highlighting**: Full TextMate grammar for `.ino` files with Arduino-specific functions, types, and constants.
- **clangd IntelliSense Bridge**: Generates `compile_commands.json` for semantic understanding; creates diagnostic collection for errors.
- **Auto Board Core Detection**: Detects FQBN on board connection and auto-prompts to install missing board cores.
- **Grease & Graphite Themes**: Two premium dark themes auto-applied on install. Activity bar moves to top.
- **Accent Color Cycling**: Clickable block cycles through 7 accent colors, updating the VS Code status bar color.
- **Serial Auto-Disconnect**: Serial communication turns off when opening Manager or Examples panels.

### Inspiration

This was inspired by my work in 2015 on the "Mother Robot" a system that could build and improve its own "children."

The robots couldn't effectively see what was happening in the real world, relying on us to be their sensors and set goals. Now they can debug themselves, while we concentrate on setting their goals.

### Install (VSIX / VSX)
1. Build and package:

```bash
npm install
npm run build
npx @vscode/vsce package --skip-license --allow-missing-repository
```

2. Install the generated `arduino-grease-1.0.5.vsix` from your IDE's extension installer (VS Code/Cursor/Antigravity/Other VS-based IDEs).

### Credits

As I always told my students, "If mechanical engineers are the knights, and computer scientists are wizards, then we roboticists are the paladins." 

Designing algorithms is getting easier, and the next frontier is pracical/experimental. The real Robotics' bottleneck is where code meets metal.

This package was developed by Prof. Andre Rosendo.
