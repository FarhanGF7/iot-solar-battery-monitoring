const express = require('express');
const router = express.Router();

const {
  postData,
  getLatestData,
  getRecentData,
  getDashboardMetrics,
  getCombinedData,
  getAllPanelBaterai
} = require('../controllers/dataController');
const {
  postSensorStatus,
  getSensorEvents
} = require('../controllers/sensorController');

// Session check moved to authRoutes.js

// === DATA (Baterai) ===
router.post('/data', postData);
router.get('/data/latest', getLatestData);
router.get('/data/recent', getRecentData);
router.get('/data/combined', getCombinedData);
router.get('/data/full', getAllPanelBaterai);

// === STATUS & RIWAYAT SENSOR ===
router.post('/sensor/status', postSensorStatus);
router.get('/sensor/events', getSensorEvents);


// === DASHBOARD ===
router.get('/dashboard/metrics', getDashboardMetrics);

// Authentication routes moved to authRoutes.js

module.exports = router;
