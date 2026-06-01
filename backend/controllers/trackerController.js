const db = require('../db');

// === Hubungkan Socket.IO dari server.js ===
let io = null;
exports.setSocket = (ioInstance) => {
  io = ioInstance;
};

// === Data realtime disimpan sementara di RAM ===
let latestServoData = {
  servoX: 0,
  servoY: 0,
  ldr1: 0,
  ldr2: 0,
  ldr3: 0,
  ldr4: 0,
  waktu: new Date().toISOString(),
  arah: "Utara"
};

// === Fungsi hitung arah ===
function hitungArah(servoX, servoY) {
  const condongBarat = servoY >= 90;   // 90–180 = BARAT
  const condongTimur = servoY < 90;    // 0–90 = TIMUR

  if (condongBarat) {
    if (servoX < 22) return "Utara";
    if (servoX < 67) return "Barat Laut";
    if (servoX < 112) return "Barat";
    if (servoX < 157) return "Barat Daya";
    return "Selatan";
  } else {
    if (servoX < 22) return "Selatan";
    if (servoX < 67) return "Tenggara";
    if (servoX < 112) return "Timur";
    if (servoX < 157) return "Timur Laut";
    return "Utara";
  }
}

// === Terima data dari ESP32 (POST /tracker/update) ===
exports.updateServo = async (req, res) => {
  try {
    const arah = hitungArah(req.body.servoX, req.body.servoY);

    latestServoData = {
      servoX: req.body.servoX || 0,
      servoY: req.body.servoY || 0,
      ldr1: req.body.ldr1 || 0,
      ldr2: req.body.ldr2 || 0,
      ldr3: req.body.ldr3 || 0,
      ldr4: req.body.ldr4 || 0,
      waktu: new Date().toISOString(),
      arah
    };

    console.log("📡 Data ESP32 diterima:", latestServoData);

    // Simpan ke database
    await exports.saveTrackerData(latestServoData);

    // === Kirim data ke semua klien via Socket.IO ===
    if (io) {
      io.emit("servoData", latestServoData);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Gagal memproses data ESP32:", error);
    res.sendStatus(500);
  }
};

// === Simpan ke database ===
exports.saveTrackerData = async (data) => {
  try {
    await db.query(
      `INSERT INTO tracker_log (servoX, servoY, ldr1, ldr2, ldr3, ldr4, arah)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.servoX, data.servoY, data.ldr1, data.ldr2, data.ldr3, data.ldr4, data.arah]
    ); 
  } catch (error) {
    console.error("❌ Gagal menyimpan data tracker:", error);
  }
};

// === Ambil data realtime (GET /tracker/latest) ===
exports.getLatest = (req, res) => {
  res.json(latestServoData);
};

// === Ambil riwayat (GET /tracker/history) ===
exports.getTrackerHistory = async (req, res) => {
  let sql = "SELECT * FROM tracker_log";
  let params = [];

  if (req.query.date) {
    sql += " WHERE DATE(created_at) = ?";
    params.push(req.query.date);
  }

  sql += " ORDER BY created_at DESC";

  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("❌ Gagal mengambil riwayat tracker:", error);
    res.sendStatus(500);
  }
};
// === Terima data realtime dari ESP32 (tanpa simpan DB) ===
exports.updateRealtime = (req, res) => {
  try {
    const dataRealtime = {
      servoX: req.body.servoX || 0,
      servoY: req.body.servoY || 0,
      ldr1: req.body.ldr1 || 0,
      ldr2: req.body.ldr2 || 0,
      ldr3: req.body.ldr3 || 0,
      ldr4: req.body.ldr4 || 0,
      waktu: new Date().toISOString(),
      arah: hitungArah(req.body.servoX, req.body.servoY)
    };

    if (io) io.emit('servoData', dataRealtime);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Gagal menerima data realtime:", error);
    res.sendStatus(500);
  }
};
exports.exportTrackerCSV = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tracker_log ORDER BY created_at ASC"
    );

    let csv = 'Waktu,Servo X,Servo Y,LDR1,LDR2,LDR3,LDR4,Arah\n';
    rows.forEach(r => {
      csv += `${r.created_at},${r.servoX},${r.servoY},${r.ldr1},${r.ldr2},${r.ldr3},${r.ldr4},${r.arah}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=tracker.csv"
    );
    res.send(csv);
  } catch (error) {
    console.error("❌ Gagal export CSV:", error);
    res.sendStatus(500);
  }
};

