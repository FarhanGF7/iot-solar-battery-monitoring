const express = require('express');
const router = express.Router();
const tracker = require('../controllers/trackerController');

// ESP32 kirim data
router.post('/updateServo', tracker.updateServo);

// Ambil data historis
router.get('/history', tracker.getTrackerHistory);

// Export CSV
router.get('/export', tracker.exportTrackerCSV);

// Ambil data realtime
router.get('/latest', tracker.getLatest);

router.post('/live', tracker.updateRealtime);

module.exports = router;
