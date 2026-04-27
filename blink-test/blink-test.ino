unsigned long previousMillis = 0;
const long interval = 500;
bool ledIsOn = false;

void setup() {
  // Initialize led object if necessary
}

void loop() {
  unsigned long currentMillis = millis();
  
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    
    if (ledIsOn) {
      led.turnoff();
    } else {
      led.turnon();
    }
    
    ledIsOn = !ledIsOn;
  }
}
