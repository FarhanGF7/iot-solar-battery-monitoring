#include "power_module.h"
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"
#include <OneWire.h>
#include <DallasTemperature.h>

// === SENSOR SUHU ===
const int oneWireBus = 4; // Pin Data DS18B20 terhubung ke D4
OneWire oneWire(oneWireBus);
DallasTemperature sensors(&oneWire);
// ===================================

// =====================================================
//  Variabel waktu 
// =====================================================
extern const char* ntpServer;
extern const long gmtOffset_sec;
extern const int daylightOffset_sec;

// =====================================================
//  INA219
// =====================================================
Adafruit_INA219 ina219_baterai(0x41);

// =====================================================
//  Server endpoint
// ===================================================== 
String powerServer = "http://192.168.137.1:3000/api/data";
unsigned long lastSentTime = 0;
const unsigned long sendInterval = 300000; // 5 menit (300000 ms)

// =====================================================
//  Buffer rata-rata (Sampel diambil setiap 5 detik)
// =====================================================
unsigned long lastSample = 0;
const unsigned long sampleInterval = 5000; // 5 detik

float sumBateraiV = 0, sumBateraiC = 0, sumBateraiP = 0;
float sumSuhu = 0;

int sampleCount = 0;

// =====================================================
//  SETUP
// =====================================================
void setupPowerMonitor() {
  Wire.begin();
  Serial.println("\n=== ⚙️ Inisialisasi Power Monitor ===");

  ina219_baterai.begin();

  // === KALIBRASI (Untuk sensor INA219 max 32V, 2A) ===
  ina219_baterai.setCalibration_32V_2A();   
  
  sensors.begin(); // Mulai sensor suhu

  Serial.println("✅ INA219 BATERAI & SENSOR SUHU siap");

  // Sinkronisasi Waktu NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("🌐 NTP tersinkron untuk modul daya");

  lastSentTime = millis(); // Inisialisasi waktu awal pengiriman
}

// =====================================================
//  KIRIM DATA RATA-RATA 5 MENIT
// =====================================================
void kirimDataPLTS() {
  if (sampleCount == 0) return;

  // Menghitung nilai rata-rata dari total sampel selama 5 menit
  float bateraiV = sumBateraiV / sampleCount;
  float bateraiC = sumBateraiC / sampleCount;
  float bateraiP = sumBateraiP / sampleCount;
  float rataSuhu = sumSuhu / sampleCount;

  struct tm timeinfo;
  Serial.println("======================================");
  if (getLocalTime(&timeinfo)) {
    Serial.printf("🕒 %02d:%02d | DATA RATA-RATA 5 MENIT TERKIRIM\n",
                  timeinfo.tm_hour, timeinfo.tm_min);
  } else {
    Serial.println("🕒 ??:?? | DATA RATA-RATA 5 MENIT TERKIRIM");
  }
  Serial.printf("🔋 BATERAI : V=%.2f I=%.3f P=%.2f W\n",
                bateraiV, bateraiC, bateraiP);
  Serial.printf("🌡️ SUHU   : SUHU=%.2f °C\n",
                rataSuhu);
  Serial.println("======================================");

  // Menyusun format JSON untuk dikirim ke Node.js
  String jsonData = String("{\"baterai\":{\"voltage\":") + bateraiV +
                    ",\"current\":" + bateraiC +
                    ",\"power\":" + bateraiP + 
                    ",\"temperature\":" + rataSuhu + "}}";

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(powerServer);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(jsonData);
    if (httpResponseCode == 200) {
      Serial.printf("📤 Berhasil! Server Response: %d\n", httpResponseCode);
      
      // HANYA RESET JIKA DATA BERHASIL TERKIRIM
      sumBateraiV = 0;
      sumBateraiC = 0;
      sumBateraiP = 0;
      sumSuhu = 0;
      sampleCount = 0;
    } else {
      Serial.printf("⚠️ Gagal mengirim! Error: %s\n", http.errorToString(httpResponseCode).c_str());
      // Data tidak di-reset, akan diakumulasikan ke pengiriman 5 menit berikutnya
    }
    http.end();
  } else {
    Serial.println("❌ Gagal Kirim Data, WiFi Terputus! Data diamankan di memory.");
  }
}

// =====================================================
//  LOOP UTAMA
// =====================================================
void runPowerMonitor() {
  unsigned long now = millis();

  // Membaca sensor dan mengumpulkan sampel data setiap 1 detik
  if (now - lastSample >= sampleInterval) {
    lastSample = now;

    // ===== PEMBACAAN BATERAI =====
    float bateraiV = ina219_baterai.getBusVoltage_V();
    float bateraiC = ina219_baterai.getCurrent_mA() / 1000.0;
    
    float bateraiP = bateraiV * bateraiC;

    // ===== PEMBACAAN SUHU =====
    sensors.requestTemperatures(); 
    float suhuAki = sensors.getTempCByIndex(0);
    // Jika sensor terputus, paksa ke 0 agar rata-rata tidak anjlok oleh nilai error -127
    if (suhuAki == DEVICE_DISCONNECTED_C) suhuAki = 0;

    sumBateraiV += bateraiV;
    sumBateraiC += bateraiC;
    sumBateraiP += bateraiP;

    sumSuhu += suhuAki;
    sampleCount++;

    // Tampilkan log sampling setiap detik di Serial Monitor
    Serial.printf("📥 BATERAI V=%.2f I=%.3f P=%.2fW | SUHU=%.2f°C\n",
                  bateraiV, bateraiC, bateraiP, suhuAki);
  }

  // ===== LOGIKA PENGIRIMAN DATA SETIAP 5 MENIT =====
  if (now - lastSentTime >= sendInterval) {
    kirimDataPLTS(); 
    lastSentTime = now; 
  }
}