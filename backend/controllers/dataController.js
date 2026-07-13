// controllers/dataController.js
function voltageToSoc(v) {
  if (v >= 12.80) return 100;
  if (v >= 12.70) return 90;
  if (v >= 12.60) return 80;
  if (v >= 12.50) return 70;
  if (v >= 12.42) return 60;
  if (v >= 12.32) return 50;
  if (v >= 12.20) return 40;
  if (v >= 12.06) return 30;
  if (v >= 11.90) return 20;
  if (v >= 11.80) return 10;
  return 0;
}
const db = require('../db').pool;

// 
// === MESIN FUZZY LOGIC ===
// 
function hitungFuzzyBaterai(v, i, t) {
    // Deklarasi variabel
    let v_rendah, v_normal, v_tinggi;
    let i_ringan, i_sedang, i_berat;
    let t_normal, t_hangat, t_panas;

    // ==========================================
    // 1. FUZZIFIKASI TEGANGAN (Voltage)
    // ==========================================
    // -- Himpunan Tegangan Rendah --
    if (v <= 11.5) {
        // Kondisi 1: Kurang dari atau sama dengan titik bawah (100% Rendah)
        v_rendah = 1;
    } else if (v >= 12.0) {
        // Kondisi 2: Lebih dari titik batas atas rendah (Sama sekali bukan Rendah)
        v_rendah = 0;
    } else {
        // Kondisi 3: Berangsur turun menjauhi rendah (menuju normal)
        // Perhitungan: (Batas Atas - Tegangan) / (Batas Atas - Batas Bawah)
        v_rendah = (12.0 - v) / (12.0 - 11.5);
    }

    // -- Himpunan Tegangan Normal --
    if (v <= 11.5 || v >= 14.0) {
        // Kondisi 1: Di luar batas normal (Sama sekali tidak normal)
        v_normal = 0;
    } else if (v > 11.5 && v <= 12.0) {
        // Kondisi 2: Berangsur naik menuju normal
        // Perhitungan: (Tegangan - Batas Bawah) / (Titik Puncak - Batas Bawah)
        v_normal = (v - 11.5) / (12.0 - 11.5);
    } else if (v >= 13.5 && v < 14.0) {
        // Kondisi 3: Berangsur turun menjauhi normal
        // Perhitungan: (Batas Atas - Tegangan) / (Batas Atas - Titik Turun)
        v_normal = (14.0 - v) / (14.0 - 13.5);
    } else {
        // Kondisi 4: Jika tidak masuk semua kondisi di atas (berarti v > 12.0 dan v < 13.5)
        // Titik ideal, 100% normal
        v_normal = 1;
    }

    // -- Himpunan Tegangan Tinggi --
    if (v <= 13.5) {
        // Kondisi 1: Kurang dari titik batas bawah tinggi (Sama sekali bukan Tinggi)
        v_tinggi = 0;
    } else if (v >= 14.0) {
        // Kondisi 2: Lebih dari atau sama dengan titik puncak tinggi (100% Tinggi)
        v_tinggi = 1;
    } else {
        // Kondisi 3: Berangsur naik menuju tinggi
        // Perhitungan: (Tegangan - Batas Bawah) / (Titik Puncak - Batas Bawah)
        v_tinggi = (v - 13.5) / (14.0 - 13.5);
    }


    // ==========================================
    // 2. FUZZIFIKASI ARUS (Current)
    // ==========================================
    // -- Himpunan Arus Ringan --
    if (i <= 2) {
        // Kondisi 1: Kurang dari atau sama dengan titik bawah (100% Ringan)
        i_ringan = 1;
    } else if (i >= 3) {
        // Kondisi 2: Lebih dari titik batas atas ringan (Sama sekali bukan Ringan)
        i_ringan = 0;
    } else {
        // Kondisi 3: Berangsur turun menjauhi ringan
        // Perhitungan: (Batas Atas - Arus) / (Batas Atas - Batas Bawah)
        i_ringan = (3 - i) / (3 - 2);
    }

    // -- Himpunan Arus Sedang --
    if (i <= 2 || i >= 6) {
        // Kondisi 1: Di luar batas sedang (Sama sekali tidak sedang)
        i_sedang = 0;
    } else if (i > 2 && i <= 3) {
        // Kondisi 2: Berangsur naik menuju sedang
        // Perhitungan: (Arus - Batas Bawah) / (Titik Puncak - Batas Bawah)
        i_sedang = (i - 2) / (3 - 2);
    } else if (i >= 5 && i < 6) {
        // Kondisi 3: Berangsur turun menjauhi sedang
        // Perhitungan: (Batas Atas - Arus) / (Batas Atas - Titik Turun)
        i_sedang = (6 - i) / (6 - 5);
    } else {
        // Kondisi 4: Jika tidak masuk semua kondisi di atas
        // Titik ideal, 100% sedang
        i_sedang = 1;
    }

    // -- Himpunan Arus Berat --
    if (i <= 5) {
        // Kondisi 1: Kurang dari titik batas bawah berat (Sama sekali bukan Berat)
        i_berat = 0;
    } else if (i >= 6) {
        // Kondisi 2: Lebih dari atau sama dengan titik puncak berat (100% Berat)
        i_berat = 1;
    } else {
        // Kondisi 3: Berangsur naik menuju berat
        // Perhitungan: (Arus - Batas Bawah) / (Titik Puncak - Batas Bawah)
        i_berat = (i - 5) / (6 - 5);
    }

    // ==========================================
    // 3. FUZZIFIKASI SUHU (Temperature)
    // ==========================================
    // -- Himpunan Suhu Normal --
    if (t <= 35) {
        // Kondisi 1: Kurang dari atau sama dengan titik bawah (100% Normal)
        t_normal = 1;
    } else if (t >= 40) {
        // Kondisi 2: Lebih dari titik batas atas normal (Sama sekali bukan Normal)
        t_normal = 0;
    } else {
        // Kondisi 3: Berangsur turun menjauhi normal
        // Perhitungan: (Batas Atas - Suhu) / (Batas Atas - Batas Bawah)
        t_normal = (40 - t) / (40 - 35);
    }

    // -- Himpunan Suhu Hangat --
    if (t <= 35 || t >= 50) {
        // Kondisi 1: Di luar batas hangat (Sama sekali tidak hangat)
        t_hangat = 0;
    } else if (t > 35 && t <= 40) {
        // Kondisi 2: Berangsur naik menuju hangat
        // Perhitungan: (Suhu - Batas Bawah) / (Titik Puncak - Batas Bawah)
        t_hangat = (t - 35) / (40 - 35);
    } else if (t >= 45 && t < 50) {
        // Kondisi 3: Berangsur turun menjauhi hangat
        // Perhitungan: (Batas Atas - Suhu) / (Batas Atas - Titik Turun)
        t_hangat = (50 - t) / (50 - 45);
    } else {
        // Kondisi 4: Jika tidak masuk semua kondisi di atas
        // Titik ideal, 100% hangat
        t_hangat = 1;
    }

    // -- Himpunan Suhu Panas --
    if (t <= 45) {
        // Kondisi 1: Kurang dari titik batas bawah panas (Sama sekali bukan Panas)
        t_panas = 0;
    } else if (t >= 50) {
        // Kondisi 2: Lebih dari atau sama dengan titik puncak panas (100% Panas)
        t_panas = 1;
    } else {
        // Kondisi 3: Berangsur naik menuju panas
        // Perhitungan: (Suhu - Batas Bawah) / (Titik Puncak - Batas Bawah)
        t_panas = (t - 45) / (50 - 45);
    }

    // Ternary Operator Version
    // 1. FUZZIFIKASI TEGANGAN (Voltage)
    // let v_rendah = (v <= 11.5) ? 1 : (v >= 12.0 ? 0 : (12.0 - v) / (12.0 - 11.5));
    // let v_normal = (v <= 11.5 || v >= 14.0) ? 0 : (v > 11.5 && v <= 12.0 ? (v - 11.5) / (12.0 - 11.5) : (v >= 13.5 && v < 14.0 ? (14.0 - v) / (14.0 - 13.5) : 1));
    // let v_tinggi = (v <= 13.5) ? 0 : (v >= 14.0 ? 1 : (v - 13.5) / (14.0 - 13.5));

    // 2. FUZZIFIKASI ARUS (Current)
    // let i_ringan = (i <= 2) ? 1 : (i >= 3 ? 0 : (3 - i) / (3 - 2));
    // let i_sedang = (i <= 2 || i >= 6) ? 0 : (i > 2 && i <= 3 ? (i - 2) / (3 - 2) : (i >= 5 && i < 6 ? (6 - i) / (6 - 5) : 1));
    // let i_berat  = (i <= 5) ? 0 : (i >= 6 ? 1 : (i - 5) / (6 - 5));

    // 3. FUZZIFIKASI SUHU (Temperature)
    // let t_normal = (t <= 35) ? 1 : (t >= 40 ? 0 : (40 - t) / (40 - 35));
    // let t_hangat = (t <= 35 || t >= 50) ? 0 : (t > 35 && t <= 40 ? (t - 35) / (40 - 35) : (t >= 45 && t < 50 ? (50 - t) / (50 - 45) : 1));
    // let t_panas  = (t <= 45) ? 0 : (t >= 50 ? 1 : (t - 45) / (50 - 45));
  
    // 4. EVALUASI ATURAN (Rule Base & Inferensi)
    let rules = [];

    // Nilai Konstanta Output
    const VAL_KRITIS = 25, VAL_WASPADA = 60, VAL_BAIK = 100;

    rules.push({ alpha: Math.min(v_normal, t_normal), z: VAL_BAIK }); // Rule 1: IF V Normal AND T Normal THEN Baik
    rules.push({ alpha: Math.min(v_tinggi, t_normal), z: VAL_BAIK }); // Rule 2: IF V Tinggi AND T Normal THEN Baik
    rules.push({ alpha: t_panas, z: VAL_KRITIS }); // Rule 3: IF T Panas THEN Kritis
    rules.push({ alpha: Math.min(v_rendah, i_berat), z: VAL_KRITIS }); // Rule 4: IF V Rendah AND I Berat THEN Kritis
    rules.push({ alpha: Math.min(v_rendah, t_hangat), z: VAL_WASPADA }); // Rule 5: IF V Rendah AND T Hangat THEN Waspada
    rules.push({ alpha: Math.min(v_normal, t_hangat), z: VAL_WASPADA }); // Rule 6: IF V Normal AND T Hangat THEN Waspada
    rules.push({ alpha: Math.min(v_tinggi, t_hangat), z: VAL_WASPADA }); // Rule 7: IF V Tinggi AND T Hangat THEN Waspada

    // 5. DEFUZZIFIKASI (Metode Weighted Average / Rata-rata Berbobot)
    let totalAlphaZ = 0, totalAlpha = 0;
    for (let j = 0; j < rules.length; j++) {
        totalAlphaZ += (rules[j].alpha * rules[j].z);
        totalAlpha += rules[j].alpha;
    }

    // Mencegah pembagian dengan 0 jika data error/di luar nalar
    let finalScore = (totalAlpha === 0) ? 0 : (totalAlphaZ / totalAlpha);
    
    // 6. PENENTUAN STATUS AKHIR BERDASARKAN SKOR
    let status = "Tidak Diketahui";
    
    if (finalScore >= 75) status = "Baik";
    else if (finalScore >= 45 && finalScore < 75) status = "Waspada";
    else status = "Kritis";

    return { score: parseFloat(finalScore.toFixed(2)), status: status };
}

// 
// === FUNGSI POST DATA ===
// 
const postData = (req, res) => {
  const { baterai } = req.body;

  if (!baterai) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  // Jalankan perhitungan Fuzzy Logic menggunakan data dari baterai
  // Beri nilai default 30 (suhu ruangan) jika sensor suhu sempat gagal terbaca
  const suhuBaterai = baterai.temperature || 30.0; 
  const hasilFuzzy = hitungFuzzyBaterai(baterai.voltage, baterai.current, suhuBaterai);

  // Perintah SQL untuk Baterai 
  const qBaterai = `INSERT INTO baterai (voltage, current, power, temperature) VALUES (?, ?, ?, ?)`;

  // Perintah SQL untuk Tabel Fuzzy
  const qFuzzy = `INSERT INTO fuzzy_baterai (baterai_id, fuzzy_score, fuzzy_status) VALUES (?, ?, ?)`;

  // Simpan data baterai beserta suhu
  db.query(qBaterai, [baterai.voltage, baterai.current, baterai.power, suhuBaterai], (err2, resultBaterai) => {
    if (err2) {
      console.error("Gagal simpan BATERAI:", err2);
      return res.status(500).json({ message: "Gagal simpan data baterai" });
    }

    const bateraiId = resultBaterai.insertId;

    // Simpan data fuzzy ke database
    db.query(qFuzzy, [bateraiId, hasilFuzzy.score, hasilFuzzy.status], (err3) => {
      if (err3) {
        console.error("Gagal simpan FUZZY:", err3);
        return res.status(500).json({ message: "Gagal simpan data fuzzy" });
      }

      // Emit data realtime via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.emit("latestData", {
          baterai: {
            voltage: parseFloat(baterai.voltage),
            current: parseFloat(baterai.current),
            power: parseFloat(baterai.power),
            temperature: parseFloat(suhuBaterai),
            fuzzy_score: parseFloat(hasilFuzzy.score),
            fuzzy_status: hasilFuzzy.status
          }
        });
      }

      res.json({ 
          message: "Data tersimpan & Dievaluasi!",
          fuzzy_status: hasilFuzzy.status,
          fuzzy_score: hasilFuzzy.score
      });
    });
  });
};

//
// === GET DATA TERBARU ===
//
const getLatestData = (req, res) => {
  const query = `
    SELECT 
      b.voltage AS baterai_voltage,
      b.current AS baterai_current,
      b.power AS baterai_power,
      b.temperature AS baterai_temperature,
      f.fuzzy_score,
      f.fuzzy_status
    FROM baterai b
    LEFT JOIN fuzzy_baterai f ON f.baterai_id = b.id
    ORDER BY b.id DESC
    LIMIT 1
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Gagal ambil data:", err);
      return res.status(500).json({ message: "Gagal ambil data" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Belum ada data" });
    }

    res.json({
      baterai: {
        voltage: results[0].baterai_voltage,
        current: results[0].baterai_current,
        power: results[0].baterai_power,
        temperature: results[0].baterai_temperature, // Suhu baterai
        fuzzy_score: results[0].fuzzy_score,       // Skor fuzzy (misal 85.5)
        fuzzy_status: results[0].fuzzy_status      // Status (Baik/Waspada/Kritis)
      }
    });
  });
};

//
// === GET HISTORY ENERGI ===
//
const getDailyEnergy = (req, res) => {
  const query = `
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
      ROUND(SUM(power * 1800 / 3600000), 4) AS energy_kWh
    FROM baterai
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 7
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Gagal ambil data energi:", err);
      return res.status(500).json({ message: "Gagal ambil data energi" });
    }
    res.json(results);
  });
};


//
// === DASHBOARD METRICS ===
//
const INTERVAL = 300;     // interval data 5 menit

const getDashboardMetrics = (req, res) => {
  const query = `
  SELECT 
    b.voltage AS batt_voltage,
    b.power AS power_load,
    (
      SELECT ROUND(SUM(power * ${INTERVAL} / 3600000), 4)
      FROM baterai 
      WHERE DATE(created_at) = CURDATE()
    ) AS energy_today,
    (
      SELECT ROUND(MAX(power), 2)
      FROM baterai
      WHERE DATE(created_at) = CURDATE()
    ) AS peak_power,
    ROUND(b.power, 2) AS avg_load
  FROM baterai b
  WHERE b.id = (SELECT MAX(id) FROM baterai)
  LIMIT 1
`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Gagal ambil metrik:", err);
      return res.status(500).json({ message: "Gagal ambil metrik" });
    }

    if (results.length === 0 || !results[0]) {
      return res.json({
        energy_today: 0,
        peak_power: 0,
        efficiency: "0.0",
        power_load: 0,
        avg_load: 0,
        battery_voltage: 12.0,
        battery_health: 50
      });
    }

    const row = results[0];

    // SOC baterai
    const battery_voltage = row.batt_voltage || 12.0;
    const battery_health = voltageToSoc(battery_voltage);

    // Efisiensi diset 0 karena data panel ditiadakan
    const efficiency = 0;

    res.json({
      energy_today: row.energy_today,
      peak_power: row.peak_power,
      efficiency: efficiency.toFixed(1),
      power_load: row.power_load,
      avg_load: row.avg_load,
      battery_voltage: battery_voltage,
      battery_health: battery_health
    });
  });
};

// Authentication functions (register, login, logout) moved to authController.js
const getCombinedData = (req, res) => {
  const date = req.query.date;

  let query = `
    SELECT 
      b.created_at AS timestamp,
      b.voltage AS baterai_voltage,
      b.current AS baterai_current,
      b.power AS baterai_power,
      b.temperature AS baterai_temperature, 
      f.fuzzy_score, 
      f.fuzzy_status 
    FROM baterai b
    LEFT JOIN fuzzy_baterai f ON f.baterai_id = b.id
  `;

  if (date) {
    query += ` WHERE DATE(b.created_at) = ? ORDER BY b.created_at ASC`;
  } else {
    query += ` ORDER BY b.created_at ASC`;
  }

  db.query(query, [date], (err, results) => {
    if (err) return res.status(500).json({ message: "Error ambil data" });
    res.json(results);
  });
};


const getAllPanelBaterai = (req, res) => {
  const q = `
    SELECT 
      b.created_at AS timestamp,
      b.voltage AS baterai_voltage,
      b.current AS baterai_current,
      b.power AS baterai_power,
      b.temperature AS baterai_temperature, 
      f.fuzzy_score, 
      f.fuzzy_status 
    FROM baterai b
    LEFT JOIN fuzzy_baterai f ON f.baterai_id = b.id
    ORDER BY b.created_at ASC
  `;

  db.query(q, (err, results) => {
    if (err) {
      console.error("Gagal ambil data baterai:", err);
      return res.status(500).json({ message: "Gagal ambil data" });
    }

    res.json(results);
  });
};


module.exports = {
  postData,
  getLatestData,
  getDailyEnergy,
  getDashboardMetrics,
  getCombinedData,
  getAllPanelBaterai
};
