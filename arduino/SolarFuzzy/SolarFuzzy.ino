#include <WiFi.h>
#include "power_module.h"

// Konfigurasi WiFi
const char* ssid = "FarhanHS";
const char* password = "Natural123";

// Konfigurasi Waktu (WITA - Samarinda)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 8 * 3600; // UTC+8
const int daylightOffset_sec = 0;

// Fungsi penghubungan WiFi/Hotspot
void connectWiFi() {
  Serial.println("🔌 Menghubungkan WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  } 
  Serial.println("\n✅ WiFi Terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);
  
  // Hubungkan WiFi
  connectWiFi();

  // Sinkronisasi waktu NTP internet
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("🕒 Waktu NTP (WITA) tersinkronisasi");

  // Inisialisasi pembacaan sensor baterai (Tegangan, Arus, Suhu)
  setupPowerMonitor();

  Serial.println("🚀 Sistem Evaluasi Baterai Siap Beroperasi!");
}

void loop() {
  // Mengeksekusi pengiriman data Baterai (Tiap 5 Menit ke Database)
  runPowerMonitor();
}