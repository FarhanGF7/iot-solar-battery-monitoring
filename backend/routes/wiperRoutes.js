const express = require("express");
const router = express.Router();

const wiperController = require("../controllers/wiperController");

// GET → ambil data grafik
router.get("/wiper", wiperController.getWiperLogs);

// POST → data dari ESP32
router.post("/wiper", wiperController.insertWiperData);

router.get("/wiper/csv", wiperController.downloadWiperCSV);

module.exports = router;
