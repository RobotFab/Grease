---
name: arduino-grease
description: >
  Arduino Grease embedded-coding assistant. Use when writing, compiling, or
  uploading sketches for Arduino, ESP32, SAMD, RP2040, or any other
  arduino-cli-supported board. Covers serial monitoring, board core and
  library install, I2C/IMU wiring rules, and the Grease MCP/REST API.
compatibility: Requires VS Code/Cursor/Windsurf with Arduino Grease extension running and arduino-cli on PATH.
---
<!-- grease-skill-version: 9 -->
# Arduino Grease — Robot Skill

> **Read this first.**
> Every AI agent using Arduino Grease must read this file at the start of every session
> before writing, compiling, or uploading any code.
>
> **⛔ FORBIDDEN: Do NOT call `arduino-cli` directly for compile or upload — ever.**
> Use `POST /compile` and `POST /upload`. Calling `arduino-cli` directly bypasses
> state tracking and breaks the UI.
>
> **⛔ FORBIDDEN: Do NOT call `POST /upload` without first calling `POST /compile`.**
> Skipping compile flashes the OLD binary. Always compile first.

---

## Quick Reference

| User asks… | MCP tool | REST |
|---|---|---|
| Read SKILL + board state | `readSkill` | `GET /skill` + `GET /state` |
| What board / port is set? | `getState` | `GET /state` |
| Is a board plugged in? | `detectBoards` | `GET /detect` |
| Set port + fqbn | `setTarget` | `POST /target` |
| Compile sketch | `compileSketch` | `POST /compile {"sketchPath":"..."}` |
| Upload sketch | `uploadSketch` | `POST /upload {"sketchPath":"..."}` |
| Open serial | `serialOpen` | `POST /serial/open {"path":"...","baudRate":9600}` |
| Read serial | `serialRead` | `POST /serial/read` |
| Write serial | `serialWrite` | `POST /serial/write {"data":"..."}` |
| Close serial | `serialClose` | `POST /serial/close` |

**Never guess or hard-code port or fqbn.** Call `getState` first — the server already knows both from the extension.

All REST endpoints except `/health` require header `x-grease-auth: <AUTH_KEY>`.
Read key and port from `~/.grease/extension/mcp-auth.json`.

---

## Typical Workflow

```
1. GET /skill        ← read this file + current port/fqbn
2. GET /state        ← confirm port + fqbn; run GET /detect if missing
3. [write / edit sketch]
4. POST /compile     ← {"sketchPath": "/path/to/sketch"}
5. POST /upload      ← {"sketchPath": "/path/to/sketch"}
6. POST /serial/open ← {"path": "<port>", "baudRate": 9600}
7. POST /serial/read ← observe output
8. [iterate]
9. POST /serial/close
```

---

## Core Rules

1. **Initialize first.** Call `readSkill` / `GET /skill` + `GET /state` before any work.
2. **Never hard-code port or fqbn.** Always read from server state.
3. **Compile before upload.** Confirm `/compile` succeeds before `/upload`.
4. **Verify over serial.** Read serial output before declaring success.
5. **Iterate incrementally.** One change → compile → check output → proceed.
6. **Close serial when done.**

---

## Installing Cores and Libraries

When `POST /compile` fails with "platform not installed" or a missing-header error,
install the missing dependency. **Tell the user what you are installing before running.**

```bash
# Install a missing board core
arduino-cli core update-index
arduino-cli core install <vendor:arch>    # e.g. esp32:esp32

# Install a missing library
arduino-cli lib install "<Library Name>"  # exact Library Manager name
```

Common cores:

| Board family | Core package |
|---|---|
| Arduino AVR (Uno, Nano, Mega) | `arduino:avr` |
| Arduino SAMD (MKR, Nano 33 IoT) | `arduino:samd` |
| Arduino Mbed (Nano 33 BLE, Portenta) | `arduino:mbed` |
| ESP32 / ESP32-S3 / ESP32-C3 | `esp32:esp32` |
| Raspberry Pi Pico (RP2040) | `rp2040:rp2040` |
| Seeed XIAO SAMD | `Seeeduino:samd` |
| Seeed XIAO nRF52840 | `Seeeduino:nrf52` |

After installing, retry `POST /compile`.

---

## Code Style

- `millis()`-based non-blocking patterns — never `delay()` in `loop()`.
- Default Serial baud: **9600** unless user specifies otherwise.
- Labelled serial output: `Serial.print("label: "); Serial.println(val);` — never `String()` concatenation (breaks the Serial Plotter parser).
- Sketch structure: `setup()`, `loop()`, named helper functions.
- Comment non-obvious hardware interactions (pin assignments, timing rationale).
- Target C++11 idioms compatible with Arduino AVR/SAMD toolchains.
- Default sketch location: `<project-root>/grease-X/grease-X.ino` (X = next available number). The **folder name must match the `.ino` filename** — this is an arduino-cli requirement. Remind the user of the path after creating the sketch.

### Board-specific gotchas

- **SAMD / Nano 33 IoT / MKR**: Add `while (!Serial);` after `Serial.begin()` — USB CDC serial takes time to enumerate; without it, early prints are lost.
- **ESP32**: `Serial.begin(115200)` is idiomatic (not 9600). WiFi/BLE tasks run on core 0; put heavy work in `loop()` (core 1) or use `xTaskCreatePinnedToCore`.
- **RP2040 (arduino-pico)**: Second core uses `setup1()` / `loop1()` — not FreeRTOS tasks. Do not share `Serial` between cores without a mutex.
- **ATmega32U4 (Romi, Leonardo, Micro)**: USB CDC — add `while (!Serial);` or a timeout. `delay()` in `setup()` before `Serial.begin()` loses output.

---

## I2C / IMU Rules — MANDATORY

Violating these silently hangs the board with no serial output and no error.

1. **Call `Wire.begin()` before any sensor `init()`.** No board library guarantees Wire is ready for a third-party sensor.
2. **Check `init()` return value.** Silent failure → garbage reads → possible bus lock.
3. **Wait 15 ms after `enableDefault()` before the first `read()`.** The sensor needs one ODR period for a valid sample.
4. **Rate-limit `imu.read()` with `millis()`.** 10 ms minimum interval (100 Hz max for LSM6).
5. **If the board goes silent after upload, suspect I2C first.** On AVR (ATmega32U4), a stuck bus hangs `Wire` indefinitely with no output.

See [references/i2c-imu.md](references/i2c-imu.md) for wiring patterns and LSM6 example code.

---

## Platform Notes

### Serial port names by OS

| OS | Format |
|----|--------|
| macOS | `/dev/cu.usbmodem*` or `/dev/cu.usbserial-*` |
| Linux | `/dev/ttyACM0`, `/dev/ttyUSB0` |
| Windows | `COM3`, `COM4`, … |

Always use `GET /detect` — never guess. On Linux, add yourself to the dialout group if permission is denied: `sudo usermod -a -G dialout $USER` (log out and back in after).

If arduino-cli is not on PATH, see [references/setup.md](references/setup.md).

---

## Safety

- Never upload motor or servo code without confirming safe range limits first.
- Never exceed rated voltage/current of the target hardware.
- When in doubt, read serial output before any mechanical action.

---

## Customisation

Add project-specific rules, pin maps, or domain knowledge below:

```
<goal>    short description of the session objective            </goal>
<hw>      sensors, motors, pins, drivers                        </hw>
<mech>    wheel radius, link lengths, robot geometry            </mech>
<control> PID gains, control loops, learning behaviour          </control>
```
