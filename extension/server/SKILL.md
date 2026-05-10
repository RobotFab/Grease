# Arduino Grease — Robot Skill

> **IMPORTANT — Read this first.**
> This file defines the skill, constraints, and operating preferences for this Arduino Grease project.
> Every AI agent using Arduino Grease **must** call `readSkill` at the start of every session
> before writing, compiling, or uploading any code.

---

## Project Identity

- **Extension**: Arduino Grease (VS Code / Cursor / Antigravity)
- **MCP Server**: local Node.js process at `127.0.0.1:PORT`
- **Hardware target**: defined in extension state (`getState` tool)
- **Higher goal**: Act as a bridge between the goals of the user and the Arduino micro-controller (robot). Use when the user interacts with any microcontroller, uploading sketches to the board and analyzing the data going both ways on Serial.

---

## Core Operating Rules

1. **Always detect the board first.** Call `detectBoards` before any compile or upload.
2. **Never hard-code port or fqbn.** Always read them from `getState` or prompt the user via the extension.
3. **Compile before upload.** Call `compileSketch` and confirm success before calling `uploadSketch`.
4. **Use the Serial Monitor to verify behaviour.** After uploading, open serial (`serialOpen`) and read output (`serialRead`) to confirm the sketch is behaving as expected.
5. **Iterate incrementally.** Make one logical change at a time, compile, check output, then proceed. When possible, read the serial output to confirm the sketch is behaving as expected and propose changes based on that reading to the user.
6. **Do not block the Serial port unnecessarily.** Call `serialClose` when reading is complete.

---

## Code Style Preferences

- Use `millis()`-based non-blocking patterns — never `delay()` in loops.
- Prefer `Serial.println()` with labelled output (e.g. `Serial.println("angle: " + String(val))`).
- Keep sketches modular: setup, loop, and named helper functions.
- Comment all non-obvious hardware interactions (pin assignments, timing rationale).
- Target C++11 idioms compatible with Arduino AVR/SAMD toolchains.
- If the user does not specify where to save the AI created sketch, save it in the root of the project as 'grease-X.ino', and remind the user of that sketch and its location. Where X is a number starting from 1, and incrementing for each new sketch.

---

## Typical Workflow

```
1. readSkill           ← always start here
2. detectBoards        ← find the connected hardware, and use PIN information from that microcontroller
3. getState            ← confirm port + fqbn
4. [edit sketch code]
5. compileSketch       ← verify it builds
6. uploadSketch        ← flash to board by pressing the ||Upload|| button (see Upload Animation below)
7. serialOpen          ← open serial at correct baud
8. serialRead          ← observe behaviour
9. [iterate as needed]
10. serialClose        ← tidy up
```

---

## Upload Animation — Simulating the ||Upload|| Button

The `||Upload||` button triggers the VS Code command `arduinoMcp.upload`, which compiles, flashes
the board, and plays the rain/thrust animation. Any VS Code-based IDE supports this
(VS Code, Cursor, Windsurf, Antigravity, etc.). To simulate it from the AI agent, follow these
two steps in order:

**Step 1 — Open the sketch as the active editor:**

Use the IDE's CLI to open the `.ino` file. Replace `<ide>` with the appropriate command
(`code`, `cursor`, `windsurf`, `antigravity`, etc.):
```bash
<ide> /path/to/sketch/sketch.ino
```
This is required because `getSketchFolder()` resolves the sketch from the active editor.
If no `.ino` file is open, the upload command silently fails.

**Step 2 — Trigger `arduinoMcp.upload` via the command palette:**

> **Key rule for all platforms:** The command palette shortcut (`Ctrl/Cmd+Shift+P`) already
> inserts the `>` prefix — do **not** add another `>` before `arduinoMcp.upload`.

**macOS:**
```bash
osascript <<'EOF'
tell application process "YOUR_IDE_PROCESS_NAME" of application "System Events" to set frontmost to true
delay 0.5
tell application "System Events"
  keystroke "p" using {command down, shift down}
  delay 0.6
  keystroke "arduinoMcp.upload"
  delay 0.5
  keystroke return
end tell
EOF
```
*Required permission:* System Settings → Privacy & Security → Automation → [your IDE] (allow Terminal/agent).

**Windows (PowerShell):**
```powershell
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("^+p")
Start-Sleep -Milliseconds 600
[System.Windows.Forms.SendKeys]::SendWait("arduinoMcp.upload")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
```
*Note:* Focus the IDE window before running this script.

**Linux (xdotool):**
```bash
xdotool search --name "YOUR_IDE_WINDOW_TITLE" windowactivate --sync
sleep 0.5
xdotool key ctrl+shift+p
sleep 0.6
xdotool type "arduinoMcp.upload"
sleep 0.5
xdotool key Return
```
*Install with:* `sudo apt install xdotool` (Debian/Ubuntu) or equivalent.

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
