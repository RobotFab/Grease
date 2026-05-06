#include <Wire.h>
#include <Romi32U4.h>
#include <LSM6.h>

LSM6 imu;

float roll = 0;
unsigned long last_ms = 0;
const float alpha = 0.98; // Filter coefficient

void setup() {
  Serial.begin(115200);
  Wire.begin();

  if (!imu.init()) {
    while (1) {
      Serial.println(F("Failed to detect LSM6 IMU"));
      delay(500);
    }
  }

  imu.enableDefault();
  
  // Set the gyro full scale to 1000 dps (35 mdps/LSB)
  imu.writeReg(LSM6::CTRL2_G, 0b10001000); 

  // Set the accelerometer full scale to 16 g (0.488 mg/LSB)
  imu.writeReg(LSM6::CTRL1_XL, 0b10000100);

  last_ms = millis();
  
  Serial.println("IMU initialized. Plotting Roll (Complementary Filter)...");
}

void loop() {
  imu.read();
  
  unsigned long now = millis();
  float dt = (now - last_ms) / 1000.0;
  last_ms = now;

  // 1. Calculate Roll from Accelerometer (using atan2)
  // Converting raw to g's (though atan2 doesn't strictly need it if scale is same)
  float ay = imu.a.y;
  float az = imu.a.z;
  float accel_roll = atan2(ay, az) * 180.0 / PI;

  // 2. Get Gyro rate for Roll (rotation about X-axis)
  // Conversion: 35 mdps/LSB = 0.035 dps/LSB
  float gyro_roll_rate = imu.g.x * 0.035;

  // 3. Apply Complementary Filter
  // Angle = alpha * (Angle + Gyro_Rate * dt) + (1 - alpha) * Accel_Angle
  roll = alpha * (roll + gyro_roll_rate * dt) + (1.0 - alpha) * accel_roll;

  // Output for Serial Plotter
  Serial.println(roll);

  delay(10); // ~100Hz update rate
}
