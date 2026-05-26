<!-- grease-skill-version: 5 -->
# Arduino Grease — Robot Skill

> **IMPORTANT — Read this first.**
> This file defines the skill, constraints, and operating preferences for this Arduino Grease project.
> Every AI agent using Arduino Grease **must** call `readSkill` at the start of every session
> before writing, compiling, or uploading any code.

---

## Quick Reference: User Question → What to Call

| User asks… | Tool / endpoint |
|---|---|
| What board is connected? / What port? | `getState` tool **or** `GET /state` |
| Is a board detected / plugged in? | `detectBoards` tool **or** `GET /detect` |
| Compile this sketch | `compileSketch` tool |
| Upload to board | `uploadSketch` tool |
| Read serial output | `serialOpen` → `serialRead` → `serialClose` |
| What are the REST endpoints? | `GET /skill` or call `readSkill` |

**Never guess board or port values.** Always call `getState` first — it returns `fqbn` and `port` directly.

---

## Connection

- **MCP endpoint:** read port from `~/.grease/mcp-auth.json` → `port` field (default 3333, may differ)
- **Auth key:** `~/.grease/mcp-auth.json` → `key` field; auto-synced into IDE MCP configs on each server start
- **Health check (no auth):** `GET http://127.0.0.1:<port>/health`
- **First action every session:** select the **"Arduino Grease: Initialize Session"** MCP prompt from your IDE's prompt picker (any MCP-compatible IDE), or call the `readSkill` tool directly — both provide SKILL.md and current board state before any work begins.
- **SKILL.md:** auto-synced to `~/.grease/SKILL.md` on each server start; add project-specific content using the XML tags in the Customisation section below
- **IDE configs auto-updated on server start:** Claude Code, Claude Desktop, Cursor, Windsurf

### Reading the auth file (cross-OS)

```bash
# macOS / Linux
cat ~/.grease/mcp-auth.json
# → {"key":"<AUTH_KEY>","port":<PORT>,"updatedAt":"..."}

# Windows (PowerShell)
Get-Content "$env:USERPROFILE\.grease\mcp-auth.json" | ConvertFrom-Json
```

---

## REST API Quick Reference

All endpoints except `/health` require the header `x-grease-auth: <AUTH_KEY>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server liveness check — **no auth required** |
| GET | `/state` | Current target (port + fqbn), sketch path, serial status |
| GET | `/skill` | Plain-text SKILL.md content |
| GET | `/detect` | Detect connected boards (runs `arduino-cli board list`) |
| POST | `/target` | Set target: `{"port":"/dev/...","fqbn":"vendor:arch:board"}` |
| POST | `/serial/open` | Open serial: `{"path":"/dev/...","baudRate":9600}` |
| POST | `/serial/write` | Write to serial: `{"data":"hello\n"}` |
| POST | `/serial/read` | Read buffered lines (clears buffer) |
| POST | `/serial/close` | Close serial port |

### Typical agent REST workflow (no MCP negotiation needed)

```bash
AUTH="<key from ~/.grease/mcp-auth.json>"
PORT=$(cat ~/.grease/mcp-auth.json | python3 -c "import sys,json;print(json.load(sys.stdin)['port'])")
BASE="http://127.0.0.1:$PORT"

# 1. Check current target
curl -s $BASE/state -H "x-grease-auth: $AUTH"

# 2. Detect boards if target is not set
curl -s $BASE/detect -H "x-grease-auth: $AUTH"

# 3. Set target
curl -s -X POST $BASE/target -H "x-grease-auth: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"port":"/dev/cu.usbmodem11101","fqbn":"arduino:avr:uno"}'

# 4. Open serial
curl -s -X POST $BASE/serial/open -H "x-grease-auth: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"path":"/dev/cu.usbmodem11101","baudRate":9600}'

# 5. Read serial
curl -s -X POST $BASE/serial/read -H "x-grease-auth: $AUTH"

# 6. Close serial
curl -s -X POST $BASE/serial/close -H "x-grease-auth: $AUTH"
```

### Windows (PowerShell) equivalent

```powershell
$auth = (Get-Content "$env:USERPROFILE\.grease\mcp-auth.json" | ConvertFrom-Json)
$BASE = "http://127.0.0.1:$($auth.port)"
$H = @{ "x-grease-auth" = $auth.key; "Content-Type" = "application/json" }

# Check current target
Invoke-RestMethod $BASE/state -Headers $H

# Detect boards
Invoke-RestMethod $BASE/detect -Headers $H

# Set target
Invoke-RestMethod $BASE/target -Method Post -Headers $H `
  -Body '{"port":"COM3","fqbn":"arduino:avr:uno"}'
```

---

## Project Identity

- **Extension**: Arduino Grease (VS Code / Cursor / Windsurf)
- **MCP Server**: local Node.js process at `127.0.0.1:<PORT>`
- **Hardware target**: injected into the `readSkill` response as "Current Hardware Target"; also available via `GET /state` or `getState` mid-session
- **Higher goal**: Act as a bridge between the goals of the user and the Arduino micro-controller (robot). Use when the user interacts with any microcontroller, uploading sketches to the board and analyzing the data going both ways on Serial.

---

## Platform Notes

### Serial port naming by OS

| OS | Typical port format |
|----|---------------------|
| macOS | `/dev/cu.usbmodem*` or `/dev/cu.usbserial-*` |
| Linux | `/dev/ttyACM0`, `/dev/ttyUSB0`, `/dev/ttyS0` |
| Windows | `COM3`, `COM4`, … (check Device Manager) |

> Use `GET /detect` to get the exact port name — never guess.

### Linux first-time setup

On Linux, serial ports require the user to be in the `dialout` group. If serial open fails with "Permission denied":

```bash
sudo usermod -a -G dialout $USER
# Then log out and back in (or reboot)
```

### arduino-cli installation

Arduino Grease requires `arduino-cli` on your PATH.  
If board detection fails with "arduino-cli not found":

| OS | Install command |
|----|----------------|
| macOS | `brew install arduino-cli` |
| Linux | `curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \| sh` |
| Windows | `winget install ArduinoSA.ArduinoCLI` |

After installing, set the `ARDUINO_CLI_PATH` environment variable if the binary is not on PATH,
or restart your IDE so the updated PATH is inherited.

> **Arduino IDE 2.x** ships with its own arduino-cli. If you have Arduino IDE installed, set:
> - macOS: `ARDUINO_CLI_PATH=/Applications/Arduino IDE.app/Contents/Resources/app/node_modules/arduino-ide-extension/build/arduino-cli`
> - Check the actual path with: `find /Applications -name "arduino-cli" 2>/dev/null`

---

## Core Operating Rules

1. **Initialize the session first.** Use the **"Arduino Grease: Initialize Session"** MCP prompt (IDE prompt picker) or call `readSkill` directly. Both return SKILL.md content, server.mjs, and the current hardware target. Only call `detectBoards` (or `GET /detect`) if no board is reported.
2. **Never hard-code port or fqbn.** Use the values delivered by `readSkill` or `GET /state`. Call `GET /detect` only to recheck if the board may have changed.
3. **Compile before upload.** Call `compileSketch` and confirm success before calling `uploadSketch`.
4. **Use the Serial Monitor to verify behaviour.** After uploading, open serial (`serialOpen` or `POST /serial/open`) and read output (`serialRead` or `POST /serial/read`) to confirm the sketch is behaving as expected.
5. **Iterate incrementally.** Make one logical change at a time, compile, check output, then proceed. When possible, read the serial output to confirm the sketch is behaving as expected and propose changes based on that reading to the user.
6. **Do not block the Serial port unnecessarily.** Call `serialClose` (or `POST /serial/close`) when reading is complete.

---

## Code Style Preferences

- Use `millis()`-based non-blocking patterns — never `delay()` in loops.
- Default Serial baud rate is **9600** unless the user explicitly requests otherwise.
- For labelled Serial output, always separate the label string from the value: use `Serial.print("label: ")` followed by `Serial.println(val)`. Never concatenate them with `String()` — concatenation can confuse the Serial Plotter's series parser.
- Keep sketches modular: setup, loop, and named helper functions.
- Comment all non-obvious hardware interactions (pin assignments, timing rationale).
- Target C++11 idioms compatible with Arduino AVR/SAMD toolchains.
- If the user does not specify where to save the AI created sketch, save it in the root of the project as 'grease-X.ino', and remind the user of that sketch and its location. Where X is a number starting from 1, and incrementing for each new sketch.

---

## Typical Workflow

```
1. readSkill  (or GET /state)   ← always start here; response includes current port + fqbn if set
2. detectBoards (or GET /detect) ← find connected hardware (skip if readSkill already reported a valid port and fqbn)
3. [if port/fqbn missing] setTarget (or POST /target) ← configure the target
4. [edit sketch code]
5. compileSketch       ← verify it builds
6. uploadSketch  (or POST /uploadSketch)  ← flash to board; thrust animation fires automatically
7. serialOpen  (or POST /serial/open)  ← open serial at correct baud; thrust animation fires while port is open
8. serialRead  (or POST /serial/read)  ← observe behaviour
9. [iterate as needed]
10. serialClose (or POST /serial/close) ← tidy up; animation returns to idle
```

> **Upload & serial animation:** The `state=thrust` rain animation activates automatically
> whenever `POST /uploadSketch` is running or the serial port is open. No special steps needed —
> use the REST API or MCP tools as normal and the animation follows.

---

## Safety Constraints

- Never upload code that drives motors or servos without confirming safe range limits first.
- Never exceed the rated voltage/current of the target hardware.
- When in doubt, compile and read Serial output before any mechanical action.

---

## Customisation

Edit this file (`SKILL.md`) to add project-specific rules, pin maps, library preferences,
or domain knowledge for your particular robot. The AI agent will read it fresh every session.

Using XML to guide the agent:

<goal> goal </goal>. The goal XML will guide the agent to know the objective of that session. It will be a very short description of what needs to be accomplished.

<hw> hardware </hw>. The hardware XML will guide the agent to know what hardware is connected to the microcontroller. Sensors and motors , their pins, motor drivers in between, and everything that is related to hardware.

<mech> mechanical </mech>. The mechanical XML will guide the agent to know the mechanical structure of the robot. The radius  of the wheels, the distance between them, the height of the robot, lengths of links between joints, etc.

<control> control </control>. The control XML will guide the agent to know the control strategy of the robot. The PID gains, the control loops, the control strategy of the robot, or perhaps learning behaviours as well.
