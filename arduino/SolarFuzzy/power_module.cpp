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
//  Variabel waktu dari file utama
// =====================================================
extern const char* ntpServer;
extern const long gmtOffset_sec;
extern const int daylightOffset_sec;

// =====================================================
//  INA219
// =====================================================
Adafruit_INA219 ina219_panel(0x40);
Adafruit_INA219 ina219_beban(0x41);

// =====================================================
//  Server endpoint
// =====================================================
String powerServer = "http://192.168.1.8:3000/api/data";
int lastMinuteSent = -1;

// =====================================================
//  Buffer rata-rata (Sampel diambil setiap 5 detik)
// =====================================================
unsigned long lastSample = 0;
const unsigned long sampleInterval = 5000; // 5 detik

float sumPanelV = 0, sumPanelC = 0, sumPanelP = 0;
float sumBebanV = 0, sumBebanC = 0, sumBebanP = 0;
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
  ina219_beban.begin();

  // === KALIBRASI (Untuk sensor INA219 max 32V, 2A) ===
  ina219_panel.setCalibration_32V_2A();   
  ina219_beban.setCalibration_32V_2A();   
  
  sensors.begin(); // Mulai sensor suhu

  Serial.println("✅ INA219 PANEL, BEBAN, & SENSOR SUHU siap");

  // Sinkronisasi Waktu NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("🌐 NTP tersinkron untuk modul daya");
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

  float bebanV = sumBebanV / sampleCount;
  float bebanC = sumBebanC / sampleCount;
  float bebanP = sumBebanP / sampleCount;

  float rataSuhu = sumSuhu / sampleCount;

  // Reset semua buffer akumulasi ke 0 untuk siklus 5 menit berikutnya
  sumPanelV = sumPanelC = sumPanelP = 0;
  sumBebanV = sumBebanC = sumBebanP = 0;
  sumSuhu = 0;
  sampleCount = 0;

  struct tm timeinfo;
  getLocalTime(&timeinfo);

  Serial.println("======================================");
  Serial.printf("🕒 %02d:%02d | DATA RATA-RATA 5 MENIT TERKIRIM\n",
                timeinfo.tm_hour, timeinfo.tm_min);
  Serial.printf("☀️ PANEL  : V=%.2f I=%.3f P=%.2f W\n",
                panelV, panelC, panelP);
  Serial.printf("🔋 ENERGI : %.2f Wh\n", energyPanelWh);
  Serial.printf("💡 BEBAN  : V=%.2f I=%.3f P=%.2f W\n",
                bebanV, bebanC, bebanP);
  Serial.printf("🌡️ SUHU   : SUHU=%.2f °C\n",
                rataSuhu);
  Serial.println("======================================");

  // Menyusun format JSON untuk dikirim ke Node.js
  String jsonData = String("{\"panel\":{\"voltage\":") + panelV +
                    ",\"current\":" + panelC +
                    ",\"power\":" + panelP +
                    ",\"energy\":" + energyPanelWh +
                    "},\"beban\":{\"voltage\":" + bebanV +
                    ",\"current\":" + bebanC +
                    ",\"power\":" + bebanP + 
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

    // ===== PEMBACAAN BEBAN (BATERAI) =====
    float bebanV = ina219_beban.getBusVoltage_V();
    float bebanC = ina219_beban.getCurrent_mA() / 1000.0;
    
    if (bebanC < 0) bebanC = 0;
    float bebanP = bebanV * bebanC;

    // ===== PEMBACAAN SUHU =====
    sensors.requestTemperatures(); 
    float suhuAki = sensors.getTempCByIndex(0);
    // Jika sensor terputus, paksa ke 0 agar rata-rata tidak anjlok oleh nilai error -127
    if (suhuAki == DEVICE_DISCONNECTED_C) suhuAki = 0;

    // Timbun nilai instan sensor ke buffer untuk dirata-ratakan nanti
    sumPanelV += panelV;
    sumPanelC += panelC;
    sumPanelP += panelP;

    sumBebanV += bebanV;
    sumBebanC += bebanC;
    sumBebanP += bebanP;

    sumSuhu += suhuAki;
    sampleCount++;

    // Tampilkan log sampling setiap 5 detik di Serial Monitor
    Serial.printf("📥 PANEL V=%.2f I=%.3f P=%.2fW | BEBAN V=%.2f I=%.3f P=%.2fW | SUHU=%.2f°C\n",
                  panelV, panelC, panelP, bebanV, bebanC, bebanP, suhuAki);
  }

  // ===== LOGIKA WAKTU REAL-TIME (PENGIRIMAN 5 MENIT) =====
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) { 
    int minute = timeinfo.tm_min;

    // Gerbang pengiriman terbuka otomatis di menit :00, :05, :10, :15, dst.
    if (minute % 5 == 0 && minute != lastMinuteSent) {
      kirimDataPLTS(); 
      lastMinuteSent = minute; 
    }

    // Membuka kembali kunci ketika menit sudah bergeser
    if (minute % 5 != 0) {
      lastMinuteSent = -1;
    }
  }
}