#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

/* ===============================
   WIFI CONFIG
================================ */
const char* ssid = "FarhanHS";
const char* password = "Natural123";

/* ===============================
   SERVER API
================================ */
const char* serverUrl = "http://192.168.1.6:3000/api/wiper";

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

  // Alokasi timer PWM untuk ESP32 agar tidak konflik
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // Set frekuensi PWM ke 50Hz (standar servo)
  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);

  // Attach servo dengan range pulsa standard SG90 (500us - 2400us)
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);

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
  // LOGIKA PEMBERSIHAN (FUZZY LOGIC)
  // ==================================
  if (!isCleaning) {
    // Jalankan mesin fuzzy logic untuk menentukan jumlah siklus sapuan wiper
    int cycles = hitungFuzzyWiper(dust);

    if (cycles == 0) {
      Serial.println("✅ Status: Bersih/Debu Rendah → Wiper OFF");
    } 
    else {
      isCleaning = true;
      Serial.printf("🧹 Status: Debu Terdeteksi → Wiper Aktif (%d Siklus)\n", cycles);

      for (int i = 0; i < cycles; i++) {
        Serial.printf("🔄 Siklus ke-%d dari %d\n", i + 1, cycles);

        runServo(servo1, 1);
        delay(200);

        runServo(servo2, 2);
        delay(200);
      }

      Serial.println("✅ Pembersihan selesai");
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
   MESIN FUZZY LOGIC (Sugeno Orde-0)
================================ */
int hitungFuzzyWiper(float dust) {
  // 1. FUZZIFIKASI INPUT DEBU
  // Bersih: turun dari 1 (di <= 10) ke 0 (di >= 20)
  float mu_bersih = 0.0;
  if (dust <= 10.0) mu_bersih = 1.0;
  else if (dust > 10.0 && dust < 20.0) mu_bersih = (20.0 - dust) / (20.0 - 10.0);
  else mu_bersih = 0.0;

  // Sedang: naik dari 10 ke 20 (puncak=1), turun dari 20 ke 30
  float mu_sedang = 0.0;
  if (dust <= 10.0 || dust >= 30.0) mu_sedang = 0.0;
  else if (dust > 10.0 && dust <= 20.0) mu_sedang = (dust - 10.0) / (20.0 - 10.0);
  else if (dust > 20.0 && dust < 30.0) mu_sedang = (30.0 - dust) / (30.0 - 20.0);

  // Kotor: naik dari 20 ke 30 (puncak >= 30)
  float mu_kotor = 0.0;
  if (dust <= 20.0) mu_kotor = 0.0;
  else if (dust > 20.0 && dust < 30.0) mu_kotor = (dust - 20.0) / (30.0 - 20.0);
  else mu_kotor = 1.0;

  // Print derajat keanggotaan untuk debugging
  Serial.printf("📊 Fuzzifikasi -> Bersih: %.2f, Sedang: %.2f, Kotor: %.2f\n", mu_bersih, mu_sedang, mu_kotor);

  // 2. ATURAN DAN DEFUZZIFIKASI (Sugeno Orde-0)
  // Konstanta output (jumlah sapuan wiper)
  const float Z_BERSIH = 0.0;  // 0 sapuan
  const float Z_SEDANG = 1.0;  // 1 sapuan
  const float Z_KOTOR = 6.0;   // 6 sapuan

  // Evaluasi Aturan & Rata-rata Berbobot
  float totalAlphaZ = (mu_bersih * Z_BERSIH) + (mu_sedang * Z_SEDANG) + (mu_kotor * Z_KOTOR);
  float totalAlpha = mu_bersih + mu_sedang + mu_kotor;

  float outputFuzzy = 0.0;
  if (totalAlpha > 0.0) {
    outputFuzzy = totalAlphaZ / totalAlpha;
  }

  // Bulatkan hasil ke integer terdekat untuk jumlah siklus wiper
  int cycles = round(outputFuzzy);
  Serial.printf("🌀 Output Fuzzy (Kontinu): %.2f -> Dibulatkan: %d siklus\n", outputFuzzy, cycles);

  return cycles;
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
