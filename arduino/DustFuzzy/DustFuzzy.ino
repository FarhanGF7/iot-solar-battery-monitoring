#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

/* ===============================
   WIFI CONFIG
================================ */
const char* ssid = "HKMLYSF";
const char* password = "X=5131w7";

/* ===============================
   SERVER API
================================ */
const char* serverUrl = "http://192.168.1.4:3000/api/wiper";

/* ===============================
   PIN CONFIG
================================ */
#define DUST_LED_PIN   4
#define DUST_OUT_PIN   34

#define SERVO1_PIN     13
#define SERVO2_PIN     27

Servo servo1;
Servo servo2;

/* ===============================
   PARAMETER SISTEM
================================ */

// Ambang debu
float dustThreshold = 15.0;

// Sudut minimum
int minAngle = 0;

// Sudut maksimal masing-masing servo
int servo1MaxAngle = 50; // Servo 1 mulai dari 50°
int servo2MaxAngle = 45; // Servo 2 mulai dari 45°

bool isCleaning = false;

/* ===============================
   SETUP
================================ */
void setup() {

  Serial.begin(115200);

  // Sensor debu
  pinMode(DUST_LED_PIN, OUTPUT);
  digitalWrite(DUST_LED_PIN, HIGH);

  // Attach servo
  servo1.attach(SERVO1_PIN);
  servo2.attach(SERVO2_PIN);

  // Posisi awal servo
  servo1.write(servo1MaxAngle);
  servo2.write(servo2MaxAngle);

  delay(1000);

  // Connect WiFi
  connectWiFi();
}

/* ===============================
   LOOP UTAMA
================================ */
void loop() {

  // Baca debu
  float dust = readDust();

  Serial.printf("🌫 Debu: %.2f mg/m³\n", dust);

  // Kirim ke server
  sendToServer(dust);

  // ==================================
  // LOGIKA PEMBERSIHAN
  // ==================================
  if (!isCleaning) {

    // =========================
    // DEBU RENDAH
    // =========================
    if (dust < 20) {

    Serial.println("✅ Debu rendah → Wiper OFF");

  }

    // =========================
    // DEBU SEDANG
    // =========================
    else if (dust >= 20 && dust < 30) {

      isCleaning = true;

      Serial.println("⚠️ Debu sedang → Wiper 1x");

      runServo(servo1, 1);
      delay(300);

      runServo(servo2, 1);
      delay(300);

      Serial.println("✅ Pembersihan selesai");

      isCleaning = false;
    }

    // =========================
    // DEBU TINGGI
    // =========================
    else if (dust >= 30) {

      isCleaning = true;

      Serial.println("🚨 Debu tinggi → Wiper 6x");

      for (int i = 0; i < 6; i++) {

        Serial.printf("🔄 Siklus ke-%d\n", i + 1);

        runServo(servo1, 1);
        delay(200);

        runServo(servo2, 1);
        delay(200);
      }

      Serial.println("✅ Pembersihan berat selesai");

      isCleaning = false;
    }
  }

  // Delay pembacaan
  delay(5000);
}

/* ===============================
   CONNECT WIFI
================================ */
void connectWiFi() {

  WiFi.begin(ssid, password);

  Serial.print("🔌 Menghubungkan WiFi");

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Terhubung");

  Serial.print("📡 IP ESP32: ");
  Serial.println(WiFi.localIP());
}

/* ===============================
   SENSOR DEBU GP2Y1010
================================ */
float readDust() {

  digitalWrite(DUST_LED_PIN, LOW);
  delayMicroseconds(280);

  int adc = analogRead(DUST_OUT_PIN);

  delayMicroseconds(40);

  digitalWrite(DUST_LED_PIN, HIGH);

  delayMicroseconds(9680);

  // Konversi ADC ke tegangan
  float voltage = adc * (3.3 / 4095.0);

  // Konversi tegangan ke debu
  float dust = (voltage - 0.1) / 0.005;

  // Hindari nilai negatif
  if (dust < 0) {
    dust = 0;
  }

  return dust;
}

/* ===============================
   GERAK SERVO
================================ */
void runServo(Servo &servo, int id) {

  int maxAngle;

  // Servo 1 = 50°
  if (id == 1) {
    maxAngle = servo1MaxAngle;
  }

  // Servo 2 = 45°
  else {
    maxAngle = servo2MaxAngle;
  }

  // ==================================
  // GERAK TURUN
  // ==================================
  Serial.printf("🌀 Servo %d: %d° → 0°\n", id, maxAngle);

  for (int pos = maxAngle; pos >= minAngle; pos--) {

    servo.write(pos);
    delay(25);
  }

  delay(300);

  // ==================================
  // GERAK NAIK
  // ==================================
  Serial.printf("🌀 Servo %d: 0° → %d°\n", id, maxAngle);

  for (int pos = minAngle; pos <= maxAngle; pos++) {

    servo.write(pos);
    delay(25);
  }
}

/* ===============================
   KIRIM DATA KE SERVER
================================ */
void sendToServer(float dust) {

  // Pastikan WiFi tersambung
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;

  http.begin(serverUrl);

  http.addHeader("Content-Type", "application/json");

  // JSON payload
  String payload =
    "{\"dust\":" + String(dust, 2) + "}";

  // POST data
  int httpCode = http.POST(payload);

  Serial.printf(
    "📤 Kirim data debu: %.2f | HTTP %d\n",
    dust,
    httpCode
  );

  http.end();
}
