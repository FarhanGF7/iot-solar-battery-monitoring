#ifndef TRACKER_MODULE_H
#define TRACKER_MODULE_H

extern const char* ntpServer;
extern const long gmtOffset_sec;
extern const int daylightOffset_sec;

void setupTracker();
void runTracker();

#endif
