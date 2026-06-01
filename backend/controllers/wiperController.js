const db = require("../db");

/* =========================================
   POST DATA DARI ESP32
========================================= */
exports.insertWiperData = async (req, res) => {
  try {
    const { dust } = req.body;

    if (dust === undefined) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const sql = `
      INSERT INTO wiper_logs (dust_level)
      VALUES (?)
    `;
    await db.query(sql, [dust]);

    // Realtime update (opsional)
    const io = req.app.get("io");
    if (io) io.emit("wiper_update", { dust, time: new Date() });

    res.json({ message: "Data debu tersimpan" });

  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================================
   GET DATA UNTUK GRAFIK
========================================= */
exports.getWiperLogs = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM wiper_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json(rows);

  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ message: "Gagal ambil data" });
  }
};

/* =========================================
   DOWNLOAD CSV
========================================= */
exports.downloadWiperCSV = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT created_at, dust_level
      FROM wiper_logs
      ORDER BY created_at ASC
    `);

    let csv = "Waktu,Debu (mg/m3)\n";
    rows.forEach(row => {
      csv += `${row.created_at},${row.dust_level}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=wiper_logs.csv");
    res.send(csv);

  } catch (err) {
    console.error("CSV Error:", err);
    res.status(500).json({ message: "Gagal export CSV" });
  }
};
