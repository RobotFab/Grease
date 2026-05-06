#include <Romi32U4.h>

void setup() {
  // LED pins are initialized by the library functions
}

void loop() {
  // Turn all LEDs ON
  ledRed(true);
  ledYellow(true);
  ledGreen(true);
  delay(500);

  // Turn all LEDs OFF
  ledRed(false);
  ledYellow(false);
  ledGreen(false);
  delay(500);
}
