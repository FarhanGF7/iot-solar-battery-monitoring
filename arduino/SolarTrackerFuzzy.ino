#include <WiFi.h>
#include "tracker_module.h"
#include "power_module.h"

//Konfigurasi WiFi
const char* ssid = "FarhanHS";
const char* password = "Natural123";

// Konfigurasi Waktu (WITA - Samarinda)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 8 * 3600;   // UTC+8
const int daylightOffset_sec = 0;

// Fungsi Koneksi WiFi

void connectWiFi() {
  Serial.println("🔌 Menghubungkan WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  } 
  Serial.println("\n✅ WiFi Terhubung!");
  Serial.println(WiFi.localIP());
}

// Setup Utama

void setup() {
  Serial.begin(115200);
  connectWiFi();

  // Konfigurasikan waktu global untuk modul lain
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("🕒 NTP WITA tersinkron");

  // Inisialisasi modul
  setupTracker();
  setupPowerMonitor();

  Serial.println("✅ Semua modul siap berjalan");
}

// Loop Utama

void loop() {
  runTracker();
  runPowerMonitor();
}
