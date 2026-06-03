#include <Arduino.h>
#include "tracker_module.h"
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include "time.h"

// Pin Setup 
#define SERVO_HOR 27
#define SERVO_VER 25
#define LDR_TL 32  // Left Top
#define LDR_TR 33  // Right Top
#define LDR_BL 34  // Left Bottom
#define LDR_BR 35  // Right Bottom

Servo servoHor, servoVer;
float posHor = 90, posVer = 90; // posisi awal servo

//  Parameter Tracking 
float tolerance = 5;
const int smoothCount = 5;
const int smoothDelay = 5;
int minH = 0, maxH = 180;
int minV = 10, maxV = 170;

// Arah servo
bool invertHor = true;
bool invertVer = true;

//Timer (pakai waktu nyata)
int lastSentMinute = -1;
unsigned long lastRealtimeSent = 0;

// Server endpoint 
String trackerServerUpdate = "http://192.168.1.8:3000/updateServo"; // kirim tiap 30 menit
String trackerServerLive   = "http://192.168.1.8:3000/live";        // realtime setiap 2 detik

// NTP / Zona waktu Samarinda (WITA) 
extern const char* ntpServer;          
extern const long gmtOffset_sec;
extern const int daylightOffset_sec;

// Kirim data ke server (non-blocking)
void kirimDataAsync(String url, int x, int y, int lt, int rt, int lb, int rb, const char* label = "") {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String json = "{\"servoX\":" + String(x) +
                ",\"servoY\":" + String(y) +
                ",\"ldr1\":" + String(lt) +
                ",\"ldr2\":" + String(rt) +
                ",\"ldr3\":" + String(lb) +
                ",\"ldr4\":" + String(rb) + "}";

  int httpCode = http.POST(json);
  delay(50);
  http.end();

  // Log dengan warna (Serial Monitor)
  if (httpCode > 0) {
    Serial.printf("\033[1;32m📤 Data %s terkirim ke %s (kode %d)\033[0m\n", label, url.c_str(), httpCode);
  } else {
    Serial.printf("\033[1;31m⚠️ Gagal kirim %s ke %s\033[0m\n", label, url.c_str());
  }
}

// Kirim tepat setiap menit 00 dan 30 WITA
void checkSendEvery30Minutes(int x, int y, int lt, int rt, int lb, int rb) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  int minute = timeinfo.tm_min;

  if ((minute == 0 || minute == 30) && minute != lastSentMinute) {
    Serial.printf("\033[1;36m📤 Kirim data PERIODIK (WITA) %02d:%02d\033[0m\n", timeinfo.tm_hour, timeinfo.tm_min);
    kirimDataAsync(trackerServerUpdate, x, y, lt, rt, lb, rb, "PERIODIK");
    lastSentMinute = minute;
  }

  if (minute != 0 && minute != 30) {
    lastSentMinute = -1;
  }
}

// Fungsi pembacaan LDR dengan smoothing
int smoothRead(int pin) {
  long total = 0;
  for (int i = 0; i < smoothCount; i++) {
    total += analogRead(pin);
    delay(smoothDelay);
  }
  return total / smoothCount;
}

// Fungsi ambang balik berdasarkan bulan
float getReverseThreshold(int month) {
  if (month >= 11 || month <= 2)       return 75.0; // Nov–Feb condong selatan
  else if (month >= 5 && month <= 8)   return 85.0; // Mei–Agu condong utara
  else                                 return 90.0; // Maret Lurus
}

// Setup awal tracker
void setupTracker() {
  servoHor.attach(SERVO_HOR);
  servoVer.attach(SERVO_VER);

  servoHor.write(posHor);
  servoVer.write(posVer);

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("\033[1;33m🌞 Tracker Siap (WiFi + NTP + Mode Bulanan)\033[0m");
}

// Loop utama tracking
void runTracker() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("⚠️ Gagal ambil waktu NTP!");
    return;
  }

  int hour = timeinfo.tm_hour;
  int minute = timeinfo.tm_min;
  int month = timeinfo.tm_mon + 1;

  float reverseThreshold = getReverseThreshold(month);
  float safeMargin = 10.0; // zona aman 10 derajat

  // aca sensor LDR 
  int lt = smoothRead(LDR_TL);
  int rt = smoothRead(LDR_TR);
  int lb = smoothRead(LDR_BL);
  int rb = smoothRead(LDR_BR);

  int rawMax = max(max(lt, rt), max(lb, rb));
  int rawMin = min(min(lt, rt), min(lb, rb));
  int spread = rawMax - rawMin;

  //  Mode malam / cahaya rata 
  if (hour >= 18 || hour < 7 || spread < 25) {
    Serial.println("🌙 Malam / Cahaya rata — Servo LOCK");
    checkSendEvery30Minutes(posHor, posVer, lt, rt, lb, rb);
    return;
  }

  //  Mode siang: 11.00–13.00 kunci horizontal 
  bool middayLock = (hour >= 11 && hour < 13);
  Serial.println(middayLock ? "🔒 Mode Siang: H Lock" : "⚡ Tracking Aktif");

  // Hitung rata-rata sisi LDR 
  float avgTop    = (lt + rt) / 2.0;
  float avgBottom = (lb + rb) / 2.0;
  float avgLeft   = (lt + lb) / 2.0;
  float avgRight  = (rt + rb) / 2.0;

  float diffHor = avgLeft - avgRight;
  float diffVer = avgTop - avgBottom;

  // Logika zona aman pembalikan arah 
  bool horActive = true;
  bool horReversed = false;

  if (posVer < reverseThreshold) {
    horActive = true;         
    horReversed = false;
  } 
  else if (posVer >= reverseThreshold && posVer < (reverseThreshold + safeMargin)) {
    horActive = false;        
  } 
  else if (posVer >= (reverseThreshold + safeMargin)) {
    horActive = true;         
    horReversed = true;
  }

  if (horReversed) diffHor = -diffHor;

  float step = 1.0;

  // Servo Horizontal 
  if (horActive && !middayLock && abs(diffHor) > tolerance) {
    posHor += (diffHor > 0 ?
              (invertHor ? step : -step) :
              (invertHor ? -step : step));
  }

  // Servo Vertikal 
  if (abs(diffVer) > tolerance) {
    posVer += (diffVer > 0 ?
              (invertVer ? -step : step) :
              (invertVer ? step : -step));
  }

  posHor = constrain(posHor, minH, maxH);
  posVer = constrain(posVer, minV, maxV);
  servoHor.write(posHor);
  servoVer.write(posVer);

  //  Kirim data ke server 
  checkSendEvery30Minutes(posHor, posVer, lt, rt, lb, rb);

  // Kirim realtime setiap 2 detik
  if (millis() - lastRealtimeSent >= 2000) {
    kirimDataAsync(trackerServerLive, posHor, posVer, lt, rt, lb, rb, "REALTIME");
    lastRealtimeSent = millis();
  }

  // Log status 
  Serial.printf(
      "🕒 %02d:%02d | BLN:%02d | RAW TL:%d TR:%d BL:%d BR:%d | spread:%d | "
      "H:%0.1f° V:%0.1f° | reverse@%.1f° | zone:(%.1f–%.1f)\n",
      hour, minute, month, lt, rt, lb, rb, spread, posHor, posVer,
      reverseThreshold, reverseThreshold, reverseThreshold + safeMargin);
}
