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
//  Buffer rata-rata 30 menit
// =====================================================
unsigned long lastSample = 0;
const unsigned long sampleInterval = 5000; // 5 detik

float sumPanelV = 0, sumPanelC = 0, sumPanelP = 0;
float sumBebanV = 0, sumBebanC = 0, sumBebanP = 0;

float sumSuhu = 0;

int sampleCount = 0;

// =====================================================
//  (OPSIONAL) Energi Panel
// =====================================================
float energyPanelWh = 0;

// =====================================================
//  SETUP
// =====================================================
void setupPowerMonitor() {
  Wire.begin();
  Serial.println("\n=== ⚙️ Inisialisasi Power Monitor ===");

  ina219_panel.begin();
  ina219_beban.begin();

  // === KALIBRASI ===
  ina219_panel.setCalibration_32V_2A();   // PANEL (≤ 2A)
  ina219_beban.setCalibration_32V_2A();   // BEBAN
  sensors.begin(); // SUHU

  Serial.println("✅ INA219 PANEL, BEBAN, & SENSOR SUHU siap");

  // Waktu NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("🌐 NTP tersinkron");
}

// =====================================================
//  KIRIM DATA RATA-RATA 30 MENIT
// =====================================================
void kirimDataPLTS() {
  if (sampleCount == 0) return;

  float panelV = sumPanelV / sampleCount;
  float panelC = sumPanelC / sampleCount;
  float panelP = sumPanelP / sampleCount;

  float bebanV = sumBebanV / sampleCount;
  float bebanC = sumBebanC / sampleCount;
  float bebanP = sumBebanP / sampleCount;

  float rataSuhu = sumSuhu / sampleCount;

  sumPanelV = sumPanelC = sumPanelP = 0;
  sumBebanV = sumBebanC = sumBebanP = 0;
  sumSuhu = 0;
  sampleCount = 0;

  struct tm timeinfo;
  getLocalTime(&timeinfo);

  Serial.println("======================================");
  Serial.printf("🕒 %02d:%02d | RATA-RATA 30 MENIT\n",
                timeinfo.tm_hour, timeinfo.tm_min);
  Serial.printf("☀️ PANEL  : V=%.2f I=%.3f P=%.2f W\n",
                panelV, panelC, panelP);
  Serial.printf("🔋 ENERGI : %.2f Wh\n", energyPanelWh);
  Serial.printf("💡 BEBAN  : V=%.2f I=%.3f P=%.2f W\n",
                bebanV, bebanC, bebanP);
  Serial.printf("🌡️ SUHU   : SUHU=%.2f °C\n",
                rataSuhu)
  Serial.println("======================================");

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
    http.POST(jsonData);
    http.end();
  }
}

// =====================================================
//  LOOP UTAMA
// =====================================================
void runPowerMonitor() {
  unsigned long now = millis();

  if (now - lastSample >= sampleInterval) {
    lastSample = now;

    // ===== PANEL (PERBAIKAN UTAMA) =====
    float busV   = ina219_panel.getBusVoltage_V();
    float shuntV = ina219_panel.getShuntVoltage_mV() / 1000.0;
    float panelV = busV + shuntV;

    float panelC = ina219_panel.getCurrent_mA() / 1000.0;

    // Proteksi nilai tidak logis (panel 20 W)
    if (panelC < 0 || panelC > 2.0) panelC = 0;

    float panelP = panelV * panelC;

    // Hitung energi (Wh)
    energyPanelWh += panelP * (sampleInterval / 3600000.0);

    // ===== BEBAN =====
    float bebanV = ina219_beban.getBusVoltage_V();
    float bebanC = ina219_beban.getCurrent_mA() / 1000.0;
    float bebanP = bebanV * bebanC;

    // ===== SUHU =====
    sensors.requestTemperatures(); 
    float suhuAki = sensors.getTempCByIndex(0);
    // Jika sensor terputus, cegah agar rata-rata tidak rusak oleh nilai -127
    if (suhuAki == DEVICE_DISCONNECTED_C) suhuAki = 0;

    sumPanelV += panelV;
    sumPanelC += panelC;
    sumPanelP += panelP;

    sumBebanV += bebanV;
    sumBebanC += bebanC;
    sumBebanP += bebanP;

    sumSuhu += suhuAki;

    sampleCount++;

    Serial.printf("📥 PANEL V=%.2f I=%.3f P=%.2fW | BEBAN V=%.2f I=%.3f P=%.2fW\n | SUHU=%.2f°C\n",
                  panelV, panelC, panelP, bebanV, bebanC, bebanP, Suhu);
  }

  struct tm timeinfo;
  getLocalTime(&timeinfo);

  int minute = timeinfo.tm_min;
  if ((minute == 0 || minute == 30) && minute != lastMinuteSent) {
    kirimDataPLTS();
    lastMinuteSent = minute;
  }
  if (minute != 0 && minute != 30) lastMinuteSent = -1;
}
