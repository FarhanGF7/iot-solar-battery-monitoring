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
Adafruit_INA219 ina219_panel(0x40);
Adafruit_INA219 ina219_baterai(0x41);

// =====================================================
//  Server endpoint
// =====================================================
String powerServer = "http://192.168.1.4:3000/api/data";
unsigned long lastSentTime = 0;
const unsigned long sendInterval = 300000; // 5 menit (300000 ms)

// =====================================================
//  Buffer rata-rata (Sampel diambil setiap 5 detik)
// =====================================================
unsigned long lastSample = 0;
const unsigned long sampleInterval = 5000; // 5 detik

float sumPanelV = 0, sumPanelC = 0, sumPanelP = 0;
float sumBateraiV = 0, sumBateraiC = 0, sumBateraiP = 0;
float sumSuhu = 0;

int sampleCount = 0;
float energyPanelWh = 0; // Akumulasi Energi Panel

// =====================================================
//  SETUP
// =====================================================
void setupPowerMonitor() {
  Wire.begin();
  Serial.println("\n=== ⚙️ Inisialisasi Power Monitor ===");

  ina219_panel.begin();
  ina219_baterai.begin();

  // === KALIBRASI (Untuk sensor INA219 max 32V, 2A) ===
  ina219_panel.setCalibration_32V_2A();   
  ina219_baterai.setCalibration_32V_2A();   
  
  sensors.begin(); // Mulai sensor suhu

  Serial.println("✅ INA219 PANEL, BATERAI, & SENSOR SUHU siap");

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
  float panelV = sumPanelV / sampleCount;
  float panelC = sumPanelC / sampleCount;
  float panelP = sumPanelP / sampleCount;

  float bateraiV = sumBateraiV / sampleCount;
  float bateraiC = sumBateraiC / sampleCount;
  float bateraiP = sumBateraiP / sampleCount;

  float rataSuhu = sumSuhu / sampleCount;

  // Reset semua buffer akumulasi ke 0 untuk siklus 5 menit berikutnya
  sumPanelV = sumPanelC = sumPanelP = 0;
  sumBateraiV = sumBateraiC = sumBateraiP = 0;
  sumSuhu = 0;
  sampleCount = 0;

  struct tm timeinfo;
  Serial.println("======================================");
  if (getLocalTime(&timeinfo)) {
    Serial.printf("🕒 %02d:%02d | DATA RATA-RATA 5 MENIT TERKIRIM\n",
                  timeinfo.tm_hour, timeinfo.tm_min);
  } else {
    Serial.println("🕒 ??:?? | DATA RATA-RATA 5 MENIT TERKIRIM");
  }
  Serial.printf("☀️ PANEL  : V=%.2f I=%.3f P=%.2f W\n",
                panelV, panelC, panelP);
  Serial.printf("🔋 ENERGI : %.2f Wh\n", energyPanelWh);
  Serial.printf("🔋 BATERAI : V=%.2f I=%.3f P=%.2f W\n",
                bateraiV, bateraiC, bateraiP);
  Serial.printf("🌡️ SUHU   : SUHU=%.2f °C\n",
                rataSuhu);
  Serial.println("======================================");

  // Menyusun format JSON untuk dikirim ke Node.js
  String jsonData = String("{\"panel\":{\"voltage\":") + panelV +
                    ",\"current\":" + panelC +
                    ",\"power\":" + panelP +
                    ",\"energy\":" + energyPanelWh +
                    "},\"baterai\":{\"voltage\":" + bateraiV +
                    ",\"current\":" + bateraiC +
                    ",\"power\":" + bateraiP + 
                    ",\"temperature\":" + rataSuhu + "}}";

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(powerServer);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(jsonData);
    if (httpResponseCode > 0) {
      Serial.printf("📤 Server MySQL Response Code: %d\n", httpResponseCode);
    } else {
      Serial.printf("⚠️ Gagal mengirim data baterai! Error: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  } else {
    Serial.println("❌ Gagal Kirim Data, WiFi Terputus!");
  }
}

// =====================================================
//  LOOP UTAMA
// =====================================================
void runPowerMonitor() {
  unsigned long now = millis();

  // Membaca sensor dan mengumpulkan sampel data setiap 5 detik
  if (now - lastSample >= sampleInterval) {
    lastSample = now;

    // ===== PEMBACAAN PANEL =====
    float busV   = ina219_panel.getBusVoltage_V();
    float shuntV = ina219_panel.getShuntVoltage_mV() / 1000.0;
    float panelV = busV + shuntV;
    float panelC = ina219_panel.getCurrent_mA() / 1000.0;

    // Proteksi nilai negatif agar data aman
    if (panelC < 0) panelC = 0;

    float panelP = panelV * panelC;

    // Hitung akumulasi energi panel (Wh)
    energyPanelWh += panelP * (sampleInterval / 3600000.0);

    // ===== PEMBACAAN BATERAI =====
    float bateraiV = ina219_baterai.getBusVoltage_V();
    float bateraiC = ina219_baterai.getCurrent_mA() / 1000.0;
    
    float bateraiP = bateraiV * bateraiC;

    // ===== PEMBACAAN SUHU =====
    sensors.requestTemperatures(); 
    float suhuAki = sensors.getTempCByIndex(0);
    // Jika sensor terputus, paksa ke 0 agar rata-rata tidak anjlok oleh nilai error -127
    if (suhuAki == DEVICE_DISCONNECTED_C) suhuAki = 0;

    // Timbun nilai instan sensor ke buffer untuk dirata-ratakan nanti
    sumPanelV += panelV;
    sumPanelC += panelC;
    sumPanelP += panelP;

    sumBateraiV += bateraiV;
    sumBateraiC += bateraiC;
    sumBateraiP += bateraiP;

    sumSuhu += suhuAki;
    sampleCount++;

    // Tampilkan log sampling setiap 5 detik di Serial Monitor
    Serial.printf("📥 PANEL V=%.2f I=%.3f P=%.2fW | BATERAI V=%.2f I=%.3f P=%.2fW | SUHU=%.2f°C\n",
                  panelV, panelC, panelP, bateraiV, bateraiC, bateraiP, suhuAki);
  }

  // ===== LOGIKA PENGIRIMAN DATA SETIAP 5 MENIT =====
  if (now - lastSentTime >= sendInterval) {
    kirimDataPLTS(); 
    lastSentTime = now; 
  }
}