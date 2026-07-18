// controllers/dataController.js
const db = require('../db').pool;
const {
  validateSensorPayload,
  buildSensorError
} = require('../services/sensorValidation');

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
if (i <= 0.35) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Arus sepenuhnya termasuk kategori Ringan
    i_ringan = 1;
} else if (i >= 0.50) {
    // Kondisi 2: Lebih dari atau sama dengan titik batas atas
    // Arus sama sekali tidak termasuk kategori Ringan
    i_ringan = 0;
} else {
    // Kondisi 3: Berangsur turun menjauhi kategori Ringan
    // menuju kategori Sedang
    // Perhitungan:
    // (Batas Atas - Arus) / (Batas Atas - Batas Bawah)
    i_ringan = (0.50 - i) / (0.50 - 0.35);
}

// -- Himpunan Arus Sedang --
if (i <= 0.35 || i >= 1.13) {
    // Kondisi 1: Arus berada di luar batas kategori Sedang
    // Arus sama sekali tidak termasuk kategori Sedang
    i_sedang = 0;
} else if (i > 0.35 && i <= 0.50) {
    // Kondisi 2: Berangsur naik menuju kategori Sedang
    // Perhitungan:
    // (Arus - Batas Bawah) / (Titik Penuh - Batas Bawah)
    i_sedang = (i - 0.35) / (0.50 - 0.35);
} else if (i >= 0.90 && i < 1.13) {
    // Kondisi 3: Berangsur turun menjauhi kategori Sedang
    // menuju kategori Berat
    // Perhitungan:
    // (Batas Atas - Arus) / (Batas Atas - Titik Turun)
    i_sedang = (1.13 - i) / (1.13 - 0.90);
} else {
    // Kondisi 4: Arus berada pada rentang 0.50–0.90 A
    // Arus sepenuhnya termasuk kategori Sedang
    i_sedang = 1;
}

// -- Himpunan Arus Berat --
if (i <= 0.90) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Arus sama sekali tidak termasuk kategori Berat
    i_berat = 0;

} else if (i >= 1.13) {
    // Kondisi 2: Lebih dari atau sama dengan batas keanggotaan penuh
    // Arus sepenuhnya termasuk kategori Berat
    i_berat = 1;

} else {
    // Kondisi 3: Berangsur naik menuju kategori Berat
    // Perhitungan:
    // (Arus - Batas Bawah) / (Batas Atas - Batas Bawah)
    i_berat = (i - 0.90) / (1.13 - 0.90);
}


// ==========================================
// 3. FUZZIFIKASI SUHU (Temperature)
// ==========================================
// -- Himpunan Suhu Normal --
if (t <= 35) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Suhu sepenuhnya termasuk kategori Normal
    t_normal = 1;

} else if (t >= 36) {
    // Kondisi 2: Lebih dari atau sama dengan titik batas atas
    // Suhu sama sekali tidak termasuk kategori Normal
    t_normal = 0;

} else {
    // Kondisi 3: Berangsur turun menjauhi kategori Normal
    // menuju kategori Hangat
    // Perhitungan:
    // (Batas Atas - Suhu) / (Batas Atas - Batas Bawah)
    t_normal = (36 - t) / (36 - 35);
}

// -- Himpunan Suhu Hangat --
if (t <= 35 || t >= 41) {
    // Kondisi 1: Suhu berada di luar batas kategori Hangat
    // Suhu sama sekali tidak termasuk kategori Hangat
    t_hangat = 0;

} else if (t > 35 && t < 36) {
    // Kondisi 2: Berangsur naik menuju kategori Hangat
    // Perhitungan:
    // (Suhu - Batas Bawah) / (Titik Penuh - Batas Bawah)
    t_hangat = (t - 35) / (36 - 35);

} else if (t > 40 && t < 41) {
    // Kondisi 3: Berangsur turun menjauhi kategori Hangat
    // menuju kategori Panas
    // Perhitungan:
    // (Batas Atas - Suhu) / (Batas Atas - Titik Turun)
    t_hangat = (41 - t) / (41 - 40);

} else {
    // Kondisi 4: Suhu berada pada rentang 36–40°C
    // Suhu sepenuhnya termasuk kategori Hangat
    t_hangat = 1;
}


// -- Himpunan Suhu Panas --
if (t <= 40) {
    // Kondisi 1: Kurang dari atau sama dengan titik batas bawah
    // Suhu sama sekali tidak termasuk kategori Panas
    t_panas = 0;

} else if (t >= 41) {
    // Kondisi 2: Lebih dari atau sama dengan batas keanggotaan penuh
    // Suhu sepenuhnya termasuk kategori Panas
    t_panas = 1;

} else {
    // Kondisi 3: Berangsur naik menuju kategori Panas
    // Perhitungan:
    // (Suhu - Batas Bawah) / (Batas Atas - Batas Bawah)
    t_panas = (t - 40) / (41 - 40);
}
  
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
    // Suhu PANAS
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

  const validated = validateSensorPayload(baterai);
  const hasExplicitSensorStatus = Boolean(baterai.sensor_status);
  const {
    voltage,
    current,
    power,
    temperature,
    sensorStatus,
    errors: sensorErrors
  } = validated;

  // Jalankan perhitungan Fuzzy Logic menggunakan data dari baterai
  let hasilFuzzy;
  
  // Pengaman sisi server dijalankan sebelum proses fuzzy. Payload baru
  // menggunakan status koneksi eksplisit dari ESP32, sedangkan payload lama
  // tetap didukung melalui validasi nilai 0/-127.
  if (sensorErrors.length > 0) {
    hasilFuzzy = { score: 25.00, status: "Kritis" };

    // Emit sinyal error real-time ke web
    const io = req.app.get("io");
    // Perangkat baru sudah mengirim event hanya saat status berubah melalui
    // /api/sensor/status. Event di sini khusus kompatibilitas payload lama.
    if (io && !hasExplicitSensorStatus) {
      const sensorError = buildSensorError(sensorErrors);
      io.emit("sensorError", {
        ...sensorError,
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
            fuzzy_status: hasilFuzzy.status,
            sensor_status: sensorStatus
          }
        });
      }

      res.json({ 
          message: "Data tersimpan & Dievaluasi!",
          fuzzy_status: hasilFuzzy.status,
          fuzzy_score: hasilFuzzy.score,
          sensor_status: sensorStatus,
          sensor_error: sensorErrors.length > 0
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
