# arduino-cli Installation

## Install

| OS | Command |
|----|---------|
| macOS | `brew install arduino-cli` |
| Linux | `curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \| sh` |
| Windows | `winget install ArduinoSA.ArduinoCLI` |

After install, restart your IDE so the updated PATH is picked up.

## Arduino IDE 2.x bundled binary (macOS)

```bash
export ARDUINO_CLI_PATH="/Applications/Arduino IDE.app/Contents/Resources/app/node_modules/arduino-ide-extension/build/arduino-cli"
# Verify:
find /Applications -name "arduino-cli" 2>/dev/null
```

## Linux: serial port permissions

If `POST /serial/open` returns a permission-denied error:

```bash
sudo usermod -a -G dialout $USER
# Log out and back in — the group change only takes effect on a new session.
```

## Custom binary path

Set `ARDUINO_CLI_PATH` in your environment to point to any arduino-cli binary not on PATH. The Arduino Grease server reads this variable on startup.
