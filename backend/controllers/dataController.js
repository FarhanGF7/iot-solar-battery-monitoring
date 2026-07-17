// controllers/dataController.js
const db = require('../db').pool;

// 
// === MESIN FUZZY LOGIC ===
// 
function hitungFuzzyBaterai(v, i, t) {
    // Deklarasi variabel derajat keanggotaan
    let v_rendah, v_normal, v_tinggi;
    let i_ringan, i_sedang, i_berat;
    let t_normal, t_hangat, t_panas;

// ==========================================
// 1. FUZZIFIKASI TEGANGAN (Voltage)
// ==========================================
// -- Himpunan Tegangan Rendah --
if (v <= 11.5) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Tegangan sepenuhnya termasuk kategori Rendah
    v_rendah = 1;
} else if (v >= 12.0) {
    // Kondisi 2: Lebih dari atau sama dengan titik batas atas
    // Tegangan sama sekali tidak termasuk kategori Rendah
    v_rendah = 0;
} else {
    // Kondisi 3: Berangsur turun menjauhi kategori Rendah
    // menuju kategori Normal
    // Perhitungan:
    // (Batas Atas - Tegangan) / (Batas Atas - Batas Bawah)
    v_rendah = (12.0 - v) / (12.0 - 11.5);
}

// -- Himpunan Tegangan Normal --
if (v <= 11.5 || v >= 14.0) {
    // Kondisi 1: Tegangan berada di luar batas kategori Normal
    // Tegangan sama sekali tidak termasuk kategori Normal
    v_normal = 0;
} else if (v > 11.5 && v <= 12.0) {
    // Kondisi 2: Berangsur naik menuju kategori Normal
    // Perhitungan:
    // (Tegangan - Batas Bawah) / (Titik Penuh - Batas Bawah)
    v_normal = (v - 11.5) / (12.0 - 11.5);
} else if (v >= 13.5 && v < 14.0) {
    // Kondisi 3: Berangsur turun menjauhi kategori Normal
    // menuju kategori Tinggi
    // Perhitungan:
    // (Batas Atas - Tegangan) / (Batas Atas - Titik Turun)
    v_normal = (14.0 - v) / (14.0 - 13.5);
} else {
    // Kondisi 4: Tegangan berada pada rentang 12.0–13.5 V
    // Tegangan sepenuhnya termasuk kategori Normal
    v_normal = 1;
}

// -- Himpunan Tegangan Tinggi --
if (v <= 13.5) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Tegangan sama sekali tidak termasuk kategori Tinggi
    v_tinggi = 0;

} else if (v >= 14.0) {
    // Kondisi 2: Lebih dari atau sama dengan batas keanggotaan penuh
    // Tegangan sepenuhnya termasuk kategori Tinggi
    v_tinggi = 1;

} else {
    // Kondisi 3: Berangsur naik menuju kategori Tinggi
    // Perhitungan:
    // (Tegangan - Batas Bawah) / (Batas Atas - Batas Bawah)
    v_tinggi = (v - 13.5) / (14.0 - 13.5);
}

// ==========================================
// 2. FUZZIFIKASI ARUS (Current)
// ==========================================
// -- Himpunan Arus Ringan --
if (i <= 2) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Arus sepenuhnya termasuk kategori Ringan
    i_ringan = 1;
} else if (i >= 3) {
    // Kondisi 2: Lebih dari atau sama dengan titik batas atas
    // Arus sama sekali tidak termasuk kategori Ringan
    i_ringan = 0;
} else {
    // Kondisi 3: Berangsur turun menjauhi kategori Ringan
    // menuju kategori Sedang
    // Perhitungan:
    // (Batas Atas - Arus) / (Batas Atas - Batas Bawah)
    i_ringan = (3 - i) / (3 - 2);
}

// -- Himpunan Arus Sedang --
if (i <= 2 || i >= 6) {
    // Kondisi 1: Arus berada di luar batas kategori Sedang
    // Arus sama sekali tidak termasuk kategori Sedang
    i_sedang = 0;
} else if (i > 2 && i <= 3) {
    // Kondisi 2: Berangsur naik menuju kategori Sedang
    // Perhitungan:
    // (Arus - Batas Bawah) / (Titik Penuh - Batas Bawah)
    i_sedang = (i - 2) / (3 - 2);
} else if (i >= 5 && i < 6) {
    // Kondisi 3: Berangsur turun menjauhi kategori Sedang
    // menuju kategori Berat
    // Perhitungan:
    // (Batas Atas - Arus) / (Batas Atas - Titik Turun)
    i_sedang = (6 - i) / (6 - 5);
} else {
    // Kondisi 4: Arus berada pada rentang 3.0–5.0 A
    // Arus sepenuhnya termasuk kategori Sedang
    i_sedang = 1;
}

// -- Himpunan Arus Berat --
if (i <= 5) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Arus sama sekali tidak termasuk kategori Berat
    i_berat = 0;

} else if (i >= 6) {
    // Kondisi 2: Lebih dari atau sama dengan batas keanggotaan penuh
    // Arus sepenuhnya termasuk kategori Berat
    i_berat = 1;

} else {
    // Kondisi 3: Berangsur naik menuju kategori Berat
    // Perhitungan:
    // (Arus - Batas Bawah) / (Batas Atas - Batas Bawah)
    i_berat = (i - 5) / (6 - 5);
}


// ==========================================
// 3. FUZZIFIKASI SUHU (Temperature)
// ==========================================
// -- Himpunan Suhu Normal --
if (t <= 35) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Suhu sepenuhnya termasuk kategori Normal
    t_normal = 1;

} else if (t >= 40) {
    // Kondisi 2: Lebih dari atau sama dengan titik batas atas
    // Suhu sama sekali tidak termasuk kategori Normal
    t_normal = 0;

} else {
    // Kondisi 3: Berangsur turun menjauhi kategori Normal
    // menuju kategori Hangat
    // Perhitungan:
    // (Batas Atas - Suhu) / (Batas Atas - Batas Bawah)
    t_normal = (40 - t) / (40 - 35);
}

// -- Himpunan Suhu Hangat --
if (t <= 35 || t >= 50) {
    // Kondisi 1: Suhu berada di luar batas kategori Hangat
    // Suhu sama sekali tidak termasuk kategori Hangat
    t_hangat = 0;

} else if (t > 35 && t < 40) {
    // Kondisi 2: Berangsur naik menuju kategori Hangat
    // Perhitungan:
    // (Suhu - Batas Bawah) / (Titik Penuh - Batas Bawah)
    t_hangat = (t - 35) / (40 - 35);

} else if (t > 45 && t < 50) {
    // Kondisi 3: Berangsur turun menjauhi kategori Hangat
    // menuju kategori Panas
    // Perhitungan:
    // (Batas Atas - Suhu) / (Batas Atas - Titik Turun)
    t_hangat = (50 - t) / (50 - 45);

} else {
    // Kondisi 4: Suhu berada pada rentang 40–45°C
    // Suhu sepenuhnya termasuk kategori Hangat
    t_hangat = 1;
}

// -- Himpunan Suhu Panas --
if (t <= 45) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Suhu sama sekali tidak termasuk kategori Panas
    t_panas = 0;

} else if (t >= 50) {
    // Kondisi 2: Lebih dari atau sama dengan batas keanggotaan penuh
    // Suhu sepenuhnya termasuk kategori Panas
    t_panas = 1;

} else {
    // Kondisi 3: Berangsur naik menuju kategori Panas
    // Perhitungan:
    // (Suhu - Batas Bawah) / (Batas Atas - Batas Bawah)
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

    // Suhu NORMAL
    rules.push({ alpha: Math.min(v_rendah, i_ringan, t_normal), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_rendah, i_sedang, t_normal), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_rendah, i_berat, t_normal), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_normal, i_ringan, t_normal), z: VAL_BAIK });
    rules.push({ alpha: Math.min(v_normal, i_sedang, t_normal), z: VAL_BAIK });
    rules.push({ alpha: Math.min(v_normal, i_berat, t_normal), z: VAL_BAIK });
    rules.push({ alpha: Math.min(v_tinggi, i_ringan, t_normal), z: VAL_BAIK });
    rules.push({ alpha: Math.min(v_tinggi, i_sedang, t_normal), z: VAL_BAIK });
    rules.push({ alpha: Math.min(v_tinggi, i_berat, t_normal), z: VAL_BAIK });
    // Suhu HANGAT
    rules.push({ alpha: Math.min(v_rendah, i_ringan, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_rendah, i_sedang, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_rendah, i_berat, t_hangat), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_normal, i_ringan, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_normal, i_sedang, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_normal, i_berat, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_tinggi, i_ringan, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_tinggi, i_sedang, t_hangat), z: VAL_WASPADA });
    rules.push({ alpha: Math.min(v_tinggi, i_berat, t_hangat), z: VAL_WASPADA });
    // Suhu PANAS (override)
    rules.push({ alpha: Math.min(v_rendah, i_ringan, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_rendah, i_sedang, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_rendah, i_berat, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_normal, i_ringan, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_normal, i_sedang, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_normal, i_berat, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_tinggi, i_ringan, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_tinggi, i_sedang, t_panas), z: VAL_KRITIS });
    rules.push({ alpha: Math.min(v_tinggi, i_berat, t_panas), z: VAL_KRITIS });

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

  const voltage = parseFloat(baterai.voltage) || 0;
  const current = parseFloat(baterai.current) || 0;
  const power = parseFloat(baterai.power) || 0;
  const temperature = parseFloat(baterai.temperature) || 0;

  // Jalankan perhitungan Fuzzy Logic menggunakan data dari baterai
  let hasilFuzzy;
  
  // Pengaman sisi server: Jika tegangan 0 (baterai putus/sensor error) 
  // ATAU suhu bernilai 0 / kurang dari -100 (sensor DS18B20 putus),
  // paksa status menjadi Kritis agar tidak menghasilkan status "Baik".
  if (voltage === 0 || temperature === 0 || temperature <= -100) {
    hasilFuzzy = { score: 25.00, status: "Kritis" };

    // Emit sinyal error real-time ke web
    const io = req.app.get("io");
    if (io) {
      let sensorName = "SEMUA";
      let errorMsg = "Semua sensor gagal membaca data.";
      if (voltage === 0 && (temperature === 0 || temperature <= -100)) {
        sensorName = "SEMUA";
        errorMsg = "Semua sensor (INA219 + DS18B20) gagal membaca data.";
      } else if (voltage === 0) {
        sensorName = "INA219";
        errorMsg = "Sensor daya/baterai terputus atau tidak terbaca.";
      } else {
        sensorName = "DS18B20";
        errorMsg = "Sensor suhu terputus atau tidak terbaca.";
      }

      io.emit("sensorError", {
        sensor: sensorName,
        status: "TERPUTUS",
        message: errorMsg,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    hasilFuzzy = hitungFuzzyBaterai(voltage, current, temperature);
  }

  // Perintah SQL untuk Baterai 
  const qBaterai = `INSERT INTO baterai (voltage, current, power, temperature) VALUES (?, ?, ?, ?)`;

  // Perintah SQL untuk Tabel Fuzzy
  const qFuzzy = `INSERT INTO fuzzy_baterai (baterai_id, fuzzy_score, fuzzy_status) VALUES (?, ?, ?)`;

  // Simpan data baterai beserta suhu
  db.query(qBaterai, [voltage, current, power, temperature], (err2, resultBaterai) => {
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

      // Cetak notifikasi penerimaan data di terminal Node.js
      console.log(`📥 [ESP32 - Baterai] Diterima: ${voltage}V | ${current}A | ${power}W | Suhu: ${temperature}°C -> Status Fuzzy: ${hasilFuzzy.status} (Skor: ${hasilFuzzy.score})`);

      // Emit data realtime via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.emit("latestData", {
          baterai: {
            timestamp: new Date().toISOString(),
            voltage: voltage,
            current: current,
            power: power,
            temperature: temperature,
            fuzzy_score: hasilFuzzy.score,
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
      b.created_at AS timestamp,
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
        timestamp: results[0].timestamp,
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
// === DASHBOARD METRICS ===
//
const getDashboardMetrics = (req, res) => {
  const query = `
    SELECT IFNULL(ROUND(AVG(power), 2), 0) AS avg_load
    FROM (
      SELECT power FROM baterai ORDER BY id DESC LIMIT 10
    ) temp
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Gagal ambil metrik:", err);
      return res.status(500).json({ message: "Gagal ambil metrik" });
    }

    if (results.length === 0 || !results[0]) {
      return res.json({ avg_load: 0 });
    }

    res.json({
      avg_load: results[0].avg_load
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

const getRecentData = (req, res) => {
  const query = `
    SELECT 
      b.created_at AS timestamp,
      b.voltage AS baterai_voltage,
      b.current AS baterai_current,
      b.power AS baterai_power,
      b.temperature AS baterai_temperature,
      f.fuzzy_score,
      f.fuzzy_status
    FROM (
      SELECT * FROM baterai ORDER BY id DESC LIMIT 10
    ) b
    LEFT JOIN fuzzy_baterai f ON f.baterai_id = b.id
    ORDER BY b.id ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Gagal ambil data terbaru:", err);
      return res.status(500).json({ message: "Gagal ambil data" });
    }
    res.json(results.map(row => ({
      timestamp: row.timestamp,
      voltage: row.baterai_voltage,
      current: row.baterai_current,
      power: row.baterai_power,
      temperature: row.baterai_temperature,
      fuzzy_score: row.fuzzy_score,
      fuzzy_status: row.fuzzy_status
    })));
  });
};

module.exports = {
  postData,
  getLatestData,
  getRecentData,
  getDashboardMetrics,
  getCombinedData,
  getAllPanelBaterai
};
