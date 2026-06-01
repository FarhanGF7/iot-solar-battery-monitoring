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
// === POST DATA (Panel + Beban) ===
//
const postData = (req, res) => {
  const { panel, beban } = req.body;

  if (!panel || !beban) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  const qPanel = `INSERT INTO panel (voltage, current, power) VALUES (?, ?, ?)`;
  const qBeban = `INSERT INTO beban (voltage, current, power) VALUES (?, ?, ?)`;

  db.query(qPanel, [panel.voltage, panel.current, panel.power], (err) => {
    if (err) {
      console.error("Gagal simpan PANEL:", err);
      return res.status(500).json({ message: "Gagal simpan data panel" });
    }

    db.query(qBeban, [beban.voltage, beban.current, beban.power], (err2) => {
      if (err2) {
        console.error("Gagal simpan BEBAN:", err2);
        return res.status(500).json({ message: "Gagal simpan data beban" });
      }

      res.json({ message: "Data panel & beban berhasil disimpan" });
    });
  });
};

//
// === GET DATA TERBARU ===
//
const getLatestData = (req, res) => {
  const query = `
    SELECT 
      p.voltage AS panel_voltage,
      p.current AS panel_current,
      p.power AS panel_power,
      b.voltage AS beban_voltage,
      b.current AS beban_current,
      b.power AS beban_power
    FROM panel p
    JOIN beban b ON b.id = (SELECT MAX(id) FROM beban)
    ORDER BY p.id DESC
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

    // Format sesuai script.js frontend
    res.json({
      panel: {
        voltage: results[0].panel_voltage,
        current: results[0].panel_current,
        power: results[0].panel_power
      },
      beban: {
        voltage: results[0].beban_voltage,
        current: results[0].beban_current,
        power: results[0].beban_power
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
    FROM panel
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
const PANEL_WP = 20;    // panel 20 watt-peak
const INTERVAL = 1800;     // interval data 30 menit

const getDashboardMetrics = (req, res) => {
  const query = `
  SELECT 
    p.voltage AS batt_voltage,
    p.power AS power_produce,
    b.power AS power_load,
    (
      SELECT ROUND(SUM(power * ${INTERVAL} / 3600000), 4)
      FROM panel 
      WHERE DATE(created_at) = CURDATE()
    ) AS energy_today,
    (
      SELECT ROUND(MAX(power), 2)
      FROM panel
      WHERE DATE(created_at) = CURDATE()
    ) AS peak_power,
    ROUND(b.power, 2) AS avg_load
  FROM panel p
  JOIN beban b 
    ON p.id = (SELECT MAX(id) FROM panel)
   AND b.id = (SELECT MAX(id) FROM beban)
  LIMIT 1
`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Gagal ambil metrik:", err);
      return res.status(500).json({ message: "Gagal ambil metrik" });
    }

    const row = results[0];

    // SOC baterai
    const battery_voltage = row.batt_voltage || 12.0;
    const battery_health = voltageToSoc(battery_voltage);

    // Efisiensi panel (aktual vs WP)
    const efficiency = row.power_produce > 0
      ? (row.power_produce / PANEL_WP) * 100
      : 0;

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


//
// === USER AUTH ===
//
const register = (req, res) => {
  const { username, password, role } = req.body;
  const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';

  db.query(query, [username, password, role], (err) => {
    if (err) {
      console.error("Registrasi gagal:", err);
      return res.status(500).json({ message: "Username sudah dipakai" });
    }
    res.status(201).json({ message: "Akun berhasil dibuat" });
  });
};

const login = (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';

  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (results.length > 0) {
      req.session.loggedIn = true;
      req.session.username = username;
      req.session.role = results[0].role;
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Username atau password salah" });
    }
  });
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
};
const getCombinedData = (req, res) => {
  const date = req.query.date;

  let query = `
    SELECT 
      p.created_at AS timestamp,
      p.voltage AS panel_voltage,
      p.current AS panel_current,
      p.power AS panel_power,
      b.voltage AS beban_voltage,
      b.current AS beban_current,
      b.power AS beban_power
    FROM panel p
    JOIN beban b 
      ON ABS(TIMESTAMPDIFF(SECOND, p.created_at, b.created_at)) <= 1
  `;

  if (date) {
    query += ` WHERE DATE(p.created_at) = ? ORDER BY p.created_at ASC`;
  } else {
    query += ` ORDER BY p.created_at ASC`;
  }

  db.query(query, [date], (err, results) => {
    if (err) return res.status(500).json({ message: "Error ambil data" });
    res.json(results);
  });
};


const getAllPanelBeban = (req, res) => {
  const q = `
    SELECT 
      p.created_at AS timestamp,
      p.voltage AS panel_voltage,
      p.current AS panel_current,
      p.power AS panel_power,
      b.voltage AS beban_voltage,
      b.current AS beban_current,
      b.power AS beban_power
    FROM panel p
    JOIN beban b 
      ON ABS(TIMESTAMPDIFF(SECOND, p.created_at, b.created_at)) <= 1
    ORDER BY p.created_at ASC
  `;

  db.query(q, (err, results) => {
    if (err) {
      console.error("Gagal ambil data panel+beban:", err);
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
  register,
  getCombinedData,
  getAllPanelBeban,
  login,
  logout
};
