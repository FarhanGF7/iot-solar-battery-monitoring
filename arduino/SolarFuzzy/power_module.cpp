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
bool ina219Connected = false;
bool ds18b20Connected = false;
bool ina219StatusInitialized = false;
bool ds18b20StatusInitialized = false;

const int sensorDebounceSamples = 3;
int ina219ValidCount = 0, ina219InvalidCount = 0;
int ds18b20ValidCount = 0, ds18b20InvalidCount = 0;

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

int powerSampleCount = 0;
int temperatureSampleCount = 0;

// =====================================================
//  EVENT STATUS SENSOR (langsung, terpisah dari data 5 menit)
// =====================================================
bool sendSensorStatusEvent(const char* sensorName, bool connected) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Event sensor belum terkirim: WiFi terputus");
    return false;
  }

  HTTPClient http;
  String sensorStatusServer = "http://192.168.137.1:3000/api/sensor/status";
  String jsonData = String("{\"sensor\":\"") + sensorName +
                    "\",\"connected\":" + (connected ? "true" : "false") + "}";

  http.begin(sensorStatusServer);
  http.addHeader("Content-Type", "application/json");
  int responseCode = http.POST(jsonData);
  http.end();

  if (responseCode >= 200 && responseCode < 300) {
    Serial.printf("📤 Event %s=%s terkirim\n",
                  sensorName, connected ? "TERSAMBUNG" : "TERPUTUS");
    return true;
  }

  Serial.printf("⚠️ Gagal mengirim event %s, HTTP=%d\n", sensorName, responseCode);
  return false;
}

void updateSensorConnection(bool readingValid,
                            const char* sensorName,
                            bool &confirmedConnected,
                            bool &statusInitialized,
                            int &validCount,
                            int &invalidCount) {
  if (readingValid) {
    validCount++;
    invalidCount = 0;

    if (validCount >= sensorDebounceSamples &&
        (!statusInitialized || !confirmedConnected)) {
      if (sendSensorStatusEvent(sensorName, true)) {
        confirmedConnected = true;
        statusInitialized = true;
      }
    }
  } else {
    invalidCount++;
    validCount = 0;

    if (invalidCount >= sensorDebounceSamples &&
        (!statusInitialized || confirmedConnected)) {
      if (sendSensorStatusEvent(sensorName, false)) {
        confirmedConnected = false;
        statusInitialized = true;
      }
    }
  }
}

// =====================================================
//  SETUP
// =====================================================
void setupPowerMonitor() {
  Wire.begin();
  Serial.println("\n=== ⚙️ Inisialisasi Power Monitor ===");

  ina219Connected = ina219_baterai.begin();

  // === KALIBRASI (Untuk sensor INA219 max 32V, 2A) ===
  ina219_baterai.setCalibration_32V_2A();   
  
  sensors.begin(); // Mulai sensor suhu
  ds18b20Connected = sensors.getDeviceCount() > 0;

  Serial.printf("%s INA219\n", ina219Connected ? "✅" : "❌");
  Serial.printf("%s DS18B20\n", ds18b20Connected ? "✅" : "❌");

  // Sinkronisasi Waktu NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("🌐 NTP tersinkron untuk modul daya");

  lastSentTime = millis(); // Inisialisasi waktu awal pengiriman
}

// =====================================================
//  KIRIM DATA RATA-RATA 5 MENIT
// =====================================================
void kirimDataPLTS() {
  if (powerSampleCount == 0 && temperatureSampleCount == 0) return;

  // Menghitung nilai rata-rata dari total sampel selama 5 menit
  float bateraiV = powerSampleCount > 0 ? sumBateraiV / powerSampleCount : 0;
  float bateraiC = powerSampleCount > 0 ? sumBateraiC / powerSampleCount : 0;
  float bateraiP = powerSampleCount > 0 ? sumBateraiP / powerSampleCount : 0;
  float rataSuhu = temperatureSampleCount > 0 ? sumSuhu / temperatureSampleCount : 0;

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
                    ",\"temperature\":" + rataSuhu +
                    ",\"sensor_status\":{\"ina219_connected\":" +
                    (ina219Connected ? "true" : "false") +
                    ",\"ds18b20_connected\":" +
                    (ds18b20Connected ? "true" : "false") + "}}}";

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
      powerSampleCount = 0;
      temperatureSampleCount = 0;
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
    bool ina219ReadingValid = isfinite(bateraiV) && isfinite(bateraiC) && bateraiV > 0;
    
    float bateraiP = bateraiV * bateraiC;

    // ===== PEMBACAAN SUHU =====
    sensors.requestTemperatures(); 
    float suhuAki = sensors.getTempCByIndex(0);
    bool ds18b20ReadingValid =
      suhuAki != DEVICE_DISCONNECTED_C && isfinite(suhuAki);

    updateSensorConnection(ina219ReadingValid, "INA219",
                           ina219Connected, ina219StatusInitialized,
                           ina219ValidCount, ina219InvalidCount);
    updateSensorConnection(ds18b20ReadingValid, "DS18B20",
                           ds18b20Connected, ds18b20StatusInitialized,
                           ds18b20ValidCount, ds18b20InvalidCount);

    // Nilai sensor yang gagal tidak dicampurkan ke rata-rata. Status koneksi
    // tetap dikirim ke backend agar kegagalan dibedakan dari kondisi baterai.
    if (ina219ReadingValid) {
      sumBateraiV += bateraiV;
      sumBateraiC += bateraiC;
      sumBateraiP += bateraiP;
      powerSampleCount++;
    }

    if (ds18b20ReadingValid) {
      sumSuhu += suhuAki;
      temperatureSampleCount++;
    }

    // Tampilkan log sampling setiap detik di Serial Monitor
    Serial.printf("📥 BATERAI V=%.2f I=%.3f P=%.2fW | SUHU=%.2f°C\n",
                  bateraiV, bateraiC, bateraiP, suhuAki);
    if (!ina219ReadingValid || !ds18b20ReadingValid) {
      Serial.printf("⚠️ SENSOR TERPUTUS | INA219=%s | DS18B20=%s\n",
                    ina219ReadingValid ? "OK" : "ERROR",
                    ds18b20ReadingValid ? "OK" : "ERROR");
    }
  }

  // ===== LOGIKA PENGIRIMAN DATA SETIAP 5 MENIT =====
  if (now - lastSentTime >= sendInterval) {
    kirimDataPLTS(); 
    lastSentTime = now; 
  }
}
