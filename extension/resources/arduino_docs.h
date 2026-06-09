// Arduino hover-documentation sidecar.
//
// Force-included by every `.clangd` that Arduino Grease drops next to a
// sketch. Provides:
//   1. Self-defined Arduino constants (HIGH/LOW, INPUT/OUTPUT, A0–A7, …)
//      guarded by #ifndef so the real values from <Arduino.h> win when an
//      installed core is on the include path.
//   2. Declarations of every Arduino built-in free function, each with a
//      Doxygen comment that clangd surfaces in the editor hover.
//   3. Stub C++ classes (Print/Stream/HardwareSerial/Serial) guarded by
//      #if !__has_include(<Arduino.h>) so Serial.begin / Serial.print /
//      Serial.println / etc. show hover docs even when NO board core is
//      installed. When a core IS present, the real class definitions from
//      <Arduino.h> are used and these stubs are skipped at preprocess time.
//
// Doxygen style: `@brief` and `@param` (rendered by clangd as Markdown).

#pragma once

#include <stdint.h>
#include <stddef.h>
#include <math.h>

#ifndef boolean
typedef bool boolean;
#endif

// ── Self-sufficient defaults ──────────────────────────────────────────────
// These let hover work even when Arduino.h isn't reachable on the include
// path (the common case for a loose .ino opened from an arbitrary folder —
// no compile_commands.json means clangd has no idea where Arduino.h lives).
// Each block is guarded with #ifndef so the real values from Arduino.h win
// whenever the core headers ARE on the path.

#ifndef HIGH
#define HIGH 0x1
#define LOW  0x0
#endif

#ifndef INPUT
#define INPUT        0x0
#define OUTPUT       0x1
#define INPUT_PULLUP 0x2
#endif

#ifndef LSBFIRST
#define LSBFIRST 0
#define MSBFIRST 1
#endif

#ifndef CHANGE
#define CHANGE  1
#define FALLING 2
#define RISING  3
#endif

#ifndef DEC
#define DEC 10
#define HEX 16
#define OCT  8
#define BIN  2
#endif

#ifndef A0
#define A0 14
#define A1 15
#define A2 16
#define A3 17
#define A4 18
#define A5 19
#define A6 20
#define A7 21
#endif

#ifndef LED_BUILTIN
#define LED_BUILTIN 13
#endif

#ifndef PI
/** @brief π (3.14159…). */
#define PI 3.1415926535897932384626433832795
/** @brief π / 2 (1.5707…). */
#define HALF_PI 1.5707963267948966192313216916398
/** @brief 2π (6.2831…). */
#define TWO_PI 6.283185307179586476925286766559
/** @brief Multiply degrees by this to convert to radians. */
#define DEG_TO_RAD 0.017453292519943295769236907684886
/** @brief Multiply radians by this to convert to degrees. */
#define RAD_TO_DEG 57.295779513082320876798154814105
/** @brief Euler's number e (2.71828…). */
#define EULER 2.718281828459045235360287471352
#endif

#ifndef round
/** @brief Round `x` to the nearest integer (returns `long`). */
#define round(x) ((x) >= 0 ? (long)((x) + 0.5) : (long)((x) - 0.5))
#endif

#ifndef radians
/** @brief Convert degrees to radians. Equivalent to `(deg) * DEG_TO_RAD`. */
#define radians(deg) ((deg) * DEG_TO_RAD)
#endif

#ifndef degrees
/** @brief Convert radians to degrees. Equivalent to `(rad) * RAD_TO_DEG`. */
#define degrees(rad) ((rad) * RAD_TO_DEG)
#endif

#ifndef bitToggle
/** @brief Toggle (flip) bit `b` of variable `x`. */
#define bitToggle(x, b) ((x) ^= (1UL << (b)))
#endif

// ── Free functions ────────────────────────────────────────────────────────
//
// These are declared at file scope (no `extern "C"`). The Arduino preprocessor
// auto-inserts `#include <Arduino.h>` before compile, and Arduino.h declares
// each of these at file scope too — so when a real core is on the include
// path, both declarations refer to the same symbol and clangd merges the
// comments. When no core is on the path, the declaration below is what
// clangd resolves and the comment is the hover content.

/**
 * @brief User-defined initialization function — runs once at power-on or reset.
 *
 * Put everything that only needs to happen once here: `pinMode()` calls,
 * `Serial.begin()`, sensor initialization, etc. Arduino calls `setup()`
 * automatically before the first call to `loop()`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/structure/sketch/setup/
 */
void setup(void);

/**
 * @brief User-defined main function — runs repeatedly after `setup()` returns.
 *
 * Arduino calls `loop()` over and over for the lifetime of the program.
 * Use `millis()`-based timing rather than `delay()` so the board stays
 * responsive to sensors and serial input between actions.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/structure/sketch/loop/
 */
void loop(void);

/**
 * @brief Configure a digital pin as input, output, or input with pull-up.
 *
 * Call from `setup()` before reading or writing the pin. `INPUT_PULLUP`
 * enables the chip's internal ~20–50 kΩ pull-up resistor, so the pin
 * reads `HIGH` when unconnected and `LOW` when an external switch ties
 * it to ground.
 *
 * @param pin   The pin number (e.g. `13`, `A0`).
 * @param mode  `INPUT`, `OUTPUT`, or `INPUT_PULLUP`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/digital-io/pinmode/
 */
void pinMode(uint8_t pin, uint8_t mode);

/**
 * @brief Write `HIGH` or `LOW` to a digital pin.
 *
 * If the pin is `OUTPUT`, drives it to the supply voltage (`HIGH`) or
 * ground (`LOW`). If the pin is `INPUT`, `HIGH` enables the internal
 * pull-up — prefer `pinMode(pin, INPUT_PULLUP)` for clarity.
 *
 * @param pin  The pin number.
 * @param val  `HIGH` (1) or `LOW` (0).
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalwrite/
 */
void digitalWrite(uint8_t pin, uint8_t val);

/**
 * @brief Read the digital level (`HIGH` or `LOW`) on a pin.
 *
 * @param pin  The pin number.
 * @return `HIGH` (1) or `LOW` (0).
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalread/
 */
int digitalRead(uint8_t pin);

/**
 * @brief Read the voltage on an analog input pin using the ADC.
 *
 * Converts the voltage at the pin (relative to the analog reference,
 * typically 5 V on classic AVR boards) into an integer. Resolution is
 * 10-bit (0–1023) on AVR, 12-bit (0–4095) on many newer boards unless
 * changed via `analogReadResolution()`.
 *
 * Each conversion takes ~100 µs.
 *
 * @param pin  An analog input pin (e.g. `A0`).
 * @return Integer 0..(2^resolution − 1) proportional to the input voltage.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/analog-io/analogread/
 */
int analogRead(uint8_t pin);

/**
 * @brief Configure the reference voltage used by `analogRead()`.
 *
 * @param mode  `DEFAULT`, `INTERNAL`, `INTERNAL1V1`, `INTERNAL2V56`, or
 *              `EXTERNAL`. Available options depend on the board.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/analog-io/analogreference/
 */
void analogReference(uint8_t mode);

/**
 * @brief Write an analog (PWM) value to a pin.
 *
 * Generates a square wave with the given duty cycle on a PWM-capable
 * pin (~490 Hz on most pins, ~980 Hz on pins 5/6 of an Uno). The pin
 * keeps generating the wave until the next `analogWrite()`,
 * `digitalWrite()`, or `digitalRead()` on it. `analogWrite()` does NOT
 * require `pinMode(OUTPUT)` first.
 *
 * On a DAC pin (e.g. `A0` on Due/Zero), produces a true analog voltage.
 *
 * @param pin  A PWM- or DAC-capable pin.
 * @param val  0 (always off) to 255 (always on) on 8-bit boards.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/analog-io/analogwrite/
 */
void analogWrite(uint8_t pin, int val);

/**
 * @brief Number of milliseconds since the program started.
 *
 * Wraps to zero after ~49.7 days. When comparing timestamps subtract
 * them — unsigned arithmetic handles the wrap correctly:
 * `if (millis() - last >= 1000) { ... }`.
 *
 * @return Unsigned `long` milliseconds.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/time/millis/
 */
unsigned long millis(void);

/**
 * @brief Number of microseconds since the program started.
 *
 * Resolution is 4 µs on 16 MHz AVRs, 8 µs on 8 MHz. Wraps to zero
 * after ~70 minutes.
 *
 * @return Unsigned `long` microseconds.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/time/micros/
 */
unsigned long micros(void);

/**
 * @brief Pause execution for the given number of milliseconds.
 *
 * Blocking — nothing else in the sketch runs (`loop`, sensors, etc.)
 * while `delay()` is waiting. Interrupts still fire. For non-blocking
 * timing use `millis()`.
 *
 * @param ms  Milliseconds to wait.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/time/delay/
 */
void delay(unsigned long ms);

/**
 * @brief Pause execution for the given number of microseconds.
 *
 * Accurate above ~3 µs. For waits over ~16 ms use `delay()` instead —
 * `delayMicroseconds()` is not reliable beyond that range.
 *
 * @param us  Microseconds to wait.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/time/delaymicroseconds/
 */
void delayMicroseconds(unsigned int us);

/**
 * @brief Measure the length of a `HIGH` or `LOW` pulse on a pin.
 *
 * Waits for the pin to reach `state`, starts timing, then waits for it
 * to reach the opposite state and stops timing. Returns 0 on timeout.
 *
 * Works on pulses from 10 µs to 3 minutes; accuracy degrades on longer
 * pulses — use `pulseInLong()` if interrupts are enabled and the
 * pulse is long.
 *
 * @param pin      The pin number.
 * @param state    `HIGH` or `LOW` — the level whose duration to measure.
 * @param timeout  Microseconds to wait for the pulse to start (default 1 s).
 * @return Pulse length in microseconds, or 0 on timeout.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/advanced-io/pulsein/
 */
unsigned long pulseIn(uint8_t pin, uint8_t state, unsigned long timeout);

/**
 * @brief Like `pulseIn()` but uses interrupts — more accurate on long
 *        pulses and slow signals. Don't use if interrupts are disabled.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/advanced-io/pulseinlong/
 */
unsigned long pulseInLong(uint8_t pin, uint8_t state, unsigned long timeout);

/**
 * @brief Shift one byte out, one bit at a time, on a data pin.
 *
 * Toggles the clock pin once per bit. Used with shift registers
 * (`74HC595`) and SPI-like protocols when hardware SPI isn't available.
 *
 * @param dataPin   Pin to write each bit on.
 * @param clockPin  Pin to pulse after each bit.
 * @param bitOrder  `LSBFIRST` or `MSBFIRST`.
 * @param val       The byte to shift out.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/advanced-io/shiftout/
 */
void shiftOut(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder, uint8_t val);

/**
 * @brief Shift one byte in, one bit at a time, from a data pin.
 *
 * @param dataPin   Pin to read each bit from.
 * @param clockPin  Pin to pulse before each read.
 * @param bitOrder  `LSBFIRST` or `MSBFIRST`.
 * @return The assembled byte.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/advanced-io/shiftin/
 */
uint8_t shiftIn(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder);

/**
 * @brief Run a function whenever a digital pin's level changes.
 *
 * The ISR runs asynchronously; keep it short. `millis()` does not
 * advance inside it, `delay()` doesn't work, and any variable shared
 * with `loop()` must be `volatile`. Use `digitalPinToInterrupt(pin)`
 * to translate a pin number to the right interrupt number.
 *
 * @param interruptNum  Interrupt index (use `digitalPinToInterrupt(pin)`).
 * @param userFunc      Handler. Must take no arguments and return `void`.
 * @param mode          `LOW`, `CHANGE`, `RISING`, or `FALLING`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/external-interrupts/attachinterrupt/
 */
void attachInterrupt(uint8_t interruptNum, void (*userFunc)(void), int mode);

/**
 * @brief Disable the handler previously attached with `attachInterrupt()`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/external-interrupts/detachinterrupt/
 */
void detachInterrupt(uint8_t interruptNum);

/**
 * @brief Re-enable interrupts after a `noInterrupts()` call.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/interrupts/interrupts/
 */
void interrupts(void);

/**
 * @brief Disable interrupts so critical timing-sensitive code can run
 *        without preemption. Pair with `interrupts()`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/interrupts/nointerrupts/
 */
void noInterrupts(void);

/**
 * @brief Generate a square wave at the given frequency on a pin.
 *
 * Uses one of the chip's hardware timers (interferes with `analogWrite()`
 * on pins 3 and 11 on AVR Unos). Only one `tone()` can be active at a time.
 *
 * @param _pin       Pin to drive (typically connected to a piezo speaker).
 * @param frequency  Frequency in Hz.
 * @param duration   Milliseconds to play, or 0 (default) to play until `noTone()`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/advanced-io/tone/
 */
void tone(uint8_t _pin, unsigned int frequency, unsigned long duration);

/**
 * @brief Stop the square wave started by `tone()` on the given pin.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/advanced-io/notone/
 */
void noTone(uint8_t _pin);

/**
 * @brief Linearly re-map a number from one range to another.
 *
 * Equivalent to `(value − fromLow) × (toHigh − toLow) / (fromHigh − fromLow) + toLow`.
 * Uses integer math (truncates fractions). Does NOT clamp — if `value`
 * is outside `[fromLow, fromHigh]`, the result is outside
 * `[toLow, toHigh]` too. Use `constrain()` afterwards if you need
 * clamping. `fromLow` may be larger than `fromHigh` — useful to invert
 * a range.
 *
 * @param value     The input number.
 * @param fromLow   Lower bound of the input range.
 * @param fromHigh  Upper bound of the input range.
 * @param toLow     Lower bound of the output range.
 * @param toHigh    Upper bound of the output range.
 * @return The re-mapped value.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/math/map/
 */
long map(long value, long fromLow, long fromHigh, long toLow, long toHigh);

/**
 * @brief Seed the pseudo-random generator used by `random()`.
 *
 * Always produces the same sequence from the same seed. To get a
 * different sequence each run, call `randomSeed(analogRead(A0))` on a
 * disconnected analog pin.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/random-numbers/randomseed/
 */
void randomSeed(unsigned long seed);

/**
 * @brief Return a pseudo-random long in `[0, max)`.
 *
 * @param max  Exclusive upper bound. Must be > 0.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/random-numbers/random/
 */
long random(long max);

/**
 * @brief Return a pseudo-random long in `[min, max)`.
 *
 * @param min  Inclusive lower bound.
 * @param max  Exclusive upper bound. Must be > `min`.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/random-numbers/random/
 */
long random(long min, long max);

// ── Math / bits / character helpers (Arduino reference) ───────────────────
// These are macros in real Arduino.h. Re-declaring as macros under #ifndef
// means hover shows our description when no core is on the path, and the
// real macro wins when a core is present.

#ifndef abs
/** @brief Absolute value of `x`. Avoid expressions with side effects. */
#define abs(x) ((x) > 0 ? (x) : -(x))
#endif

#ifndef constrain
/** @brief Clamp `amt` to the range `[low, high]`. */
#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))
#endif

#ifndef max
/** @brief Larger of `a` and `b`. */
#define max(a, b) ((a) > (b) ? (a) : (b))
#endif

#ifndef min
/** @brief Smaller of `a` and `b`. */
#define min(a, b) ((a) < (b) ? (a) : (b))
#endif

#ifndef sq
/** @brief `x` squared (`x * x`). Watch out for overflow. */
#define sq(x) ((x) * (x))
#endif

#ifndef bitRead
/** @brief Read bit `b` of value `x` (0-indexed, LSB first). */
#define bitRead(x, b) (((x) >> (b)) & 0x01)
#endif

#ifndef bitSet
/** @brief Set bit `b` of variable `x` to 1. */
#define bitSet(x, b) ((x) |= (1UL << (b)))
#endif

#ifndef bitClear
/** @brief Clear bit `b` of variable `x` to 0. */
#define bitClear(x, b) ((x) &= ~(1UL << (b)))
#endif

#ifndef bitWrite
/** @brief Write `v` (0 or 1) to bit `b` of variable `x`. */
#define bitWrite(x, b, v) ((v) ? bitSet(x, b) : bitClear(x, b))
#endif

#ifndef bit
/** @brief The value `2^b` (i.e. a mask with only bit `b` set). */
#define bit(b) (1UL << (b))
#endif

#ifndef lowByte
/** @brief Low-order (right-most) byte of `w`. */
#define lowByte(w) ((uint8_t)((w) & 0xff))
#endif

#ifndef highByte
/** @brief Next byte above the low-order byte of `w`. */
#define highByte(w) ((uint8_t)((w) >> 8))
#endif

// ── Math functions (from <math.h>, always available in Arduino) ───────────

/**
 * @brief Sine of `x` (x in radians).
 * @return Value in [-1, 1].
 * Reference: https://docs.arduino.cc/language-reference/en/functions/math/sin/
 */
double sin(double x);

/**
 * @brief Cosine of `x` (x in radians).
 * @return Value in [-1, 1].
 * Reference: https://docs.arduino.cc/language-reference/en/functions/math/cos/
 */
double cos(double x);

/**
 * @brief Tangent of `x` (x in radians).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/math/tan/
 */
double tan(double x);

/**
 * @brief Square root of `x`. Returns NaN for negative inputs.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/math/sqrt/
 */
double sqrt(double x);

/**
 * @brief `base` raised to the power `exponent`.
 *
 * @param base      The base value.
 * @param exponent  The exponent.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/math/pow/
 */
double pow(double base, double exponent);

/**
 * @brief Natural logarithm of `x` (log base e).
 * @return NaN for x ≤ 0.
 */
double log(double x);

/**
 * @brief e raised to the power `x` (inverse of `log()`).
 */
double exp(double x);

/**
 * @brief Absolute value of `x` as a floating-point number.
 *
 * Use this instead of `abs()` for `float`/`double` — `abs()` truncates to `int`.
 */
double fabs(double x);

/**
 * @brief Smallest integer value not less than `x` (round up).
 * @return Result as a `double`.
 */
double ceil(double x);

/**
 * @brief Largest integer value not greater than `x` (round down).
 * @return Result as a `double`.
 */
double floor(double x);

// ── Character classification (from WCharacter.h) ─────────────────────────
// These thin wrappers around <ctype.h> are always available in Arduino.
// Return boolean (true/false); accept any character as an int.

/**
 * @brief True if `c` is a letter (a–z or A–Z).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isalpha/
 */
boolean isAlpha(int c);

/**
 * @brief True if `c` is a letter or decimal digit.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isalphanumeric/
 */
boolean isAlphaNumeric(int c);

/**
 * @brief True if `c` is a 7-bit ASCII character (0–127).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isascii/
 */
boolean isAscii(int c);

/**
 * @brief True if `c` is a control character (ASCII 0–31 or 127).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/iscontrol/
 */
boolean isControl(int c);

/**
 * @brief True if `c` is a decimal digit (0–9).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isdigit/
 */
boolean isDigit(int c);

/**
 * @brief True if `c` has a graphical representation (printable and not space).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isgraph/
 */
boolean isGraph(int c);

/**
 * @brief True if `c` is a hexadecimal digit (0–9, a–f, or A–F).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/ishexadecimaldigit/
 */
boolean isHexadecimalDigit(int c);

/**
 * @brief True if `c` is a lower-case letter (a–z).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/islowercase/
 */
boolean isLowerCase(int c);

/**
 * @brief True if `c` is a printable character (including space).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isprintable/
 */
boolean isPrintable(int c);

/**
 * @brief True if `c` is a punctuation character.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/ispunct/
 */
boolean isPunct(int c);

/**
 * @brief True if `c` is a space, tab, newline, carriage return, form feed, or vertical tab.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isspace/
 */
boolean isSpace(int c);

/**
 * @brief True if `c` is an upper-case letter (A–Z).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/isuppercase/
 */
boolean isUpperCase(int c);

/**
 * @brief True if `c` is a whitespace character (space or horizontal tab).
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/iswhitespace/
 */
boolean isWhitespace(int c);

/**
 * @brief Convert `c` to its ASCII value (clears bit 7). No-op for 7-bit chars.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/toascii/
 */
int toAscii(int c);

/**
 * @brief Convert `c` to lower case. Non-letters are returned unchanged.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/tolowercase/
 */
int toLowerCase(int c);

/**
 * @brief Convert `c` to upper case. Non-letters are returned unchanged.
 * Reference: https://docs.arduino.cc/language-reference/en/functions/characters/touppercase/
 */
int toUpperCase(int c);

// ── Stub C++ classes for Serial / Stream / Print ──────────────────────────
//
// Only declared when no real <Arduino.h> is on the include path — i.e.
// when the user opens a loose .ino without a corresponding board core
// installed, or before they've selected a board. When Arduino.h IS
// reachable, the real class definitions there are used and these stubs
// are skipped, avoiding any ODR conflict.

#if defined(__cplusplus) && !__has_include(<Arduino.h>)

/**
 * @brief Base class for objects that can write bytes/text to an output
 *        (the `Serial` UART, `SoftwareSerial`, `Wire`, `EthernetClient`, etc).
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/print/
 */
class Print {
public:
  /**
   * @brief Send one raw byte to the stream.
   *
   * Sends the byte unchanged (no formatting) and returns the number of
   * bytes written (0 if the device couldn't accept it).
   */
  virtual size_t write(uint8_t) = 0;

  /**
   * @brief Write `size` raw bytes from `buffer` to the stream.
   * @return Number of bytes actually written.
   */
  size_t write(const uint8_t *buffer, size_t size);

  /**
   * @brief Write data to the stream as human-readable text.
   *
   * Numbers are converted to a decimal string by default; the second
   * argument selects a base — `DEC` (10), `HEX` (16), `OCT` (8), or
   * `BIN` (2). For floating-point values the second argument is the
   * number of digits after the decimal point (default 2). Strings,
   * `char`s, and `Printable` objects are written verbatim.
   *
   * @return Number of bytes sent.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/print/
   */
  size_t print(const char *);
  size_t print(char);
  size_t print(int, int = DEC);
  size_t print(unsigned int, int = DEC);
  size_t print(long, int = DEC);
  size_t print(unsigned long, int = DEC);
  size_t print(double, int = 2);

  /**
   * @brief Like `print()`, then send `"\r\n"` (carriage return + newline).
   *
   * Identical to `print()` but appends a newline. The no-argument form
   * sends just the newline.
   *
   * @return Number of bytes sent.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/println/
   */
  size_t println(const char *);
  size_t println(char);
  size_t println(int, int = DEC);
  size_t println(unsigned int, int = DEC);
  size_t println(long, int = DEC);
  size_t println(unsigned long, int = DEC);
  size_t println(double, int = 2);
  size_t println(void);

  /**
   * @brief Block until every buffered byte has been transmitted.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/flush/
   */
  virtual void flush();
};

/**
 * @brief Base class for objects with a read-able byte stream (the
 *        `Serial` UART, `EthernetClient`, `File`, etc).
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/stream/
 */
class Stream : public Print {
public:
  /**
   * @brief Number of bytes waiting in the stream's input buffer.
   *
   * Returns `0` if nothing has arrived yet. Use this to check whether
   * `read()` will return immediately. Example:
   * `if (Serial.available()) { ... }`.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/available/
   */
  virtual int available() = 0;

  /**
   * @brief Remove and return the next byte from the stream's input buffer.
   * @return Byte value (0–255), or `-1` if no data is available.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/read/
   */
  virtual int read() = 0;

  /**
   * @brief Look at the next byte without removing it from the input buffer.
   * @return Byte value (0–255), or `-1` if no data is available.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/peek/
   */
  virtual int peek() = 0;

  /**
   * @brief Read characters and parse them as a signed `long`.
   *
   * Skips leading non-digit characters, then reads digits until the
   * first non-digit. Returns `0` on timeout.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/parseint/
   */
  long parseInt();

  /**
   * @brief Read characters and parse them as a `float`.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/parsefloat/
   */
  float parseFloat();

  /**
   * @brief Read up to `length` bytes into `buffer`.
   *
   * Stops when the buffer is full or the read times out.
   *
   * @return Actual number of bytes placed in the buffer (0 if none).
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/readbytes/
   */
  size_t readBytes(char *buffer, size_t length);

  /**
   * @brief Set the maximum time (in ms) `parseInt`, `readBytes`, etc.
   *        will wait for data. Default is 1000 ms.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/settimeout/
   */
  void setTimeout(unsigned long timeout);
};

/**
 * @brief The hardware UART. Use the global `Serial` object to talk to
 *        the PC over the USB cable or to another microcontroller over
 *        TX/RX pins.
 *
 * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/
 */
class HardwareSerial : public Stream {
public:
  /**
   * @brief Start the UART at the given baud rate (8 data bits, no
   *        parity, 1 stop bit).
   *
   * Always call this from `setup()` before using `Serial`. Common rates
   * are `9600`, `19200`, `38400`, `57600`, `115200`. The other side
   * must match.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/begin/
   */
  void begin(unsigned long baud);

  /**
   * @brief Start the UART at the given baud rate with an explicit frame
   *        format (`SERIAL_8N1`, `SERIAL_8E1`, etc).
   */
  void begin(unsigned long baud, uint8_t config);

  /**
   * @brief Shut down the UART. Frees the pins for other use.
   *
   * Reference: https://docs.arduino.cc/language-reference/en/functions/communication/serial/end/
   */
  void end();

  // Inherited from Stream: available(), read(), peek(), parseInt(), …
  // Inherited from Print:  print(), println(), write(), flush()
  // Re-declared here so completion lists show them under `Serial.`
  virtual int available() override;
  virtual int read() override;
  virtual int peek() override;
  virtual size_t write(uint8_t) override;

  /**
   * @brief Truthy when the underlying port is open.
   *
   * On native-USB boards (Leonardo, Nano 33 IoT, …) this is `false`
   * until the host PC opens the serial monitor — useful as
   * `while (!Serial) { ; }` in `setup()` to wait for the connection.
   */
  explicit operator bool() const;
};

/** @brief The default hardware UART. Use this for `Serial.print()` etc. */
extern HardwareSerial Serial;

/**
 * @brief Controls a hobby servo motor. Supports standard servos (0–180°)
 *        and continuous-rotation servos.
 *
 * Each Servo object controls one servo. Up to 12 servos can be used on
 * most boards (disables PWM on pins 9 and 10 on AVR Uno/Nano).
 *
 * Reference: https://docs.arduino.cc/libraries/servo/
 */
class Servo {
public:
  /**
   * @brief Attach a servo to `pin`. Sets `pinMode` automatically.
   * @return Channel number, or 0 on failure.
   */
  uint8_t attach(int pin);

  /**
   * @brief Attach a servo to `pin` with custom pulse-width limits (µs).
   *
   * @param pin  PWM-capable output pin.
   * @param min  Pulse width (µs) for 0°. Default 544.
   * @param max  Pulse width (µs) for 180°. Default 2400.
   */
  uint8_t attach(int pin, int min, int max);

  /**
   * @brief Detach the servo from its pin. Stops pulses; pin becomes available.
   */
  void detach();

  /**
   * @brief Write a position (0–180°) or pulse width (≥ 200 µs) to the servo.
   *
   * Values < 200 are treated as degrees; values ≥ 200 as microseconds.
   *
   * @param value  Angle in degrees (0–180) or pulse width in microseconds.
   *
   * Reference: https://docs.arduino.cc/libraries/servo/#write
   */
  void write(int value);

  /**
   * @brief Write a pulse width directly in microseconds.
   *
   * Bypasses the degree mapping. Useful for fine control or continuous-rotation servos.
   *
   * @param value  Pulse width in microseconds (typically 1000–2000).
   *
   * Reference: https://docs.arduino.cc/libraries/servo/#writemicroseconds
   */
  void writeMicroseconds(int value);

  /**
   * @brief Read the last angle written (0–180°).
   * @return Degrees (0–180), or 90 if `writeMicroseconds()` was used.
   *
   * Reference: https://docs.arduino.cc/libraries/servo/#read
   */
  int read();

  /**
   * @brief Read the last pulse width written in microseconds.
   *
   * Reference: https://docs.arduino.cc/libraries/servo/#readmicroseconds
   */
  int readMicroseconds();

  /**
   * @brief True if this Servo is currently attached to a pin.
   *
   * Reference: https://docs.arduino.cc/libraries/servo/#attached
   */
  bool attached();
};

#endif // !__has_include(<Arduino.h>)
