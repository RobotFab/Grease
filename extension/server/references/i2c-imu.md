# I2C / IMU Reference

## Correct Wire + LSM6 init pattern

```cpp
#include <Wire.h>
#include <LSM6.h>

LSM6 imu;

void setup() {
  Serial.begin(9600);
  Wire.begin();           // REQUIRED — must come before imu.init()
  if (!imu.init()) {
    Serial.println("IMU init failed");
    while (1);
  }
  imu.enableDefault();
  delay(15);              // wait one ODR period before first read
}

void loop() {
  static unsigned long lastRead = 0;
  if (millis() - lastRead >= 10) {   // 100 Hz max for LSM6
    lastRead = millis();
    imu.read();
    Serial.print("ax: "); Serial.print(imu.a.x);
    Serial.print(" ay: "); Serial.print(imu.a.y);
    Serial.print(" az: "); Serial.println(imu.a.z);
  }
}
```

## I2C bus recovery (AVR)

If the board goes silent with no serial output after IMU init, the I2C bus is likely stuck. Power-cycle the board. If it recurs:

1. Check that `Wire.begin()` is called before `imu.init()`.
2. Check SDA/SCL wiring and pull-up resistors (typically 4.7 kΩ to 3.3 V).
3. On ATmega32U4, a stuck `Wire` call hangs the CPU — there is no timeout by default.

## Multiple I2C devices

Always call `Wire.begin()` once in `setup()`, not before each device `init()`. Initialize devices in sequence; check each `init()` return value before proceeding to the next.
