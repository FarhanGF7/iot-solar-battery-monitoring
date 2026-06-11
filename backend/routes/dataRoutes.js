const express = require('express');
const router = express.Router();

const {
  postData,
  getLatestData,
  getDailyEnergy,
  getDashboardMetrics,
  getCombinedData,
  getAllPanelBaterai
} = require('../controllers/dataController');

// Session check moved to authRoutes.js

// === DATA (Panel & Baterai) ===
router.post('/data', postData);
router.get('/data/latest', getLatestData);
router.get('/history', getDailyEnergy);
router.get('/data/combined', getCombinedData);
router.get('/data/full', getAllPanelBaterai);


// === DASHBOARD ===
router.get('/dashboard/metrics', getDashboardMetrics);

// Authentication routes moved to authRoutes.js

module.exports = router;
