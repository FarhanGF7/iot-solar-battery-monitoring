#ifndef POWER_MODULE_H
#define POWER_MODULE_H

extern const char* ntpServer;
extern const long gmtOffset_sec;
extern const int daylightOffset_sec;

void setupPowerMonitor();
void runPowerMonitor();

#endif
