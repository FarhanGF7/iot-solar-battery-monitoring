const express = require('express');
const router = express.Router();

const {
  postData,
  getLatestData,
  getDailyEnergy,
  getDashboardMetrics,
  getCombinedData,
  getAllPanelBeban
} = require('../controllers/dataController');

// Session check moved to authRoutes.js

// === DATA (Panel & Beban) ===
router.post('/data', postData);
router.get('/data/latest', getLatestData);
router.get('/history', getDailyEnergy);
router.get('/data/combined', getCombinedData);
router.get('/data/full', getAllPanelBeban);


// === DASHBOARD ===
router.get('/dashboard/metrics', getDashboardMetrics);

// Authentication routes moved to authRoutes.js

module.exports = router;
