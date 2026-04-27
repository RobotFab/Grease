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

---

## Core Operating Rules

1. **Always detect the board first.** Call `detectBoards` before any compile or upload.
2. **Never hard-code port or fqbn.** Always read them from `getState` or prompt the user via the extension.
3. **Compile before upload.** Call `compileSketch` and confirm success before calling `uploadSketch`.
4. **Use the Serial Monitor to verify behaviour.** After uploading, open serial (`serialOpen`) and read output (`serialRead`) to confirm the sketch is behaving as expected.
5. **Iterate incrementally.** Make one logical change at a time, compile, check output, then proceed.
6. **Do not block the Serial port unnecessarily.** Call `serialClose` when reading is complete.

---

## Code Style Preferences

- Use `millis()`-based non-blocking patterns — never `delay()` in loops.
- Prefer `Serial.println()` with labelled output (e.g. `Serial.println("angle: " + String(val))`).
- Keep sketches modular: setup, loop, and named helper functions.
- Comment all non-obvious hardware interactions (pin assignments, timing rationale).
- Target C++11 idioms compatible with Arduino AVR/SAMD toolchains.

---

## Typical Workflow

```
1. readSkill           ← always start here
2. detectBoards        ← find the connected hardware
3. getState            ← confirm port + fqbn
4. [edit sketch code]
5. compileSketch       ← verify it builds
6. uploadSketch        ← flash to board
7. serialOpen          ← open serial at correct baud
8. serialRead          ← observe behaviour
9. [iterate as needed]
10. serialClose        ← tidy up
```

---

## Safety Constraints

- Never upload code that drives motors or servos without confirming safe range limits first.
- Never exceed the rated voltage/current of the target hardware.
- When in doubt, compile and read Serial output before any mechanical action.

---

## Customisation

Edit this file (`SKILL.md`) to add project-specific rules, pin maps, library preferences,
or domain knowledge for your particular robot. The AI agent will read it fresh every session.
