## Arduino Grease

tl;dr Program robots to do what you say and let them help debug themselves through Serial.

Arduino tooling + a bundled local MCP server for **agentic debugging** inside VS Code, Cursor, and Antigravity.

### Prerequisites
- Node.js
- `arduino-cli` installed (and accessible on `PATH`)

### What this extension does (MVP)
- Connects to your microcontroller using arduino-cli, but communicates through Serial Port using a node.js MCP server.
- Starts a bundled MCP server at `127.0.0.1:3333` (MCP endpoint: `/mcp`, health: `/health`) to handle the communication.
- Detects boards every 30s via `arduino-cli board list --format json`.
- Auto-selects a target if exactly one recognized board is present; otherwise prompts you to pick.
- Adds Activity Bar actions for Verify/Upload/Serial Monitor/Serial Plotter/Examples/Managers/Board Template, to create an user friendly environment.

### Inspiration

Most AI tooling lives in a sandbox. Robotics doesn’t.

Serial output is where things get real — noisy sensors, bad calibration, weird edge cases. That’s exactly where agents should be looking.

Arduino Grease lets an AI agent:

Read Serial output
Interpret what’s happening
Adjust code or parameters accordingly

Not simulation. Not guesses.
Feedback from the physical world.

This was inspired by my work in 2015 on the "Mother Robot" a system that could build and improve its own “children.”

One of the biggest limitations wasn’t intelligence.
It was communication.

The robots couldn’t effectively talk to themselves about what was happening in the real world, relying on us to be their sensors in the real world. We still are, but mostly setting goals.

### Install (VSIX / VSX)
1. Build and package:

```bash
npm install
npm run build
npx @vscode/vsce package --skip-license --allow-missing-repository
```

2. Install the generated `arduino-grease-0.2.6.vsix` from your IDE’s extension installer (VS Code/Cursor/Antigravity/Other VS-based IDEs).

### Credits

As I always told my students, "If mechanical engineers are the knights, and computer scientists are wizards, then we roboticists are the paladins." 

We’re forging something abstract into something physical.
The future of robotics may end up being more mechanical than we expect.

Designing algorithms is getting easier.
The real bottleneck is where code meets metal.

This package was developed by Prof. Andre Rosendo.
