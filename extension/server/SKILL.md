<!-- grease-skill-version: 8 -->
# Arduino Grease — Robot Skill

> **Read this first.**
> Every AI agent using Arduino Grease must read this file at the start of every session
> before writing, compiling, or uploading any code.
>
> **⛔ FORBIDDEN: Do NOT call `arduino-cli` directly for compile or upload — ever.**
> Compile and upload MUST go through the server REST endpoints `POST /compile` and `POST /upload`.
> This applies to all agents (Claude, Gemini, GPT, Cursor, Windsurf, or any other).
> No exceptions. Calling `arduino-cli` directly bypasses state tracking and breaks the UI.
>
> **⛔ FORBIDDEN: Do NOT call `POST /upload` without first calling `POST /compile`.**
> `arduino-cli upload` does NOT recompile the sketch — it flashes whatever binary is in the build cache.
> Skipping compile means the board gets the OLD firmware, not the new code. Always compile first.

---

## Quick Reference

| User asks… | MCP tool | REST equivalent |
|---|---|---|
| Read SKILL + board state | `readSkill` | `GET /skill` + `GET /state` |
| What board / port is set? | `getState` | `GET /state` |
| Is a board plugged in? | `detectBoards` | `GET /detect` |
| Set port + fqbn | `setTarget` | `POST /target` |
| Compile sketch | `compileSketch` | `POST /compile` |
| Upload sketch | `uploadSketch` | `POST /upload` |
| Open / read / close serial | `serialOpen` / `serialRead` / `serialClose` | `POST /serial/open` / `POST /serial/read` / `POST /serial/close` |

**Never guess or hard-code port or fqbn.** Always call `getState` (or `GET /state`) first. The server already knows the board and port from the extension — you only need to provide `sketchPath`.

---

## Connection

Read port and auth key from `~/.grease/mcp-auth.json`:

```bash
# macOS / Linux
cat ~/.grease/mcp-auth.json
# → {"key":"<AUTH_KEY>","port":<PORT>,"updatedAt":"..."}

# Windows (PowerShell)
Get-Content "$env:USERPROFILE\.grease\mcp-auth.json" | ConvertFrom-Json
```

All REST endpoints except `/health` require the header `x-grease-auth: <AUTH_KEY>`.

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server liveness — **no auth required** |
| GET | `/state` | Current target (port + fqbn), sketch path, serial status |
| GET | `/skill` | Plain-text SKILL.md content |
| GET | `/detect` | Detect connected boards (`arduino-cli board list`) |
| POST | `/target` | Set target: `{"port":"/dev/...","fqbn":"vendor:arch:board"}` |
| POST | `/compile` | Compile sketch: `{"sketchPath":"/path/to/sketch"}` — port/fqbn from server state |
| POST | `/upload` | Upload sketch: `{"sketchPath":"/path/to/sketch"}` — port/fqbn from server state |
| POST | `/serial/open` | Open serial: `{"path":"/dev/...","baudRate":9600}` |
| POST | `/serial/write` | Write to serial: `{"data":"hello\n"}` |
| POST | `/serial/read` | Read buffered lines (clears buffer) |
| POST | `/serial/close` | Close serial port |
| POST | `/thrust` | Activity indicator on (expires after 10 s; `/idle` clears early) |
| POST | `/idle` | Activity indicator off immediately |

> `POST /compile` and `POST /upload` drive the activity indicator automatically. You do not need to call `/thrust` or `/idle` around them.

---

## Typical Workflow

```
1. GET /skill       ← read this file + current port/fqbn in one call
2. GET /state       ← confirm port + fqbn; run GET /detect if missing
3. [write / edit sketch code]
4. POST /compile    ← {"sketchPath": "/path/to/sketch"}
5. POST /upload     ← {"sketchPath": "/path/to/sketch"}
6. POST /serial/open  ← {"path": "<port>", "baudRate": 9600}
7. POST /serial/read  ← observe behaviour
8. [iterate as needed]
9. POST /serial/close
```

---

## Core Operating Rules

1. **Initialize first.** Call `readSkill` (MCP) or `GET /skill` + `GET /state` (REST) at the start of every session.
2. **Never hard-code port or fqbn.** Read them from the server state.
3. **Compile before upload.** Confirm `/compile` succeeds before calling `/upload`.
4. **Verify over serial.** Open serial after every upload and read output before declaring success.
5. **Iterate incrementally.** One logical change → compile → check output → proceed.
6. **Close serial when done.** Call `/serial/close` as soon as reading is complete.

---

## Code Style

- Use `millis()`-based non-blocking patterns — never `delay()` in `loop()`.
- Default Serial baud rate: **9600** unless the user specifies otherwise.
- Labelled serial output: `Serial.print("label: ")` then `Serial.println(val)` — never `String()` concatenation (breaks the Serial Plotter parser).
- Keep sketches modular: `setup()`, `loop()`, named helper functions.
- Comment non-obvious hardware interactions (pin assignments, timing rationale).
- Target C++11 idioms compatible with Arduino AVR/SAMD toolchains.
- Default sketch location: `<project-root>/grease-X/grease-X.ino` (X = next available number). Remind the user of the path after creating it.

---

## I2C / IMU Rules — MANDATORY

Violating these silently hangs the board with no serial output and no error.

1. **Always call `Wire.begin()` before any sensor `init()`.**  
   No board library (including `Romi32U4.h`) guarantees Wire is ready for a third-party sensor.  
   Correct pattern (from the official Pololu LSM6 example):

   ```cpp
   #include <Wire.h>
   #include <LSM6.h>

   void setup() {
     Serial.begin(9600);
     Wire.begin();           // REQUIRED — must come before imu.init()
     if (!imu.init()) {
       Serial.println("IMU init failed");
       while (1);
     }
     imu.enableDefault();
   }
   ```

2. **Always check `init()` return value.** Silent failure → garbage reads → possible bus lock.

3. **Wait 15 ms after `enableDefault()` before the first `read()`.** The sensor needs one ODR period (~9.6 ms at 104 Hz) for a valid sample.

4. **Rate-limit `imu.read()`.** Never call it on every `loop()` iteration. Use a `millis()` interval — 10 ms (100 Hz) is the safe maximum for LSM6.

5. **Suspect I2C first.** On AVR (ATmega32U4), a stuck bus hangs `Wire` indefinitely with no output. If the board goes silent after upload, check I2C before anything else.

---

## Platform Notes

### Serial port names by OS

| OS | Format |
|----|--------|
| macOS | `/dev/cu.usbmodem*` or `/dev/cu.usbserial-*` |
| Linux | `/dev/ttyACM0`, `/dev/ttyUSB0` |
| Windows | `COM3`, `COM4`, … (check Device Manager) |

Always use `GET /detect` — never guess.

### Linux: serial permission

```bash
sudo usermod -a -G dialout $USER
# Log out and back in after running this
```

### arduino-cli installation

| OS | Command |
|----|---------|
| macOS | `brew install arduino-cli` |
| Linux | `curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \| sh` |
| Windows | `winget install ArduinoSA.ArduinoCLI` |

If the binary is not on PATH, set `ARDUINO_CLI_PATH` or restart your IDE.

> **Arduino IDE 2.x** bundles its own arduino-cli. On macOS:  
> `ARDUINO_CLI_PATH=/Applications/Arduino\ IDE.app/Contents/Resources/app/node_modules/arduino-ide-extension/build/arduino-cli`  
> Verify with: `find /Applications -name "arduino-cli" 2>/dev/null`

---

## Safety

- Never upload motor or servo code without confirming safe range limits first.
- Never exceed rated voltage/current of the target hardware.
- When in doubt, read serial output before any mechanical action.

---

## Customisation

Add project-specific rules, pin maps, or domain knowledge below using these XML tags:

```
<goal>    short description of the session objective            </goal>
<hw>      sensors, motors, pins, drivers                        </hw>
<mech>    wheel radius, link lengths, robot geometry            </mech>
<control> PID gains, control loops, learning behaviour          </control>
```
